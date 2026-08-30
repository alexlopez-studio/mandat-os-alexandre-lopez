import { adminDb } from '@/lib/ai/db'
import { getSetting } from '@/lib/settings'

import type { GranolaMeeting } from './types'

/**
 * Rattachement d'un compte rendu a une affaire (`projects`).
 *
 * Un compte rendu isole ne sert a rien : c'est ce rapprochement qui lui donne
 * une place dans le CRM. Trois signaux, du plus au moins discriminant :
 * le nom du vendeur, la commune, la proximite avec la date de visite.
 *
 * Piege n° 2 : le rattachement metier fait foi dans `opportunity_meeting_links`
 * (vers `projects`), jamais dans `external_transcripts.dossier_id`, qui pointe
 * vers `client_dossiers` (espace client) et restera nul longtemps.
 */

export const GRANOLA_MATCH_THRESHOLD_KEY = 'granola_match_threshold'

/**
 * Seuil volontairement provisoire : le brief demande d'observer les
 * `match_score` reels avant de le figer. Ajustable sans redeploiement.
 */
export const DEFAULT_MATCH_THRESHOLD = 0.55

/** Ecart tolere entre la date de la reunion et `visit_at`, en heures. */
const VISIT_WINDOW_HOURS = 36

export type ProjectCandidate = {
  id: string
  title: string | null
  reference: string | null
  stage: string | null
  seller_name: string | null
  property_city: string | null
  property_address: string | null
  visit_at: string | null
}

export type MeetingMatch = {
  project: ProjectCandidate | null
  score: number
  reasons: string[]
}

export async function getMatchThreshold(): Promise<number> {
  const raw = await getSetting<number>(GRANOLA_MATCH_THRESHOLD_KEY, DEFAULT_MATCH_THRESHOLD)
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : DEFAULT_MATCH_THRESHOLD
}

/** Affaires ouvertes, candidates au rattachement (les fiches de demo exclues). */
export async function listProjectCandidates(): Promise<ProjectCandidate[]> {
  const { data, error } = await adminDb()
    .from('projects')
    .select('id, title, reference, stage, seller_name, property_city, property_address, visit_at')
    .neq('is_test', true)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)
  return (data ?? []) as ProjectCandidate[]
}

/**
 * Meilleure affaire pour une reunion donnee, avec son score et ses motifs.
 *
 * Les motifs sont volontairement redigees en clair : c'est ce qui permet a
 * Alexandre d'arbitrer un `needs_review` sans rouvrir le compte rendu.
 */
export function matchMeetingToProject(meeting: GranolaMeeting, candidates: ProjectCandidate[]): MeetingMatch {
  const haystack = normalize([meeting.title, meeting.summary, meeting.transcript_text].filter(Boolean).join(' '))
  const titleHaystack = normalize(meeting.title)

  let best: MeetingMatch = { project: null, score: 0, reasons: [] }

  for (const project of candidates) {
    const reasons: string[] = []
    let score = 0

    // ── Nom du vendeur : le signal le plus discriminant ──
    const sellerTokens = nameTokens(project.seller_name)
    const matchedTokens = sellerTokens.filter((token) => haystack.includes(token))
    if (matchedTokens.length > 0) {
      const inTitle = matchedTokens.some((token) => titleHaystack.includes(token))
      score += inTitle ? 0.45 : 0.3
      if (matchedTokens.length > 1) score += 0.1
      reasons.push(`Vendeur « ${project.seller_name} » cite${inTitle ? ' dans le titre' : ''} (${matchedTokens.join(', ')})`)
    }

    // ── Commune ──
    const cityTokens = cityVariants(project.property_city)
    const matchedCity = cityTokens.find((token) => haystack.includes(token))
    if (matchedCity) {
      score += titleHaystack.includes(matchedCity) ? 0.3 : 0.2
      reasons.push(`Commune « ${project.property_city} » citee`)
    }

    // ── Reference du dossier ──
    if (project.reference && haystack.includes(normalize(project.reference))) {
      score += 0.35
      reasons.push(`Reference ${project.reference} citee`)
    }

    // ── Proximite avec la date de visite ──
    if (project.visit_at && meeting.meeting_at) {
      const deltaHours = Math.abs(new Date(project.visit_at).getTime() - new Date(meeting.meeting_at).getTime()) / 3_600_000
      if (deltaHours <= VISIT_WINDOW_HOURS) {
        score += 0.25
        reasons.push(`Visite planifiee a ${Math.round(deltaHours)} h de la reunion`)
      }
    }

    // ── Adresse ──
    const addressTokens = significantTokens(project.property_address)
    const matchedAddress = addressTokens.filter((token) => haystack.includes(token))
    if (matchedAddress.length >= 2) {
      score += 0.15
      reasons.push(`Adresse reconnue (${matchedAddress.slice(0, 3).join(', ')})`)
    }

    const rounded = Math.min(1, Number(score.toFixed(3)))
    if (rounded > best.score) best = { project, score: rounded, reasons }
  }

  if (!best.project) {
    return { project: null, score: 0, reasons: ['Aucun signal reconnu (ni vendeur, ni commune, ni date de visite).'] }
  }

  return best
}

/**
 * Enregistre le rattachement.
 *
 * UNIQUE (opportunity_id, source, meeting_id) : rejouer la sync met la ligne a
 * jour au lieu d'en empiler une seconde.
 */
export async function upsertMeetingLink(input: {
  projectId: string
  meeting: GranolaMeeting
  score: number
  reasons: string[]
  confirmedBy: string
}) {
  const { data, error } = await adminDb()
    .from('opportunity_meeting_links')
    .upsert(
      {
        opportunity_id: input.projectId,
        source: 'granola',
        meeting_id: input.meeting.external_id,
        meeting_title: input.meeting.title,
        meeting_date: input.meeting.meeting_at,
        match_score: input.score,
        match_reasons: input.reasons,
        confirmed_by: input.confirmedBy,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'opportunity_id,source,meeting_id' },
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Affaire deja rattachee a une reunion, s'il y en a une. */
export async function findLinkedProjectId(meetingId: string): Promise<string | null> {
  const { data, error } = await adminDb()
    .from('opportunity_meeting_links')
    .select('opportunity_id')
    .eq('source', 'granola')
    .eq('meeting_id', meetingId)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.opportunity_id ?? null
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Jetons d'un nom de vendeur.
 *
 * « Joseph & Regine » donne deux prenoms ; les jetons trop courts sont ecartes
 * pour ne pas rapprocher deux affaires sur un « et » ou un « de ».
 */
function nameTokens(value: string | null): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 4)
}

/**
 * Variantes d'une commune.
 *
 * « Saint-Maximin-la-Sainte-Baume » doit se reconnaitre dans un compte rendu
 * qui dit simplement « Saint-Maximin ». Et un compte rendu dicte a l'oral ecrit
 * « Barjol » la ou la fiche porte « Barjols » : le `s` final est retire pour les
 * noms assez longs pour que la troncature ne cree pas de faux rapprochement.
 */
function cityVariants(value: string | null): string[] {
  const full = normalize(value)
  if (!full) return []

  const variants = new Set<string>([full])
  const parts = full.split(' ').filter(Boolean)

  if (parts[0] === 'saint' && parts[1]) variants.add(`${parts[0]} ${parts[1]}`)
  else if (parts[0] && parts[0].length >= 4) variants.add(parts[0])

  for (const variant of [...variants]) {
    if (variant.length >= 6 && variant.endsWith('s')) variants.add(variant.slice(0, -1))
  }

  return [...variants]
}

function significantTokens(value: string | null): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 4)
}

import { adminDb } from '@/lib/ai/db'
import { aiChat } from '@/lib/ai/gateway'
import { getSetting } from '@/lib/settings'

import { findLinkedProjectId } from './matching'
import { GRANOLA_AI_SIGNATURE, GRANOLA_PROVIDER } from './types'

/**
 * Extraction structuree d'un compte rendu, puis mise en file d'actions.
 *
 * Chaque element extrait devient une ligne d'`ai_action_queue`, typee par
 * `action_type` et graduee par `risk_level` :
 *
 *   low    — ecriture interne reversible (note, tache, champ vide complete)
 *   medium — ecrasement d'une valeur renseignee, changement de stage, contact
 *   high   — tout ce qui sort de l'app : e-mail, publication, prix affiche
 *
 * Le brief impose de demarrer en mode proposition integrale : tant que
 * `granola_autodispatch_enabled` est faux, TOUT reste en `proposed`, quel que
 * soit le risque. L'execution automatique des `low` ne s'active qu'apres avoir
 * juge la qualite d'extraction sur de vrais rendez-vous.
 */

export const GRANOLA_EXTRACTION_MODEL_KEY = 'granola_extraction_model'
export const DEFAULT_EXTRACTION_MODEL = 'deepseek-chat'

export type ExtractedPerson = {
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
}

export type GranolaExtraction = {
  property: Record<string, string | number | null>
  prices: Array<{ label: string; amount: number | null; note: string | null }>
  blockers: string[]
  next_steps: Array<{ title: string; detail: string | null; priority: 'haute' | 'normale' | 'basse' | null }>
  people: ExtractedPerson[]
  summary_note: string | null
}

export type ExtractionOutcome = {
  transcript_id: string
  external_id: string
  project_id: string | null
  queued: number
  skipped_people: string[]
  actions: Array<{ action_type: string; risk_level: 'low' | 'medium' | 'high'; title: string }>
}

const EXTRACTION_SYSTEM_PROMPT = `Tu es l'assistant d'un conseiller immobilier en Provence Verte.
Tu lis le compte rendu d'un rendez-vous vendeur et tu en extrais des faits, jamais des suppositions.

Reponds UNIQUEMENT par un objet JSON valide, sans texte autour, de la forme :
{
  "property": { "type_bien": null, "surface": null, "pieces": null, "commune": null, "etat": null, "dpe": null, "travaux": null },
  "prices": [ { "label": "prix net vendeur evoque", "amount": 70000, "note": null } ],
  "blockers": [ "point de blocage formule en une phrase" ],
  "next_steps": [ { "title": "action a faire", "detail": null, "priority": "normale" } ],
  "people": [ { "name": "Prenom Nom", "role": "notaire", "email": null, "phone": null } ],
  "summary_note": "trois phrases maximum resumant le rendez-vous"
}

Regles strictes :
- n'invente aucune valeur : ce qui n'est pas dit vaut null ;
- "prices" ne contient que des montants explicitement evoques ;
- "people" ne liste que des personnes reellement citees, avec leur role dans l'affaire ;
- "next_steps" reprend les prochaines etapes annoncees, une par entree ;
- pas de commentaire, pas de markdown, uniquement le JSON.`

/**
 * Lance l'extraction sur un compte rendu deja rattache a une affaire.
 *
 * `force` rejoue une extraction : les propositions encore en attente sont
 * remplacees, jamais empilees. Les actions deja executees restent, protegees
 * par la cle de provenance en base.
 */
export async function extractTranscript(input: {
  transcriptId: string
  force?: boolean
}): Promise<ExtractionOutcome> {
  const { data: transcript, error } = await adminDb()
    .from('external_transcripts')
    .select('id, provider, external_id, title, summary, transcript_text, meeting_at, status, extracted_at')
    .eq('id', input.transcriptId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!transcript) throw new Error('Compte rendu introuvable')
  if (transcript.status !== 'classified') {
    throw new Error('Compte rendu non rattache : arbitrez son affaire avant extraction.')
  }
  if (transcript.extracted_at && !input.force) {
    throw new Error('Compte rendu deja extrait. Utilisez le rejeu explicite pour recommencer.')
  }

  const projectId = await findLinkedProjectId(transcript.external_id)

  const body = [transcript.summary, transcript.transcript_text].filter(Boolean).join('\n\n')
  if (!body.trim()) throw new Error('Compte rendu vide : rien a extraire.')

  let extraction: GranolaExtraction
  try {
    extraction = await callExtractionModel({ title: transcript.title, meetingAt: transcript.meeting_at, body })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction impossible'
    await adminDb()
      .from('external_transcripts')
      .update({ extraction_error: message })
      .eq('id', transcript.id)
    throw err
  }

  if (input.force) await clearPendingActions(transcript.external_id)

  const outcome = await queueActions({
    transcriptId: transcript.id,
    externalId: transcript.external_id,
    meetingTitle: transcript.title,
    projectId,
    extraction,
  })

  await adminDb()
    .from('external_transcripts')
    .update({ extracted_at: new Date().toISOString(), extraction_error: null })
    .eq('id', transcript.id)

  return outcome
}

async function callExtractionModel(input: {
  title: string
  meetingAt: string | null
  body: string
}): Promise<GranolaExtraction> {
  const model = await getSetting<string>(GRANOLA_EXTRACTION_MODEL_KEY, DEFAULT_EXTRACTION_MODEL)

  const result = await aiChat({
    providerId: 'deepseek',
    model,
    json: true,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Titre : ${input.title}\nDate : ${input.meetingAt ?? 'inconnue'}\n\nCompte rendu :\n${input.body.slice(0, 12000)}`,
      },
    ],
  })

  if (result.providerId === 'fallback') {
    throw new Error("Aucune cle IA active : configurez DeepSeek dans Reglages > Assistant IA.")
  }

  return normalizeExtraction(result.content)
}

/**
 * Le mode `json_object` garantit un JSON syntaxiquement valide, jamais qu'il
 * respecte le schema demande : chaque champ est donc revalide ici.
 */
export function normalizeExtraction(raw: string): GranolaExtraction {
  const parsed = parseJsonLoose(raw)
  if (!parsed) throw new Error("Reponse du modele illisible : JSON attendu.")

  return {
    property: asRecord(parsed.property),
    prices: asArray(parsed.prices).map((entry) => {
      const price = asRecord(entry)
      return {
        label: asText(price.label) ?? 'Montant evoque',
        amount: asNumber(price.amount),
        note: asText(price.note),
      }
    }),
    blockers: asArray(parsed.blockers)
      .map((entry) => asText(entry) ?? asText(asRecord(entry).title))
      .filter((entry): entry is string => Boolean(entry)),
    next_steps: asArray(parsed.next_steps).reduce<GranolaExtraction['next_steps']>((steps, entry) => {
      const step = asRecord(entry)
      const title = asText(step.title) ?? asText(entry)
      if (!title) return steps
      const priority = asText(step.priority)
      steps.push({
        title,
        detail: asText(step.detail),
        priority: priority === 'haute' || priority === 'basse' ? priority : 'normale',
      })
      return steps
    }, []),
    people: asArray(parsed.people)
      .map((entry) => {
        const person = asRecord(entry)
        return {
          name: asText(person.name),
          role: asText(person.role),
          email: asText(person.email),
          phone: asText(person.phone),
        }
      })
      .filter((person) => Boolean(person.name)),
    summary_note: asText(parsed.summary_note),
  }
}

/**
 * Traduit l'extraction en actions graduees.
 *
 * Regle applicative que la base ne peut pas porter : une personne citee ne
 * devient une fiche que s'il existe un point d'accroche identifiant — e-mail,
 * telephone, ou nom complet assorti d'un role dans l'affaire. Sinon la mention
 * reste dans le contenu de l'activite. « Appeler Frederic » est une tache, pas
 * un contact.
 */
async function queueActions(input: {
  transcriptId: string
  externalId: string
  meetingTitle: string
  projectId: string | null
  extraction: GranolaExtraction
}): Promise<ExtractionOutcome> {
  const actions: Array<{
    action_type: string
    risk_level: 'low' | 'medium' | 'high'
    title: string
    description: string | null
    item_key: string
    payload: Record<string, unknown>
  }> = []

  const skippedPeople: string[] = []
  const { extraction } = input

  if (extraction.summary_note) {
    actions.push({
      action_type: 'create_activity',
      risk_level: 'low',
      title: `Compte rendu : ${input.meetingTitle}`,
      description: extraction.summary_note,
      item_key: 'summary',
      payload: {
        activity_type: 'meeting',
        title: `Compte rendu : ${input.meetingTitle}`,
        content: extraction.summary_note,
      },
    })
  }

  extraction.next_steps.forEach((step, index) => {
    const grading = gradeNextStep(step.title)
    actions.push({
      action_type: grading.action_type,
      risk_level: grading.risk_level,
      title: step.title,
      description: grading.risk_level === 'high'
        ? "Sort de l'app : reste en proposition jusqu'a validation humaine."
        : step.detail,
      item_key: `next_step:${index}`,
      payload: {
        activity_type: 'task',
        title: step.title,
        content: step.detail,
        priority: step.priority,
      },
    })
  })

  extraction.blockers.forEach((blocker, index) => {
    actions.push({
      action_type: 'create_activity',
      risk_level: 'low',
      title: `Point de blocage : ${truncate(blocker, 60)}`,
      description: blocker,
      item_key: `blocker:${index}`,
      payload: { activity_type: 'note', title: 'Point de blocage', content: blocker },
    })
  })

  // ── Champs du bien : `low` si le champ est vide, `medium` s'il est renseigne ──
  const projectFields = await resolveProjectFieldUpdates(input.projectId, extraction.property)
  projectFields.forEach((update) => {
    actions.push({
      action_type: 'update_project_field',
      risk_level: update.current_value === null ? 'low' : 'medium',
      title:
        update.current_value === null
          ? `Completer « ${update.field} » : ${update.new_value}`
          : `Remplacer « ${update.field} » : ${update.current_value} → ${update.new_value}`,
      description:
        update.current_value === null
          ? 'Champ vide complete depuis le compte rendu.'
          : "Ecrasement d'une valeur deja renseignee : l'ancienne valeur sera ecrite dans la timeline du dossier.",
      item_key: `field:${update.field}`,
      payload: {
        field: update.field,
        new_value: update.new_value,
        previous_value: update.current_value,
      },
    })
  })

  // ── Montants evoques : jamais un prix affiche, seulement une note tracee ──
  extraction.prices.forEach((price, index) => {
    actions.push({
      action_type: 'create_activity',
      risk_level: 'low',
      title: `Montant evoque : ${price.label}`,
      description: [price.amount ? `${price.amount} €` : null, price.note].filter(Boolean).join(' — ') || price.label,
      item_key: `price:${index}`,
      payload: {
        activity_type: 'note',
        title: `Montant evoque — ${price.label}`,
        content: [price.amount ? `${price.amount} €` : null, price.note].filter(Boolean).join('\n') || price.label,
      },
    })
  })

  // ── Personnes citees ──
  extraction.people.forEach((person, index) => {
    if (!hasIdentityHook(person)) {
      skippedPeople.push(person.name ?? 'personne sans nom')
      return
    }
    actions.push({
      action_type: 'create_contact',
      risk_level: 'medium',
      title: `Creer le contact ${person.name}`,
      description: [person.role, person.email, person.phone].filter(Boolean).join(' · '),
      item_key: `person:${index}`,
      payload: {
        first_name: firstName(person.name),
        last_name: lastName(person.name),
        email: person.email,
        phone: person.phone,
        relation: person.role,
        types: inferContactTypes(person.role),
      },
    })
  })

  // Les personnes sans point d'accroche ne disparaissent pas : elles restent
  // dans une note, lisible, plutot que de creer une fiche fantome.
  if (skippedPeople.length > 0) {
    actions.push({
      action_type: 'create_activity',
      risk_level: 'low',
      title: 'Personnes citees sans coordonnees',
      description: skippedPeople.join(', '),
      item_key: 'people:mentioned',
      payload: {
        activity_type: 'note',
        title: 'Personnes citees sans coordonnees',
        content: `Citees pendant le rendez-vous, sans e-mail ni telephone : ${skippedPeople.join(', ')}.`,
      },
    })
  }

  const rows = actions.map((action) => ({
    title: action.title,
    description: action.description,
    action_type: action.action_type,
    risk_level: action.risk_level,
    source: GRANOLA_PROVIDER,
    proposed_by: GRANOLA_AI_SIGNATURE,
    status: 'proposed',
    payload: {
      ...action.payload,
      project_id: input.projectId,
      external_transcript_id: input.transcriptId,
      provenance: {
        source_provider: GRANOLA_PROVIDER,
        source_external_id: input.externalId,
        source_item_key: action.item_key,
      },
    },
  }))

  if (rows.length > 0) {
    const { error } = await adminDb().from('ai_action_queue').insert(rows)
    if (error) throw new Error(error.message)
  }

  return {
    transcript_id: input.transcriptId,
    external_id: input.externalId,
    project_id: input.projectId,
    queued: rows.length,
    skipped_people: skippedPeople,
    actions: actions.map((action) => ({
      action_type: action.action_type,
      risk_level: action.risk_level,
      title: action.title,
    })),
  }
}

/**
 * Champs de `projects` que l'extraction permettrait de remplir, avec leur
 * valeur actuelle — c'est elle qui decide du niveau de risque et qui sera
 * ecrite dans la timeline en cas d'ecrasement.
 */
async function resolveProjectFieldUpdates(
  projectId: string | null,
  property: Record<string, string | number | null>,
): Promise<Array<{ field: string; new_value: string | number; current_value: string | number | null }>> {
  if (!projectId) return []

  const mapping: Record<string, string> = {
    type_bien: 'property_type',
    surface: 'property_surface',
    pieces: 'property_rooms',
    commune: 'property_city',
  }

  const { data: project, error } = await adminDb()
    .from('projects')
    .select('property_type, property_surface, property_rooms, property_city')
    .eq('id', projectId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!project) return []

  const updates: Array<{ field: string; new_value: string | number; current_value: string | number | null }> = []

  for (const [extractedKey, column] of Object.entries(mapping)) {
    const value = property[extractedKey]
    if (value === null || value === undefined || value === '') continue

    const current = (project as Record<string, unknown>)[column]
    const currentValue = current === null || current === undefined || current === '' ? null : (current as string | number)

    // Rien a proposer si la valeur est deja celle-la.
    if (currentValue !== null && String(currentValue).trim() === String(value).trim()) continue

    updates.push({ field: column, new_value: value, current_value: currentValue })
  }

  return updates
}

/** Supprime les propositions encore en attente pour ce compte rendu. */
async function clearPendingActions(externalId: string) {
  const { error } = await adminDb()
    .from('ai_action_queue')
    .delete()
    .eq('source', GRANOLA_PROVIDER)
    .eq('status', 'proposed')
    .eq('payload->provenance->>source_external_id', externalId)

  if (error) throw new Error(error.message)
}

/**
 * Gradation d'une prochaine etape.
 *
 * Une etape qui reste dans l'app (recuperer un document, rappeler quelqu'un,
 * prendre des photos) est une tache interne reversible : `low`. Une etape qui
 * SORT de l'app — envoyer un e-mail au client, publier l'annonce, modifier un
 * prix affiche — est `high` et ne s'executera jamais sans validation humaine,
 * quel que soit le reglage du dispatch autonome.
 */
export function gradeNextStep(title: string): {
  action_type: string
  risk_level: 'low' | 'medium' | 'high'
} {
  const value = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/\b(mail|e-?mail|courriel|ecrire au|envoyer (un |le )?(mail|message|devis|compromis))/.test(value)) {
    return { action_type: 'draft_email', risk_level: 'high' }
  }
  // « en ligne » suffit : dans un compte rendu de mandat, l'expression designe
  // toujours la mise en ligne de l'annonce. Le libelle exact varie trop pour
  // etre enumere (« mettre l'annonce Barjol en ligne, sans teasing »).
  if (/\b(publier|publication|diffuser|poster|story|boost)/.test(value) || /\ben ligne\b/.test(value)) {
    return { action_type: 'publish_listing', risk_level: 'high' }
  }
  if (/\b(prix affiche|baisser le prix|augmenter le prix|changer le prix)/.test(value)) {
    return { action_type: 'update_public_price', risk_level: 'high' }
  }

  return { action_type: 'create_activity', risk_level: 'low' }
}

/**
 * Point d'accroche identifiant : e-mail, telephone, ou nom complet assorti
 * d'un role. Sans lui, aucune fiche contact n'est creee.
 */
export function hasIdentityHook(person: ExtractedPerson): boolean {
  if (person.email || person.phone) return true
  const name = (person.name ?? '').trim()
  const hasFullName = name.split(/\s+/).filter((part) => part.length >= 2).length >= 2
  return hasFullName && Boolean(person.role?.trim())
}

function inferContactTypes(role: string | null): string[] {
  const value = (role ?? '').toLowerCase()
  if (/vendeur|proprietaire|propriétaire/.test(value)) return ['vendeur']
  if (/acquereur|acquéreur|acheteur/.test(value)) return ['acquereur']
  if (/notaire|diagnostiqueur|artisan|banque|courtier/.test(value)) return ['partenaire']
  // `types` ne doit jamais etre vide sur une creation IA (CHECK en base).
  return ['reseau']
}

function firstName(name: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

function lastName(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : ''
}

function parseJsonLoose(raw: string): Record<string, any> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, any>
    } catch {
      return null
    }
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`
}

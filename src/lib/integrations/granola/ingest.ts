import { adminDb } from '@/lib/ai/db'

import {
  findLinkedProjectId,
  getMatchThreshold,
  listProjectCandidates,
  matchMeetingToProject,
  upsertMeetingLink,
  type ProjectCandidate,
} from './matching'
import { GRANOLA_PROVIDER, type GranolaIngestResult, type GranolaIngestSource, type GranolaMeeting } from './types'

/**
 * Point d'entree unique de l'ingestion Granola.
 *
 * Le synchroniseur quotidien, un webhook (Granola → Zapier) et un rejeu manuel
 * appellent tous cette fonction : ce sont trois façons interchangeables
 * d'alimenter le meme point d'entree, sans rien changer en aval.
 *
 * Idempotence : l'UPSERT vise le conflit `(provider, external_id)`. Deux
 * executions successives laissent exactement une ligne par reunion — c'est ce
 * qui permet de retrouver et mettre a jour la ligne inseree a la main plutot
 * que de la dupliquer.
 */
export async function ingestGranolaMeetings(
  meetings: GranolaMeeting[],
  options: { source: GranolaIngestSource; autoLink?: boolean } = { source: 'manual' },
): Promise<GranolaIngestResult> {
  const result: GranolaIngestResult = {
    fetched: meetings.length,
    created: 0,
    updated: 0,
    classified: 0,
    needs_review: 0,
    linked: 0,
    errors: [],
  }

  if (meetings.length === 0) return result

  const autoLink = options.autoLink !== false
  const threshold = await getMatchThreshold()
  const candidates: ProjectCandidate[] = autoLink ? await listProjectCandidates() : []

  const existingIds = await listKnownExternalIds(meetings.map((meeting) => meeting.external_id))

  for (const meeting of meetings) {
    try {
      const alreadyKnown = existingIds.has(meeting.external_id)

      // Un arbitrage humain deja rendu prime sur le score : on ne le rejoue pas.
      const confirmedProjectId = alreadyKnown ? await findLinkedProjectId(meeting.external_id) : null

      const match = autoLink && !confirmedProjectId ? matchMeetingToProject(meeting, candidates) : null
      const linkedProjectId = confirmedProjectId ?? (match && match.score >= threshold ? match.project?.id ?? null : null)
      const status = linkedProjectId ? 'classified' : 'needs_review'

      const { error } = await adminDb()
        .from('external_transcripts')
        .upsert(
          {
            provider: GRANOLA_PROVIDER,
            external_id: meeting.external_id,
            title: meeting.title,
            meeting_at: meeting.meeting_at,
            summary: meeting.summary,
            // Le verbatim reste NULL sur le plan gratuit : nominal, pas une erreur.
            transcript_text: meeting.transcript_text ?? null,
            raw_payload: {
              ...meeting.raw,
              participants: meeting.participants,
              ingested_from: options.source,
              ingested_at: new Date().toISOString(),
              // Meilleur candidat meme sous le seuil : sans lui, un `needs_review`
              // arrive au back-office sans le moindre element pour arbitrer.
              match_suggestion:
                match && match.project
                  ? { project_id: match.project.id, score: match.score, reasons: match.reasons }
                  : null,
            },
            classification_confidence: match ? match.score : null,
            status,
          },
          { onConflict: 'provider,external_id' },
        )
        .select('id')
        .single()

      if (error) throw new Error(error.message)

      if (alreadyKnown) result.updated += 1
      else result.created += 1
      if (status === 'classified') result.classified += 1
      else result.needs_review += 1

      if (match?.project && match.score >= threshold && !confirmedProjectId) {
        await upsertMeetingLink({
          projectId: match.project.id,
          meeting,
          score: match.score,
          reasons: match.reasons,
          confirmedBy: 'ai:granola',
        })
        result.linked += 1
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      result.errors.push({ external_id: meeting.external_id, message })
      console.error(`[granola/ingest] ${meeting.external_id}: ${message}`)
    }
  }

  return result
}

/**
 * Identifiants deja presents en base, pour distinguer creation et mise a jour.
 *
 * L'UPSERT ne le dit pas de lui-meme : sans cette lecture prealable,
 * `created_count` et `updated_count` de `sync_runs` seraient faux, et le
 * critere de recette « la reunion est mise a jour, pas dupliquee » invisible.
 */
async function listKnownExternalIds(externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set()

  const { data, error } = await adminDb()
    .from('external_transcripts')
    .select('external_id')
    .eq('provider', GRANOLA_PROVIDER)
    .in('external_id', externalIds)

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((row: { external_id: string }) => row.external_id))
}

/** Compte rendu Granola par son identifiant Granola. */
export async function getTranscriptByExternalId(externalId: string) {
  const { data, error } = await adminDb()
    .from('external_transcripts')
    .select('*')
    .eq('provider', GRANOLA_PROVIDER)
    .eq('external_id', externalId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

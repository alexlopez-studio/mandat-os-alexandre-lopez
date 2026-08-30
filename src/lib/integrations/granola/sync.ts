import { adminDb } from '@/lib/ai/db'
import { getSetting } from '@/lib/settings'

import { assessGranolaFreshness, loadGranolaConnection, markGranolaError, updateGranolaConnection } from './connection'
import { ingestGranolaMeetings } from './ingest'
import { getGranolaMeetings, listGranolaMeetings, openGranolaSession } from './mcp'
import { GRANOLA_PROVIDER, type GranolaIngestResult, type GranolaMeeting } from './types'

/**
 * Synchroniseur quotidien Granola.
 *
 * Ce n'est pas un confort : le plan gratuit n'expose que les 30 derniers jours.
 * Chaque journee sans synchronisation rapproche des reunions de la perte
 * definitive — d'ou la cadence quotidienne et l'alerte des 20 jours.
 *
 * Le job ne fait que lire chez Granola et ecrire dans `external_transcripts`
 * via le point d'entree unique `ingestGranolaMeetings`. L'extraction et le
 * dispatch sont des etapes distinctes, declenchees separement.
 */

export const GRANOLA_SYNC_ENABLED_KEY = 'granola_sync_enabled'

export type GranolaSyncOutcome = {
  ran: boolean
  skipped_reason: string | null
  sync_run_id: string | null
  ingest: GranolaIngestResult | null
  freshness: ReturnType<typeof assessGranolaFreshness>
  error: string | null
}

export async function syncGranola(
  options: { source?: 'cron' | 'manual'; timeRange?: 'this_week' | 'last_week' | 'last_30_days' } = {},
): Promise<GranolaSyncOutcome> {
  const source = options.source ?? 'manual'
  const connection = await loadGranolaConnection()
  const freshness = assessGranolaFreshness(connection?.last_synced_at ?? null)

  const enabled = await getSetting<boolean>(GRANOLA_SYNC_ENABLED_KEY, false)
  if (enabled !== true) {
    await logSyncRun({ status: 'blocked', source, blockedReason: 'granola_sync_disabled' })
    return { ran: false, skipped_reason: 'granola_sync_disabled', sync_run_id: null, ingest: null, freshness, error: null }
  }

  if (!connection || connection.status === 'revoked') {
    await logSyncRun({ status: 'blocked', source, blockedReason: 'granola_not_connected' })
    return { ran: false, skipped_reason: 'granola_not_connected', sync_run_id: null, ingest: null, freshness, error: null }
  }

  const runId = await logSyncRun({ status: 'running', source })

  try {
    const client = await openGranolaSession()
    if (!client) throw new Error('Connexion Granola indisponible (jeton absent ou non renouvelable)')

    // `list_meetings` ne donne que les metadonnees ; `get_meetings` apporte le
    // resume structure, et n'est appele que sur les identifiants recuperes.
    const listed = await listGranolaMeetings(client, options.timeRange ?? 'last_30_days')
    const details = listed.length > 0 ? await getGranolaMeetings(client, listed.map((m) => m.external_id)) : []

    const meetings = mergeMeetings(listed, details)
    const ingest = await ingestGranolaMeetings(meetings, { source: 'poller' })

    await updateGranolaConnection(connection.id, {
      status: 'active',
      last_synced_at: new Date().toISOString(),
      last_cursor: meetings[0]?.external_id ?? connection.last_cursor,
      last_error: ingest.errors.length > 0 ? `${ingest.errors.length} reunion(s) en erreur` : null,
    })

    await finishSyncRun(runId, {
      status: ingest.errors.length > 0 && ingest.created + ingest.updated === 0 ? 'error' : 'success',
      fetched: ingest.fetched,
      created: ingest.created,
      updated: ingest.updated,
      // Un appel `list_meetings` + un appel `get_meetings` par lot de 10.
      requests: 1 + Math.ceil(listed.length / 10),
      errorMessage: ingest.errors.length > 0 ? ingest.errors.map((e) => `${e.external_id}: ${e.message}`).join(' | ') : null,
    })

    return {
      ran: true,
      skipped_reason: null,
      sync_run_id: runId,
      ingest,
      freshness: assessGranolaFreshness(new Date().toISOString()),
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur de synchronisation Granola'

    // Le journal doit porter la trace de l'echec, y compris ses compteurs a zero :
    // une execution qui echoue en silence est indiscernable d'une execution absente.
    await finishSyncRun(runId, { status: 'error', fetched: 0, created: 0, updated: 0, requests: 0, errorMessage: message })
    if (connection) await markGranolaError(connection.id, message)

    return { ran: true, skipped_reason: null, sync_run_id: runId, ingest: null, freshness, error: message }
  }
}

/**
 * Fusionne la liste et les details.
 *
 * `list_meetings` porte les participants et la date ; `get_meetings` porte le
 * resume. Aucune des deux reponses n'est complete a elle seule.
 */
export function mergeMeetings(listed: GranolaMeeting[], details: GranolaMeeting[]): GranolaMeeting[] {
  const byId = new Map<string, GranolaMeeting>()

  for (const meeting of listed) byId.set(meeting.external_id, meeting)

  for (const detail of details) {
    const base = byId.get(detail.external_id)
    byId.set(detail.external_id, {
      ...base,
      ...detail,
      title: detail.title || base?.title || 'Reunion Granola',
      meeting_at: detail.meeting_at ?? base?.meeting_at ?? null,
      summary: detail.summary ?? base?.summary ?? null,
      transcript_text: detail.transcript_text ?? base?.transcript_text ?? null,
      participants: detail.participants.length > 0 ? detail.participants : (base?.participants ?? []),
      raw: { ...(base?.raw ?? {}), ...detail.raw },
    })
  }

  return [...byId.values()]
}

async function logSyncRun(input: {
  status: 'running' | 'blocked'
  source: string
  blockedReason?: string
}): Promise<string | null> {
  const now = new Date().toISOString()
  const { data, error } = await adminDb()
    .from('sync_runs')
    .insert({
      provider: GRANOLA_PROVIDER,
      status: input.status,
      source: input.source,
      started_at: now,
      finished_at: input.status === 'blocked' ? now : null,
      blocked_reason: input.blockedReason ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[granola/sync] journalisation impossible:', error.message)
    return null
  }
  return data.id
}

async function finishSyncRun(
  id: string | null,
  input: {
    status: 'success' | 'error'
    fetched: number
    created: number
    updated: number
    requests: number
    errorMessage: string | null
  },
) {
  if (!id) return

  const { error } = await adminDb()
    .from('sync_runs')
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      fetched_count: input.fetched,
      created_count: input.created,
      updated_count: input.updated,
      external_request_count: input.requests,
      external_item_count: input.fetched,
      // Le MCP Granola est gratuit : aucun cout externe a imputer.
      estimated_cost_eur: 0,
      error_message: input.errorMessage,
    })
    .eq('id', id)

  if (error) console.error('[granola/sync] cloture du journal impossible:', error.message)
}

/** Dernieres executions Granola, pour le back-office. */
export async function listGranolaSyncRuns(limit = 10) {
  const { data, error } = await adminDb()
    .from('sync_runs')
    .select('id, status, source, started_at, finished_at, fetched_count, created_count, updated_count, error_message, blocked_reason')
    .eq('provider', GRANOLA_PROVIDER)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}

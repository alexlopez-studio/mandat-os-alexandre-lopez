import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/ai/db'
import { isGranolaMachineOrAdmin } from '@/lib/integrations/granola/auth'
import { assessGranolaFreshness, loadGranolaConnection } from '@/lib/integrations/granola/connection'
import { GRANOLA_AUTODISPATCH_KEY, GRANOLA_AUTODISPATCH_MEDIUM_KEY } from '@/lib/integrations/granola/dispatch'
import { getMatchThreshold } from '@/lib/integrations/granola/matching'
import { GRANOLA_SYNC_ENABLED_KEY, listGranolaSyncRuns } from '@/lib/integrations/granola/sync'
import { GRANOLA_PROVIDER } from '@/lib/integrations/granola/types'
import { getSetting, setSetting } from '@/lib/settings'

/**
 * GET  /api/integrations/granola/status — etat de la connexion et de la chaine.
 * PATCH /api/integrations/granola/status — bascules runtime (`app_settings`).
 *
 * Aucun secret n'est expose : ni jeton, ni identifiant client.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const connection = await loadGranolaConnection()
    const [syncEnabled, autodispatch, autodispatchMedium, threshold, runs, counts] = await Promise.all([
      getSetting<boolean>(GRANOLA_SYNC_ENABLED_KEY, false),
      getSetting<boolean>(GRANOLA_AUTODISPATCH_KEY, false),
      getSetting<boolean>(GRANOLA_AUTODISPATCH_MEDIUM_KEY, false),
      getMatchThreshold(),
      listGranolaSyncRuns(8),
      countTranscripts(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        connected: connection?.status === 'active',
        connection: connection
          ? {
              status: connection.status,
              account_email: connection.account_email,
              last_synced_at: connection.last_synced_at,
              last_error: connection.last_error,
              token_expires_at: connection.token_expires_at,
              scopes: connection.scopes ?? [],
            }
          : null,
        freshness: assessGranolaFreshness(connection?.last_synced_at ?? null),
        settings: {
          sync_enabled: syncEnabled === true,
          autodispatch_enabled: autodispatch === true,
          autodispatch_medium_enabled: autodispatchMedium === true,
          match_threshold: threshold,
        },
        transcripts: counts,
        sync_runs: runs,
      },
    })
  } catch (err) {
    console.error('[GET /api/integrations/granola/status]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Etat Granola indisponible' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    if (typeof body.sync_enabled === 'boolean') await setSetting(GRANOLA_SYNC_ENABLED_KEY, body.sync_enabled)
    if (typeof body.autodispatch_enabled === 'boolean') {
      await setSetting(GRANOLA_AUTODISPATCH_KEY, body.autodispatch_enabled)
    }
    if (typeof body.autodispatch_medium_enabled === 'boolean') {
      await setSetting(GRANOLA_AUTODISPATCH_MEDIUM_KEY, body.autodispatch_medium_enabled)
    }
    if (typeof body.match_threshold === 'number' && body.match_threshold > 0 && body.match_threshold <= 1) {
      await setSetting('granola_match_threshold', body.match_threshold)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/integrations/granola/status]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Mise a jour impossible' },
      { status: 500 },
    )
  }
}

async function countTranscripts() {
  const statuses = ['classified', 'needs_review', 'ignored'] as const
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await adminDb()
        .from('external_transcripts')
        .select('id', { count: 'exact', head: true })
        .eq('provider', GRANOLA_PROVIDER)
        .eq('status', status)
      if (error) throw new Error(error.message)
      return [status, count ?? 0] as const
    }),
  )

  return Object.fromEntries(entries) as Record<(typeof statuses)[number], number>
}

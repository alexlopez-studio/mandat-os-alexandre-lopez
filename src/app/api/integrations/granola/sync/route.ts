import { NextRequest, NextResponse } from 'next/server'

import { isGranolaMachineOrAdmin } from '@/lib/integrations/granola/auth'
import { syncGranola } from '@/lib/integrations/granola/sync'

/**
 * POST /api/integrations/granola/sync — declenche une synchronisation.
 *
 * Meme code que le cron quotidien : la bascule `granola_sync_enabled` et le
 * journal `sync_runs` s'appliquent aussi aux declenchements manuels.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { time_range?: unknown }
    const timeRange = (['this_week', 'last_week', 'last_30_days'] as const).includes(body.time_range as never)
      ? (body.time_range as 'this_week' | 'last_week' | 'last_30_days')
      : 'last_30_days'

    const data = await syncGranola({ source: 'manual', timeRange })
    return NextResponse.json({ success: data.error === null, data, error: data.error })
  } catch (err) {
    console.error('[POST /api/integrations/granola/sync]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Sync Granola impossible' },
      { status: 500 },
    )
  }
}

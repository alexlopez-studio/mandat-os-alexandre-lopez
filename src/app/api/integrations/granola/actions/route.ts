import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/ai/db'
import { isGranolaMachineOrAdmin } from '@/lib/integrations/granola/auth'
import { dispatchGranolaActions, executeGranolaActionById } from '@/lib/integrations/granola/dispatch'
import { GRANOLA_PROVIDER } from '@/lib/integrations/granola/types'

/**
 * GET  /api/integrations/granola/actions       — file d'actions proposees par l'IA.
 * POST /api/integrations/granola/actions       — dispatch automatique des `low`.
 *   { "action_id": "…", "decision": "execute" | "reject" } — decision unitaire.
 *
 * Une action `high` ne s'execute jamais sans decision humaine : c'est la seule
 * frontiere que le dispatch autonome ne franchit pas.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const status = req.nextUrl.searchParams.get('status')
    let query = adminDb()
      .from('ai_action_queue')
      .select('id, title, description, action_type, status, risk_level, payload, result, error, proposed_by, executed_at, created_at')
      .eq('source', GRANOLA_PROVIDER)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/integrations/granola/actions]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Lecture impossible' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { action_id?: unknown; decision?: unknown }
    const actionId = typeof body.action_id === 'string' ? body.action_id : null

    if (!actionId) {
      const data = await dispatchGranolaActions({ limit: 50 })
      return NextResponse.json({ success: true, data })
    }

    if (body.decision === 'reject') {
      const { error } = await adminDb()
        .from('ai_action_queue')
        .update({ status: 'rejected', reviewed_by: 'admin', reviewed_at: new Date().toISOString() })
        .eq('id', actionId)
        .eq('source', GRANOLA_PROVIDER)

      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true, data: { status: 'rejected' } })
    }

    const outcome = await executeGranolaActionById(actionId, 'admin')
    return NextResponse.json({ success: outcome.status === 'executed', data: outcome })
  } catch (err) {
    console.error('[POST /api/integrations/granola/actions]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Action impossible' },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { executeAiAction, listAiActions, reviewAiAction } from '@/lib/ai/actions'

export async function GET(req: NextRequest) {
  try {
    const status = new URL(req.url).searchParams.get('status')
    return NextResponse.json({ success: true, data: await listAiActions(status) })
  } catch (err) {
    console.error('[GET /api/ai/actions]', err)
    return NextResponse.json({ success: false, error: 'Erreur actions IA' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id?: unknown; decision?: unknown }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 })

    if (body.decision === 'approve') {
      return NextResponse.json({ success: true, data: await reviewAiAction(id, 'approved') })
    }
    if (body.decision === 'reject') {
      return NextResponse.json({ success: true, data: await reviewAiAction(id, 'rejected') })
    }
    if (body.decision === 'execute') {
      return NextResponse.json({ success: true, data: await executeAiAction(id) })
    }

    return NextResponse.json({ success: false, error: 'Décision invalide' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /api/ai/actions]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur action IA' }, { status: 500 })
  }
}

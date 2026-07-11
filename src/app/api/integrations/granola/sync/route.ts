import { NextRequest, NextResponse } from 'next/server'
import { syncGranolaNotes } from '@/lib/integrations/granola'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { api_key?: unknown; created_after?: unknown }
    const data = await syncGranolaNotes({
      apiKey: typeof body.api_key === 'string' ? body.api_key : null,
      createdAfter: typeof body.created_after === 'string' ? body.created_after : null,
    })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[POST /api/integrations/granola/sync]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur sync Granola' }, { status: 500 })
  }
}

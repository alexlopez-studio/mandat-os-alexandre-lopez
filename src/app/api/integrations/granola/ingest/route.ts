import { NextRequest, NextResponse } from 'next/server'

import { isGranolaMachineOrAdmin } from '@/lib/integrations/granola/auth'
import { ingestGranolaMeetings } from '@/lib/integrations/granola/ingest'
import { parseGranolaMeetings } from '@/lib/integrations/granola/parse'
import type { GranolaIngestSource } from '@/lib/integrations/granola/types'

/**
 * POST /api/integrations/granola/ingest — point d'entree unique de l'ingestion.
 *
 * Le synchroniseur quotidien et un eventuel webhook (Granola → Zapier) sont
 * deux façons interchangeables d'alimenter ce meme point, sans rien changer en
 * aval. Le corps accepte indifferemment :
 *
 *   { "meetings": [ { "external_id": "...", "title": "...", "summary": "..." } ] }
 *   { "text": "<meetings_data>…" }   ← reponse brute du MCP Granola
 *
 * Idempotent : rejouer la meme charge met a jour, ne duplique pas.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const payload = body.text ?? body.meetings ?? body.raw ?? body
    const meetings = parseGranolaMeetings(payload)

    if (meetings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucune reunion exploitable dans la charge recue.' },
        { status: 400 },
      )
    }

    const source = (['poller', 'webhook', 'manual'] as const).includes(body.source as GranolaIngestSource)
      ? (body.source as GranolaIngestSource)
      : 'webhook'

    const data = await ingestGranolaMeetings(meetings, { source, autoLink: body.auto_link !== false })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[POST /api/integrations/granola/ingest]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Ingestion Granola impossible' },
      { status: 500 },
    )
  }
}

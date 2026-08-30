import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/ai/db'
import { isGranolaMachineOrAdmin } from '@/lib/integrations/granola/auth'
import { extractTranscript } from '@/lib/integrations/granola/extraction'
import { upsertMeetingLink } from '@/lib/integrations/granola/matching'
import { GRANOLA_PROVIDER, type GranolaMeeting } from '@/lib/integrations/granola/types'

/**
 * PATCH /api/integrations/granola/transcripts/[id] — arbitrage humain.
 *   { "opportunity_id": "…" }  rattache l'affaire et passe en `classified`
 *   { "status": "ignored" }    ecarte definitivement le compte rendu
 *
 * POST  /api/integrations/granola/transcripts/[id] — lance l'extraction IA.
 *   { "force": true } rejoue une extraction en remplaçant les propositions
 *   encore en attente (les actions deja executees restent, protegees par leur
 *   cle de provenance).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await req.json().catch(() => ({}))) as { opportunity_id?: unknown; status?: unknown }

    const transcript = await loadTranscript(id)
    if (!transcript) return NextResponse.json({ success: false, error: 'Compte rendu introuvable' }, { status: 404 })

    if (body.status === 'ignored') {
      await adminDb().from('external_transcripts').update({ status: 'ignored' }).eq('id', id)
      return NextResponse.json({ success: true, data: { status: 'ignored' } })
    }

    const opportunityId = typeof body.opportunity_id === 'string' ? body.opportunity_id : null
    if (!opportunityId) {
      return NextResponse.json({ success: false, error: 'opportunity_id requis' }, { status: 400 })
    }

    const meeting: GranolaMeeting = {
      external_id: transcript.external_id,
      title: transcript.title,
      meeting_at: transcript.meeting_at,
      summary: transcript.summary,
      participants: [],
      raw: {},
    }

    // Arbitrage humain : score maximal et motif explicite, pour qu'une relecture
    // a six semaines distingue un rattachement decide d'un rattachement devine.
    await upsertMeetingLink({
      projectId: opportunityId,
      meeting,
      score: 1,
      reasons: ['Rattachement confirme manuellement depuis le back-office.'],
      confirmedBy: 'admin',
    })

    await adminDb()
      .from('external_transcripts')
      .update({ status: 'classified', classification_confidence: 1 })
      .eq('id', id)

    return NextResponse.json({ success: true, data: { status: 'classified', opportunity_id: opportunityId } })
  } catch (err) {
    console.error('[PATCH /api/integrations/granola/transcripts/[id]]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Arbitrage impossible' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await req.json().catch(() => ({}))) as { force?: unknown }

    const data = await extractTranscript({ transcriptId: id, force: body.force === true })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[POST /api/integrations/granola/transcripts/[id]]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Extraction impossible' },
      { status: 500 },
    )
  }
}

async function loadTranscript(id: string) {
  const { data, error } = await adminDb()
    .from('external_transcripts')
    .select('id, external_id, title, meeting_at, summary, status')
    .eq('id', id)
    .eq('provider', GRANOLA_PROVIDER)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

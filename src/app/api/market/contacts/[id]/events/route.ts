import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID contact requis' }, { status: 400 })
    }

    const { data: events, error } = await supabaseAdmin
      .from('lead_events')
      .select('*')
      .or(`lead_id.eq.${id},payload->>contact_id.eq.${id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API /market/contacts/[id]/events] GET error:', error)
      return NextResponse.json({ error: 'Erreur lecture événements contact' }, { status: 500 })
    }

    return NextResponse.json({ events: events || [] })
  } catch (e) {
    console.error('[API /market/contacts/[id]/events] GET exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { kind = 'note', text, payload = {} } = body

    if (!id) {
      return NextResponse.json({ error: 'ID contact requis' }, { status: 400 })
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Le texte de l\'événement est requis' }, { status: 400 })
    }

    const eventPayload = {
      ...payload,
      contact_id: id,
      text: text.trim(),
    }

    const { data: newEvent, error } = await supabaseAdmin
      .from('lead_events')
      .insert({
        lead_id: id,
        kind: kind as never,
        payload: eventPayload,
        created_by: 'user',
      } as never)
      .select('*')
      .single()

    if (error) {
      console.error('[API /market/contacts/[id]/events] POST error:', error)
      return NextResponse.json({ error: 'Erreur création événement' }, { status: 500 })
    }

    return NextResponse.json({ event: newEvent }, { status: 201 })
  } catch (e) {
    console.error('[API /market/contacts/[id]/events] POST exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

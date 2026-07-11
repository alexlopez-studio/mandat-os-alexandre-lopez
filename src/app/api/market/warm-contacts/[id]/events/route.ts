import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { WarmEventType } from '@/types/supabase'

const VALID_TYPES: WarmEventType[] = [
  'call', 'email', 'message', 'meeting', 'note', 'status_change', 'referral', 'import',
]

// Types d'activité qui constituent un "contact" effectif (mettent à jour last_contacted_at)
const CONTACT_TYPES: WarmEventType[] = ['call', 'email', 'message', 'meeting']

/**
 * GET /api/market/warm-contacts/[id]/events
 * Historique d'activité d'un contact.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { data: events, error } = await supabaseAdmin
      .from('warm_contact_events')
      .select('*')
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false })

    if (error) {
      console.error('[API warm-contacts/[id]/events] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({ events: events ?? [] })
  } catch (e) {
    console.error('[API warm-contacts/[id]/events] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/warm-contacts/[id]/events
 * Ajoute une activité (appel, email, note...) à la timeline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    const type: WarmEventType = VALID_TYPES.includes(body.type) ? body.type : 'note'
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!content && type === 'note') {
      return NextResponse.json({ error: 'content requis pour une note' }, { status: 400 })
    }

    const { data: event, error } = await supabaseAdmin
      .from('warm_contact_events')
      .insert({
        contact_id: id,
        type,
        content: content || null,
        occurred_at: body.occurred_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[API warm-contacts/[id]/events] POST error:', error)
      return NextResponse.json({ error: 'Erreur ajout activité' }, { status: 500 })
    }

    // Met à jour last_contacted_at si c'est une prise de contact réelle
    if (CONTACT_TYPES.includes(type)) {
      await supabaseAdmin
        .from('warm_contacts')
        .update({ last_contacted_at: event.occurred_at })
        .eq('id', id)
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (e) {
    console.error('[API warm-contacts/[id]/events] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

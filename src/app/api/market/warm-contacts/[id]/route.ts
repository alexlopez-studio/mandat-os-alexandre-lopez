import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, WarmContactStatus } from '@/types/supabase'

type WarmContactUpdate = Database['public']['Tables']['warm_contacts']['Update']

const VALID_STATUS: WarmContactStatus[] = ['a_contacter', 'contacte', 'relance', 'termine']

/**
 * GET /api/market/warm-contacts/[id]
 * Détail d'un contact + son historique d'activité.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data: contact, error } = await supabaseAdmin
      .from('warm_contacts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
      }
      console.error('[API /market/warm-contacts/[id]] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    const { data: events } = await supabaseAdmin
      .from('warm_contact_events')
      .select('*')
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false })

    return NextResponse.json({ contact, events: events ?? [] })
  } catch (e) {
    console.error('[API /market/warm-contacts/[id]] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/market/warm-contacts/[id]
 * Met à jour un contact. Journalise un changement de statut.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    // État courant (pour détecter le changement de statut)
    const { data: existing } = await supabaseAdmin
      .from('warm_contacts')
      .select('status')
      .eq('id', id)
      .single()

    const update: WarmContactUpdate = {}
    if (typeof body.full_name === 'string' && body.full_name.trim()) update.full_name = body.full_name.trim()
    if ('relation' in body) update.relation = body.relation?.trim() || null
    if ('phone' in body) update.phone = body.phone?.trim() || null
    if ('email' in body) update.email = body.email?.trim()?.toLowerCase() || null
    if ('notes' in body) update.notes = body.notes?.trim() || null
    if ('follow_up_date' in body) update.follow_up_date = body.follow_up_date || null
    if (Array.isArray(body.referrals)) {
      update.referrals = body.referrals
        .filter((r: unknown) => typeof r === 'string' && r.trim())
        .map((r: string) => r.trim())
    }
    if (VALID_STATUS.includes(body.status)) update.status = body.status

    const { data: contact, error } = await supabaseAdmin
      .from('warm_contacts')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /market/warm-contacts/[id]] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    // Journalise le changement de statut dans la timeline
    if (update.status && existing && existing.status !== update.status) {
      await supabaseAdmin.from('warm_contact_events').insert({
        contact_id: id,
        type: 'status_change',
        content: `Statut : ${existing.status} → ${update.status}`,
        metadata: { from: existing.status, to: update.status },
      })
    }

    return NextResponse.json({ contact })
  } catch (e) {
    console.error('[API /market/warm-contacts/[id]] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/market/warm-contacts/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { error } = await supabaseAdmin.from('warm_contacts').delete().eq('id', id)

    if (error) {
      console.error('[API /market/warm-contacts/[id]] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /market/warm-contacts/[id]] DELETE', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

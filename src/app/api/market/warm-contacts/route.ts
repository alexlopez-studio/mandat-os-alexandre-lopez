import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, WarmContactStatus } from '@/types/supabase'

type WarmContactInsert = Database['public']['Tables']['warm_contacts']['Insert']

const VALID_STATUS: WarmContactStatus[] = ['a_contacter', 'contacte', 'relance', 'termine']

/**
 * GET /api/market/warm-contacts
 * Liste les contacts de la Liste Chaude (filtres : status, search).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const sort = searchParams.get('sort') ?? 'created_at.desc'

    let query = supabaseAdmin.from('warm_contacts').select('*', { count: 'exact' })

    if (status && VALID_STATUS.includes(status as WarmContactStatus)) {
      query = query.eq('status', status as WarmContactStatus)
    }

    if (search) {
      const like = `%${search}%`
      query = query.or(
        `full_name.ilike.${like},relation.ilike.${like},notes.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
      )
    }

    const [sortField, sortDir] = sort.split('.')
    const validSortFields = ['full_name', 'status', 'follow_up_date', 'created_at', 'last_contacted_at']
    if (validSortFields.includes(sortField)) {
      query = query.order(sortField, { ascending: sortDir === 'asc', nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data: contacts, count, error } = await query

    if (error) {
      console.error('[API /market/warm-contacts] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({ contacts: contacts ?? [], total: count ?? 0 })
  } catch (e) {
    console.error('[API /market/warm-contacts] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/warm-contacts
 * Crée un contact.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.full_name || typeof body.full_name !== 'string' || !body.full_name.trim()) {
      return NextResponse.json({ error: 'full_name requis' }, { status: 400 })
    }

    const status: WarmContactStatus = VALID_STATUS.includes(body.status)
      ? body.status
      : 'a_contacter'

    const referrals = Array.isArray(body.referrals)
      ? body.referrals.filter((r: unknown) => typeof r === 'string' && r.trim()).map((r: string) => r.trim())
      : []

    const insert: WarmContactInsert = {
      full_name: body.full_name.trim(),
      relation: body.relation?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim()?.toLowerCase() || null,
      status,
      referrals,
      follow_up_date: body.follow_up_date || null,
      notes: body.notes?.trim() || null,
      source: body.source || 'manual',
    }

    const { data: contact, error } = await supabaseAdmin
      .from('warm_contacts')
      .insert(insert)
      .select()
      .single()

    if (error) {
      console.error('[API /market/warm-contacts] POST error:', error)
      return NextResponse.json({ error: 'Erreur création contact' }, { status: 500 })
    }

    return NextResponse.json({ contact }, { status: 201 })
  } catch (e) {
    console.error('[API /market/warm-contacts] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type Db = { from: (table: string) => any }
const db = supabaseAdmin as unknown as Db

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.active !== undefined) payload.active = Boolean(body.active)
    if (body.name !== undefined) payload.name = String(body.name).trim()
    if (body.zipcode !== undefined) payload.zipcode = body.zipcode ? String(body.zipcode) : null

    const { data, error } = await db
      .from('dvf_communes')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /market/dvf/zones/[id]] PATCH', error)
      return NextResponse.json({ error: 'Erreur mise à jour commune DVF' }, { status: 500 })
    }

    return NextResponse.json({ zone: data })
  } catch (error) {
    console.error('[API /market/dvf/zones/[id]] PATCH', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { data: zone, error: readError } = await db
      .from('dvf_communes')
      .select('insee_code')
      .eq('id', id)
      .single()

    if (readError || !zone?.insee_code) {
      return NextResponse.json({ error: 'Commune DVF introuvable' }, { status: 404 })
    }

    const deleteTransactions = await db
      .from('dvf_transactions')
      .delete()
      .eq('insee_code', zone.insee_code)

    if (deleteTransactions.error) {
      console.error('[API /market/dvf/zones/[id]] DELETE transactions', deleteTransactions.error)
      return NextResponse.json({ error: 'Erreur suppression mutations DVF' }, { status: 500 })
    }

    const deleteZone = await db
      .from('dvf_communes')
      .delete()
      .eq('id', id)

    if (deleteZone.error) {
      console.error('[API /market/dvf/zones/[id]] DELETE zone', deleteZone.error)
      return NextResponse.json({ error: 'Erreur suppression commune DVF' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted_transactions: deleteTransactions.count ?? null })
  } catch (error) {
    console.error('[API /market/dvf/zones/[id]] DELETE', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

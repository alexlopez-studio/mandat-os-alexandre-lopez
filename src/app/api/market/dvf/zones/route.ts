import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { departmentFromInsee } from '@/lib/dvf'

type Db = { from: (table: string) => any }
const db = supabaseAdmin as unknown as Db

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const active = searchParams.get('active')

    let query = db
      .from('dvf_communes')
      .select('*')
      .order('name', { ascending: true })

    if (active === 'true') query = query.eq('active', true)
    if (active === 'false') query = query.eq('active', false)

    const { data, error } = await query
    if (error) {
      console.error('[API /market/dvf/zones] GET', error)
      return NextResponse.json({ error: 'Erreur lecture communes DVF' }, { status: 500 })
    }

    return NextResponse.json({ zones: data ?? [] })
  } catch (error) {
    console.error('[API /market/dvf/zones] GET', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const inseeCode = String(body.insee_code ?? '').trim()
    const name = String(body.name ?? '').trim()

    if (!inseeCode || !name) {
      return NextResponse.json({ error: 'insee_code et name requis' }, { status: 400 })
    }

    const payload = {
      insee_code: inseeCode,
      name,
      zipcode: body.zipcode ? String(body.zipcode) : null,
      department_code: body.department_code ? String(body.department_code) : departmentFromInsee(inseeCode),
      active: body.active !== undefined ? Boolean(body.active) : true,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from('dvf_communes')
      .upsert(payload, { onConflict: 'insee_code' })
      .select()
      .single()

    if (error) {
      console.error('[API /market/dvf/zones] POST', error)
      return NextResponse.json({ error: 'Erreur ajout commune DVF' }, { status: 500 })
    }

    return NextResponse.json({ zone: data }, { status: 201 })
  } catch (error) {
    console.error('[API /market/dvf/zones] POST', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

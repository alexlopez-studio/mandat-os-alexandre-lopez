import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type Db = { from: (table: string) => any }
const db = supabaseAdmin as unknown as Db

const VALID_SORT_FIELDS = new Set(['mutation_date', 'value', 'price_per_m2', 'built_surface', 'land_surface'])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const inseeCode = searchParams.get('insee_code')?.trim()
    const localType = searchParams.get('local_type')?.trim()
    const year = Number.parseInt(searchParams.get('year') ?? '', 10)
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 100))
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const offset = (page - 1) * limit
    const sort = searchParams.get('sort') ?? 'mutation_date.desc'
    const [sortField, sortDir] = sort.split('.')

    let query = db
      .from('dvf_transactions')
      .select('*', { count: 'exact' })

    if (inseeCode) query = query.eq('insee_code', inseeCode)
    if (localType && localType !== 'all') query = query.eq('local_type', localType)
    if (Number.isFinite(year)) query = query.eq('mutation_year', year)

    query = query
      .order(VALID_SORT_FIELDS.has(sortField) ? sortField : 'mutation_date', { ascending: sortDir === 'asc', nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) {
      console.error('[API /market/dvf/transactions] GET', error)
      return NextResponse.json({ error: 'Erreur lecture mutations DVF' }, { status: 500 })
    }

    return NextResponse.json({
      transactions: data ?? [],
      total: count ?? 0,
      page,
      limit,
    })
  } catch (error) {
    console.error('[API /market/dvf/transactions] GET', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

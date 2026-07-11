import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/market/rules
 * Liste toutes les règles de gestion.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const active = searchParams.get('active')
    const triggerType = searchParams.get('trigger_type')
    const sort = searchParams.get('sort') ?? 'created_at.desc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('management_rules')
      .select('*', { count: 'exact' })

    // Filtres
    if (active === 'true') query = query.eq('active', true)
    else if (active === 'false') query = query.eq('active', false)
    if (triggerType) query = query.eq('trigger_type', triggerType)

    // Tri
    const [sortField, sortDir] = sort.split('.')
    const validSortFields = ['name', 'trigger_type', 'priority', 'last_run_at', 'created_at', 'updated_at']
    if (validSortFields.includes(sortField)) {
      query = query.order(sortField, { ascending: sortDir === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: rules, count, error } = await query

    if (error) {
      console.error('[API /market/rules] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({
      rules,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (e) {
    console.error('[API /market/rules] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/rules
 * Crée une nouvelle règle de gestion.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validation minimale
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name requis (string non vide)' }, { status: 400 })
    }
    if (!body.trigger_type || typeof body.trigger_type !== 'string') {
      return NextResponse.json({ error: 'trigger_type requis (string)' }, { status: 400 })
    }

    const { data: rule, error } = await supabaseAdmin
      .from('management_rules')
      .insert({
        name: body.name.trim(),
        description: body.description ?? '',
        active: body.active !== undefined ? Boolean(body.active) : true,
        trigger_type: body.trigger_type,
        conditions_json: body.conditions_json ?? { all: [] },
        actions_json: body.actions_json ?? { actions: [] },
        priority: body.priority ?? 'medium',
      })
      .select()
      .single()

    if (error) {
      console.error('[API /market/rules] POST error:', error)
      return NextResponse.json({ error: 'Erreur création règle' }, { status: 500 })
    }

    return NextResponse.json({ rule }, { status: 201 })
  } catch (e) {
    console.error('[API /market/rules] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
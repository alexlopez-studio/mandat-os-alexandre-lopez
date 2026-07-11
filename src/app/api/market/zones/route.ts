import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureStreamEstateSavedSearchForZone } from '@/lib/market/stream-estate-searches'

/**
 * GET /api/market/zones
 * Liste les zones surveillées.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const active = searchParams.get('active')
    const sort = searchParams.get('sort') ?? 'created_at.desc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('monitored_zones')
      .select('*', { count: 'exact' })

    // Filtres
    if (active === 'true') query = query.eq('active', true)
    else if (active === 'false') query = query.eq('active', false)

    // Tri
    const [sortField, sortDir] = sort.split('.')
    const validSortFields = ['name', 'zipcode', 'city', 'last_synced_at', 'created_at']
    if (validSortFields.includes(sortField)) {
      query = query.order(sortField, { ascending: sortDir === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: zones, count, error } = await query

    if (error) {
      console.error('[API /market/zones] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({
      zones,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (e) {
    console.error('[API /market/zones] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/zones
 * Crée une nouvelle zone surveillée.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validation minimale
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name requis (string non vide)' }, { status: 400 })
    }
    if (!body.zipcode || typeof body.zipcode !== 'string') {
      return NextResponse.json({ error: 'zipcode requis (string)' }, { status: 400 })
    }

    const { data: zone, error } = await supabaseAdmin
      .from('monitored_zones')
      .insert({
        name: body.name.trim(),
        zipcode: body.zipcode,
        city: body.city ?? null,
        insee_code: body.insee_code ?? null,
        active: body.active !== undefined ? Boolean(body.active) : true,
        sync_frequency: body.sync_frequency ?? 'daily',
      })
      .select()
      .single()

    if (error) {
      console.error('[API /market/zones] POST error:', error)
      return NextResponse.json({ error: 'Erreur création zone' }, { status: 500 })
    }

    if (zone?.active) await ensureStreamEstateSavedSearchForZone(zone)

    return NextResponse.json({ zone }, { status: 201 })
  } catch (e) {
    console.error('[API /market/zones] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

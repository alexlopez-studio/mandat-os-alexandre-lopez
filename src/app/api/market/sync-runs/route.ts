import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/market/sync-runs
 * Liste paginée des synchronisations avec info zone.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
    const offset = (page - 1) * limit
    const zoneId = searchParams.get('zone_id')

    let query = supabaseAdmin
      .from('sync_runs')
      .select('*, monitored_zones(name, zipcode, city)', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (zoneId) query = query.eq('zone_id', zoneId)

    const { data: runs, count, error } = await query

    if (error) {
      console.error('[API /market/sync-runs] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({ runs: runs ?? [], total: count ?? 0, page, limit })
  } catch (e) {
    console.error('[API /market/sync-runs]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

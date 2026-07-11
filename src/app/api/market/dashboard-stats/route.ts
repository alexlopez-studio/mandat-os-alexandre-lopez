import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/market/dashboard-stats
 * KPI réels du centre de contrôle Mandat OS (boucle mandat).
 */
export async function GET() {
  try {
    const countOf = async (build: () => PromiseLike<{ count: number | null }>) => {
      const { count } = await build()
      return count ?? 0
    }

    const [
      biensSurveilles,
      opportunitesChaudes,
      papChauds,
      alertesMandat,
      opportunitesTotal,
      opportunitesTerminees,
      zonesActives,
    ] = await Promise.all([
      countOf(() =>
        supabaseAdmin.from('market_properties').select('id', { count: 'exact', head: true }),
      ),
      countOf(() =>
        supabaseAdmin
          .from('market_properties')
          .select('id', { count: 'exact', head: true })
          .in('mandate_phase', ['hot', 'golden']),
      ),
      countOf(() =>
        supabaseAdmin
          .from('market_properties')
          .select('id', { count: 'exact', head: true })
          .eq('seller_type', 'individual')
          .in('mandate_phase', ['hot', 'golden']),
      ),
      countOf(() =>
        supabaseAdmin
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .in('type', ['mandate_hot', 'mandate_golden'])
          .eq('status', 'unread'),
      ),
      countOf(() =>
        supabaseAdmin.from('opportunities').select('id', { count: 'exact', head: true }),
      ),
      countOf(() =>
        supabaseAdmin
          .from('opportunities')
          .select('id', { count: 'exact', head: true })
          .in('stage', ['Mandat signé', 'Perdu / Écarté']),
      ),
      countOf(() =>
        supabaseAdmin
          .from('monitored_zones')
          .select('id', { count: 'exact', head: true })
          .eq('active', true),
      ),
    ])

    return NextResponse.json({
      biens_surveilles: biensSurveilles,
      opportunites_chaudes: opportunitesChaudes,
      pap_chauds: papChauds,
      alertes_mandat: alertesMandat,
      pipeline_actif: Math.max(0, opportunitesTotal - opportunitesTerminees),
      zones_actives: zonesActives,
    })
  } catch (e) {
    console.error('[API /market/dashboard-stats]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

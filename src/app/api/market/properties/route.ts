import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { purgeMarketPropertiesByIds } from '@/lib/market/property-cleanup'
import { scoreMarketProperty, type PriceHistoryRow } from '@/lib/market/mandate-score'
import { buildZoneMedians, undervaluationPct, zoneKey } from '@/lib/market/zone-valuation'
import { propertyThumbnailUrl } from '@/lib/market/property-thumbnail'

/**
 * GET /api/market/properties
 * Retourne la liste des biens filtrée.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const zipcode = searchParams.get('zipcode')
    const city = searchParams.get('city')
    const q = searchParams.get('q')
    const propertyType = searchParams.get('property_type')
    const dpe = searchParams.get('dpe')
    const status = searchParams.get('status')
    const priceMin = searchParams.get('price_min')
    const priceMax = searchParams.get('price_max')
    const surfaceMin = searchParams.get('surface_min')
    const surfaceMax = searchParams.get('surface_max')
    const landSurfaceMin = searchParams.get('land_surface_min')
    const tag = searchParams.get('tag')
    const sort = searchParams.get('sort') ?? 'last_seen_at.desc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30))
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('market_properties')
      .select('*', { count: 'exact' })

    // Filtres
    if (zipcode) query = query.eq('zipcode', zipcode)
    if (city) query = query.ilike('city', `%${city}%`)
    if (q?.trim()) {
      const term = q.trim().replace(/[%(),]/g, ' ')
      query = query.or(`title.ilike.%${term}%,city.ilike.%${term}%,zipcode.ilike.%${term}%`)
    }
    if (propertyType) query = query.eq('property_type', propertyType)
    if (dpe) query = query.eq('dpe', dpe)
    if (status) query = query.eq('status', status)
    if (!status) query = query.neq('status', 'duplicate')
    if (priceMin) query = query.gte('price', Number(priceMin))
    if (priceMax) query = query.lte('price', Number(priceMax))
    if (surfaceMin) query = query.gte('surface', Number(surfaceMin))
    if (surfaceMax) query = query.lte('surface', Number(surfaceMax))
    if (landSurfaceMin) query = query.gte('land_surface', Number(landSurfaceMin))

    // Tri
    const [sortField, sortDir] = sort.split('.')
    const validSortFields = [
      'price', 'surface', 'price_per_m2', 'rooms', 'bedrooms',
      'created_at', 'last_seen_at', 'first_seen_at', 'city', 'zipcode',
    ]
    if (validSortFields.includes(sortField)) {
      query = query.order(sortField, { ascending: sortDir === 'asc' })
    } else {
      query = query.order('last_seen_at', { ascending: false })
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: properties, count, error } = await query

    if (error) {
      console.error('[API /market/properties]', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Si tag filter, on filtre après (car relation dans property_tags)
    let filtered = properties
    if (tag && filtered.length > 0) {
      const { data: taggedIds } = await supabaseAdmin
        .from('property_tags')
        .select('market_property_id')
        .eq('tag', tag)

      const idsWithTag = new Set(taggedIds?.map(t => t.market_property_id) ?? [])
      filtered = filtered.filter(p => idsWithTag.has(p.id))
    }

    // Score métier (MandateProbabilityScore) pour la page courante :
    // un seul appel groupé sur l'historique de prix, puis scoring en mémoire.
    const ids = filtered.map((p) => p.id)
    const historyByProperty = new Map<string, PriceHistoryRow[]>()
    const opportunityByProperty = new Map<string, { id: string; title: string; stage: string | null; priority: string | null }>()
    const sourceCountByProperty = new Map<string, number>()
    if (ids.length > 0) {
      const { data: history } = await supabaseAdmin
        .from('property_price_history')
        .select('market_property_id, old_price, new_price, variation_amount, variation_percent, detected_at')
        .in('market_property_id', ids)
      for (const row of history ?? []) {
        const key = row.market_property_id as string
        if (!historyByProperty.has(key)) historyByProperty.set(key, [])
        historyByProperty.get(key)!.push(row as PriceHistoryRow)
      }

      const { data: opportunities } = await supabaseAdmin
        .from('opportunities')
        .select('id, market_property_id, title, stage, priority, created_at')
        .in('market_property_id', ids)
        .order('created_at', { ascending: false })

      for (const opportunity of opportunities ?? []) {
        const key = opportunity.market_property_id as string | null
        if (!key || opportunityByProperty.has(key)) continue
        opportunityByProperty.set(key, {
          id: opportunity.id as string,
          title: opportunity.title as string,
          stage: (opportunity.stage as string | null) ?? null,
          priority: (opportunity.priority as string | null) ?? null,
        })
      }

      const { data: sources } = await supabaseAdmin
        .from('market_property_sources')
        .select('market_property_id')
        .in('market_property_id', ids)

      for (const source of sources ?? []) {
        const key = source.market_property_id as string
        sourceCountByProperty.set(key, (sourceCountByProperty.get(key) ?? 0) + 1)
      }
    }

    // Sous-évaluation : médiane prix/m² par zone sur le set retourné (zone filtrée).
    const zoneMedians = buildZoneMedians(filtered)

    const withScore = filtered.map((property) => ({
      ...property,
      thumbnail_url: propertyThumbnailUrl(property.raw_json),
      mandate_score: scoreMarketProperty(property, historyByProperty.get(property.id) ?? []),
      undervaluation_pct: undervaluationPct(property.price_per_m2, zoneMedians.get(zoneKey(property))),
      opportunity: opportunityByProperty.get(property.id) ?? null,
      source_count: Math.max(1, sourceCountByProperty.get(property.id) ?? 0),
    }))

    return NextResponse.json({
      properties: withScore,
      total: count ?? withScore.length,
      page,
      limit,
    })
  } catch (e) {
    console.error('[API /market/properties]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/market/properties?scope=orphans
 * Purge explicitement les biens dont le code postal n'est surveillé par aucune zone.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope')

    if (scope !== 'orphans') {
      return NextResponse.json({ error: 'scope=orphans requis' }, { status: 400 })
    }

    const { data: zones, error: zonesError } = await supabaseAdmin
      .from('monitored_zones')
      .select('zipcode')

    if (zonesError) {
      console.error('[API /market/properties] zones read error:', zonesError)
      return NextResponse.json({ error: 'Erreur lecture zones' }, { status: 500 })
    }

    const monitoredZipcodes = new Set((zones ?? []).map((zone) => zone.zipcode).filter(Boolean))
    const { data: properties, error: propertiesError } = await supabaseAdmin
      .from('market_properties')
      .select('id, zipcode')
      .limit(10000)

    if (propertiesError) {
      console.error('[API /market/properties] orphan read error:', propertiesError)
      return NextResponse.json({ error: 'Erreur lecture biens' }, { status: 500 })
    }

    const orphanProperties = (properties ?? []).filter((property) => {
      if (!property.zipcode) return true
      return !monitoredZipcodes.has(property.zipcode)
    })
    const byZipcode = orphanProperties.reduce<Record<string, number>>((acc, property) => {
      const key = property.zipcode ?? 'sans_cp'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const purge = await purgeMarketPropertiesByIds(orphanProperties.map((property) => property.id))
    if (purge.error) {
      console.error('[API /market/properties] orphan purge error:', purge.error)
      return NextResponse.json({ error: 'Purge impossible', detail: purge.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted_properties: purge.deletedProperties,
      zipcodes: Object.entries(byZipcode)
        .map(([zipcode, count]) => ({ zipcode, count }))
        .sort((a, b) => b.count - a.count || a.zipcode.localeCompare(b.zipcode)),
    })
  } catch (e) {
    console.error('[API /market/properties] DELETE', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

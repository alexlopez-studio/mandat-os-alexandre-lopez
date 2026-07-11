// ═══════════════════════════════════════════════════════════════
// MandatFinder — Radar Queries
// Rôle : Requêtes pour le dashboard Radar MandatFinder
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import type { RadarListing, RadarFilters, SellerPhase, ListingEventType } from './types'

// ── Type helper pour tables non encore typées ──────────────
const db = {
    listings: () => supabaseAdmin.from('listings' as unknown as any) as any,
    listing_events: () => supabaseAdmin.from('listing_events' as unknown as any) as any,
    seller_scores: () => supabaseAdmin.from('seller_scores' as unknown as any) as any,
}

// ── Helpers ─────────────────────────────────────────────────

function buildRadarListing(row: Record<string, unknown>): RadarListing {
    return {
        id: String(row.id ?? ''),
        external_id: String(row.external_id ?? ''),
        title: (row.title as string) ?? null,
        city: (row.city as string) ?? null,
        zipcode: (row.zipcode as string) ?? null,
        property_type: (row.property_type as string) ?? null,
        price: (row.price as number) ?? null,
        surface: (row.surface as number) ?? null,
        rooms: (row.rooms as number) ?? null,
        url: (row.url as string) ?? null,
        status: (row.status as RadarListing['status']) ?? 'active',
        first_seen_at: String(row.first_seen_at ?? ''),
        last_seen_at: String(row.last_seen_at ?? ''),
        days_online: Number(row.days_online ?? 0),
        score: Number(row.score ?? 0),
        phase: (row.phase as SellerPhase) ?? 'cold',
        price_drops_count: Number(row.price_drops_count ?? 0),
        last_price_drop_percent: (row.last_price_drop_percent as number) ?? null,
        total_drop_percent: (row.total_drop_percent as number) ?? null,
        is_relisted: Boolean(row.is_relisted),
        last_event: (row.last_event as ListingEventType) ?? null,
    }
}

// ── Queries ─────────────────────────────────────────────────

/**
 * Récupère les listings avec leur dernier score pour le radar.
 * Jointure entre listings et seller_scores.
 */
export async function getRadarListings(
    filters: RadarFilters = {},
): Promise<{ data: RadarListing[]; total: number }> {
    let query = db.listings()
        .select(`
            *,
            seller_scores!inner (
                score, time_score, frustration_score, drop_intensity_score, behavior_score, phase, breakdown
            )
        `, { count: 'exact' })

    // Filtres
    if (filters.zipcodes && filters.zipcodes.length > 0) {
        query = query.in('zipcode', filters.zipcodes)
    }
    if (filters.property_types && filters.property_types.length > 0) {
        query = query.in('property_type', filters.property_types)
    }
    if (filters.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses)
    } else {
        query = query.in('status', ['active', 'relisted'])
    }
    if (filters.price_min !== undefined) {
        query = query.gte('price', filters.price_min)
    }
    if (filters.price_max !== undefined) {
        query = query.lte('price', filters.price_max)
    }

    const { data, count, error } = await query
        .order('last_seen_at', { ascending: false })
        .limit(filters.limit ?? 100)
        .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 100) - 1)

    if (error) throw error

    const listings = (data ?? []).map((row: Record<string, unknown>) => {
        const scores = Array.isArray(row.seller_scores) ? row.seller_scores[0] : row.seller_scores
        const lastScore = (scores as Record<string, unknown>) ?? {}
        const daysOnline = Math.floor(
            (new Date().getTime() - new Date(String(row.first_seen_at ?? '')).getTime()) /
            (1000 * 60 * 60 * 24),
        )

        return buildRadarListing({
            ...row,
            score: lastScore.score ?? 0,
            phase: lastScore.phase ?? 'cold',
            days_online: daysOnline,
            // Ces valeurs seront enrichies par les events
            price_drops_count: 0,
            last_price_drop_percent: null,
            total_drop_percent: null,
            is_relisted: false,
            last_event: null,
        })
    })

    // Filtres sur le score (post-query car c'est une jointure)
    const filtered = listings.filter((l: RadarListing) => {
        if (filters.min_score !== undefined && l.score < filters.min_score) return false
        if (filters.max_score !== undefined && l.score > filters.max_score) return false
        if (filters.phases && filters.phases.length > 0 && !filters.phases.includes(l.phase)) return false
        return true
    })

    return { data: filtered, total: count ?? filtered.length }
}

/**
 * Récupère les listings les plus chauds (score > 70).
 */
export async function getHotListings(limit = 20): Promise<RadarListing[]> {
    const { data } = await getRadarListings({ min_score: 70, limit })
    return data
}

/**
 * Récupère les listings avec baisse de prix cette semaine.
 */
export async function getPriceDropsThisWeek(limit = 20): Promise<RadarListing[]> {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: listingIds, error } = await db.listing_events()
        .select('listing_id')
        .eq('event_type', 'price_drop')
        .gte('detected_at', sevenDaysAgo.toISOString())

    if (error) throw error
    if (!listingIds || listingIds.length === 0) return []

    const ids = [...new Set(listingIds.map((e: { listing_id: string }) => e.listing_id))]

    const { data } = await getRadarListings({ limit })
    return data.filter((l) => ids.includes(l.id)).slice(0, limit)
}

/**
 * Récupère les listings retirés récemment.
 */
export async function getRemovedListings(limit = 20): Promise<RadarListing[]> {
    const { data: listingIds, error } = await db.listing_events()
        .select('listing_id')
        .in('event_type', ['listing_removed'])
        .order('detected_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    if (!listingIds || listingIds.length === 0) return []

    const ids = [...new Set(listingIds.map((e: { listing_id: string }) => e.listing_id))]

    const { data } = await getRadarListings({ statuses: ['removed', 'expired'], limit })
    return data.filter((l) => ids.includes(l.id)).slice(0, limit)
}

/**
 * Récupère les listings stagnants (90+ jours en ligne).
 */
export async function getStaleListings(limit = 20): Promise<RadarListing[]> {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data, error } = await db.listings()
        .select('id')
        .in('status', ['active', 'relisted'])
        .lte('first_seen_at', ninetyDaysAgo.toISOString())
        .limit(limit)

    if (error) throw error
    if (!data || data.length === 0) return []

    const ids = data.map((e: { id: string }) => e.id)

    const result = await getRadarListings({ limit })
    return result.data.filter((l) => ids.includes(l.id)).slice(0, limit)
}

/**
 * Récupère les listings republiés.
 */
export async function getRelistedListings(limit = 20): Promise<RadarListing[]> {
    const { data: listingIds, error } = await db.listing_events()
        .select('listing_id')
        .eq('event_type', 'listing_relisted')
        .order('detected_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    if (!listingIds || listingIds.length === 0) return []

    const ids = [...new Set(listingIds.map((e: { listing_id: string }) => e.listing_id))]

    const { data } = await getRadarListings({ limit })
    return data.filter((l) => ids.includes(l.id)).slice(0, limit)
}

/**
 * Agrégations pour les KPIs du dashboard.
 */
export async function getRadarKPIs(): Promise<{
    totalActive: number
    hotListings: number
    staleListings: number
    priceDropsThisWeek: number
    averageScore: number
}> {
    const [{ count: totalActive }, hot, stale, drops] = await Promise.all([
        db.listings()
            .select('*', { count: 'exact', head: true })
            .in('status', ['active', 'relisted']),
        getHotListings(100),
        getStaleListings(100),
        getPriceDropsThisWeek(100),
    ])

    // Score moyen des listings actifs
    const { data: avgData } = await db.seller_scores()
        .select('score')
        .order('calculated_at', { ascending: false })
        .limit(1000)

    const scores = (avgData ?? []).map((s: { score: number }) => s.score)
    const averageScore = scores.length > 0
        ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
        : 0

    return {
        totalActive: totalActive ?? 0,
        hotListings: hot.length,
        staleListings: stale.length,
        priceDropsThisWeek: drops.length,
        averageScore,
    }
}
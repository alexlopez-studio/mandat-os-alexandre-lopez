// ═══════════════════════════════════════════════════════════════
// API : Radar Listings
// Endpoint pour le dashboard Radar MandatFinder
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getRadarListings, getRadarKPIs } from '@/lib/mandat/radar-queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/radar/listings
 * Récupère les listings du radar avec filtres optionnels.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const mode = searchParams.get('mode') ?? 'listings'

        // Mode KPIs
        if (mode === 'kpis') {
            const kpis = await getRadarKPIs()
            return NextResponse.json({ success: true, data: kpis })
        }

        // Filtres
        const zipcodes = searchParams.get('zipcodes')?.split(',').filter(Boolean)
        const propertyTypes = searchParams.get('property_types')?.split(',').filter(Boolean)
        const phases = searchParams.get('phases')?.split(',').filter(Boolean) as any[]
        const minScore = searchParams.get('min_score')
        const maxScore = searchParams.get('max_score')
        const priceMin = searchParams.get('price_min')
        const priceMax = searchParams.get('price_max')
        const limit = searchParams.get('limit')
        const offset = searchParams.get('offset')

        const { data, total } = await getRadarListings({
            zipcodes,
            property_types: propertyTypes,
            phases,
            min_score: minScore ? Number(minScore) : undefined,
            max_score: maxScore ? Number(maxScore) : undefined,
            price_min: priceMin ? Number(priceMin) : undefined,
            price_max: priceMax ? Number(priceMax) : undefined,
            limit: limit ? Number(limit) : 100,
            offset: offset ? Number(offset) : 0,
        })

        return NextResponse.json({
            success: true,
            data,
            total,
            limit: limit ? Number(limit) : 100,
            offset: offset ? Number(offset) : 0,
        })
    } catch (error) {
        console.error('[API] Erreur radar listings:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Erreur inconnue',
            },
            { status: 500 },
        )
    }
}
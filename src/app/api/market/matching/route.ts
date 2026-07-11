/**
 * GET /api/market/matching — Récupère les résultats de matching
 * POST /api/market/matching — Exécute le matching pour un acheteur ou un bien
 *
 * Query params (GET) :
 *   buyer_lead_id  — Filtrer les résultats pour un acheteur
 *   property_id    — Filtrer les résultats pour un bien (market ou seller)
 *   min_score      — Seuil minimum de score (défaut: 40)
 *   limit          — Nombre max de résultats (défaut: 50)
 *
 * Body (POST /matching/run) :
 *   buyer_lead_id  — ID du lead acheteur pour exécuter le matching
 *   property_id    — ID du bien pour matcher contre tous les acheteurs
 *   source         — 'market' | 'seller' (défaut: market)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { runMatchingForBuyer, runMatchingForProperty } from '@/lib/market/matching-engine'

/**
 * GET /api/market/matching
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const buyerLeadId = searchParams.get('buyer_lead_id')
    const propertyId = searchParams.get('property_id')
    const minScore = Math.max(0, Number(searchParams.get('min_score')) || 40)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const query = supabaseAdmin
      .from('match_results')
      .select('*')
      .gte('score', minScore)
      .order('score', { ascending: false })
      .limit(limit)

    if (buyerLeadId) {
      query.eq('buyer_lead_id', buyerLeadId)
    }

    if (propertyId) {
      query.or(`property_id.eq.${propertyId},seller_lead_id.eq.${propertyId}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[API /matching] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Enrichir les résultats avec les infos des biens
    const enriched = await enrichMatchResults(data ?? [])

    return NextResponse.json({
      matches: enriched,
      total: enriched.length,
    })
  } catch (e) {
    console.error('[API /matching] GET exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/matching
 * Exécute un matching (pour un acheteur ou pour un bien)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { buyer_lead_id, property_id, source } = body

    if (!buyer_lead_id && !property_id) {
      return NextResponse.json(
        { error: 'Il faut fournir buyer_lead_id ou property_id' },
        { status: 400 }
      )
    }

    // Cas 1 : Matching pour un acheteur
    if (buyer_lead_id) {
      const { data: criteria } = await supabaseAdmin
        .from('buyer_criteria')
        .select('*')
        .eq('lead_id', buyer_lead_id)
        .single()

      if (!criteria) {
        return NextResponse.json(
          { error: 'Aucun critère trouvé pour cet acheteur' },
          { status: 404 }
        )
      }

      const results = await runMatchingForBuyer({
        lead_id: criteria.lead_id,
        type_bien: criteria.type_bien,
        communes: criteria.communes,
        budget_max: criteria.budget_max,
        surface_min: criteria.surface_min,
        pieces_min: criteria.pieces_min,
        criteres: criteria.criteres,
      })

      return NextResponse.json({
        success: true,
        buyer_lead_id,
        matches_count: results.length,
        matches: results,
      })
    }

    // Cas 2 : Matching pour un bien (contre tous les acheteurs actifs)
    if (property_id) {
      const results = await runMatchingForProperty(
        property_id,
        source ?? 'market'
      )

      return NextResponse.json({
        success: true,
        property_id,
        source: source ?? 'market',
        matches_count: results.length,
        matches: results,
      })
    }
  } catch (e) {
    console.error('[API /matching] POST exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * Enrichit les résultats de matching avec les infos des biens
 */
async function enrichMatchResults(matches: any[]): Promise<any[]> {
  const marketIds = matches
    .filter((m) => m.property_type === 'market' && m.property_id)
    .map((m) => m.property_id)

  const sellerIds = matches
    .filter((m) => m.property_type === 'seller' && m.seller_lead_id)
    .map((m) => m.seller_lead_id)

  // Récupère les biens du marché
  const marketProperties: Record<string, any> = {}
  if (marketIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('market_properties')
      .select('id, title, city, zipcode, property_type, price, surface, rooms, price_per_m2, dpe, status, url')
      .in('id', marketIds)
    if (data) {
      for (const p of data) {
        marketProperties[p.id] = p
      }
    }
  }

  // Récupère les biens vendeurs
  const sellerProperties: Record<string, any> = {}
  if (sellerIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('seller_properties')
      .select('id, lead_id, type_bien, surface, nb_pieces, prix_estime, adresse, dpe, etat')
      .in('lead_id', sellerIds)
    if (data) {
      for (const p of data) {
        sellerProperties[p.lead_id] = p
      }
    }
  }

  return matches.map((m) => {
    const property = m.property_type === 'market'
      ? marketProperties[m.property_id] ?? null
      : sellerProperties[m.seller_lead_id] ?? null

    return {
      ...m,
      property,
    }
  })
}
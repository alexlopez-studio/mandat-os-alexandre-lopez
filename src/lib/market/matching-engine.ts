/**
 * Matching Engine — Moteur de matching acquéreur / vendeur
 *
 * Algorithme de scoring qui prend les critères d'un acheteur et trouve
 * les biens (marché ou vendeurs) les plus pertinents.
 *
 * Pondérations :
 * - Commune : 30 points
 * - Type de bien : 20 points
 * - Budget : 25 points
 * - Surface : 15 points
 * - Pièces : 10 points
 * Total : 100 points
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

export interface BuyerCriteria {
  lead_id: string
  type_bien?: string | null
  communes?: string[] | null
  budget_max?: number | null
  surface_min?: number | null
  pieces_min?: number | null
  criteres?: string[] | null
}

export interface MatchableProperty {
  id: string
  city: string | null
  zipcode: string | null
  property_type: string | null
  price: number | null
  surface: number | null
  rooms: number | null
  source: 'market' | 'seller'
  seller_lead_id?: string | null
  title?: string | null
}

export interface MatchScore {
  property_id: string
  seller_lead_id: string | null
  property_type: 'market' | 'seller'
  score: number
  score_details: {
    commune: number
    type: number
    budget: number
    surface: number
    pieces: number
  }
  matched_commune: boolean
  matched_type: boolean
  matched_budget: boolean
  matched_surface: boolean
  matched_pieces: boolean
  property: MatchableProperty
}

const WEIGHTS = {
  COMMUNE: 30,
  TYPE: 20,
  BUDGET: 25,
  SURFACE: 15,
  PIECES: 10,
}

/**
 * Normalise une chaîne pour la comparaison (accentuations, casse)
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
}

/**
 * Vérifie si une commune est dans la liste des communes recherchées
 */
function communeMatches(propertyCity: string | null, communes: string[]): boolean {
  if (!propertyCity) return false
  const normalizedPropertyCity = normalize(propertyCity)
  return communes.some((c) => {
    // compare sur des sous-chaînes pour les cas comme "Cotignac" dans "Cotignac (83570)"
    return normalizedPropertyCity.includes(normalize(c)) || normalize(c).includes(normalizedPropertyCity)
  })
}

/**
 * Vérifie si le type de bien correspond
 */
function typeMatches(propertyType: string | null, buyerType: string): boolean {
  if (!propertyType) return false
  const normType = normalize(propertyType)
  const normBuyer = normalize(buyerType)
  // "maison" match "maison", "maison_de_village", "maison mitoyenne", etc.
  if (normType === normBuyer) return true
  if (normType.includes(normBuyer) || normBuyer.includes(normType)) return true
  return false
}

/**
 * Calcule le score de matching pour un bien donné
 */
function calculateMatchScore(
  criteria: BuyerCriteria,
  property: MatchableProperty
): Omit<MatchScore, 'property'> {
  const details = { commune: 0, type: 0, budget: 0, surface: 0, pieces: 0 }

  // 1. Commune (30 pts)
  const matchedCommune = criteria.communes && criteria.communes.length > 0
    ? communeMatches(property.city, criteria.communes)
    : true // pas de critère commune = score neutre
  if (matchedCommune) details.commune = WEIGHTS.COMMUNE

  // 2. Type de bien (20 pts)
  const matchedType = criteria.type_bien
    ? typeMatches(property.property_type, criteria.type_bien)
    : true
  if (matchedType) details.type = WEIGHTS.TYPE

  // 3. Budget (25 pts)
  let matchedBudget = true
  if (criteria.budget_max && property.price) {
    // Le prix doit être ≤ budget max (avec une tolérance de 10% au cas où)
    matchedBudget = property.price <= criteria.budget_max * 1.1
    if (matchedBudget) {
      // Score proportionnel : plus on est dans le budget, mieux c'est
      const ratio = property.price / criteria.budget_max
      details.budget = ratio <= 0.5
        ? WEIGHTS.BUDGET // bien en dessous du budget = parfait
        : Math.round(WEIGHTS.BUDGET * (1 - (ratio - 0.5) * 0.5)) // dégressif
    }
  }
  if (matchedBudget && !details.budget) details.budget = WEIGHTS.BUDGET

  // 4. Surface (15 pts)
  let matchedSurface = true
  if (criteria.surface_min && property.surface) {
    matchedSurface = property.surface >= criteria.surface_min
    if (matchedSurface) {
      const ratio = criteria.surface_min / property.surface
      details.surface = ratio >= 0.8
        ? WEIGHTS.SURFACE // surface très proche ou supérieure
        : Math.round(WEIGHTS.SURFACE * ratio) // plus petit que souhaité mais acceptable
    }
  }
  if (matchedSurface && !details.surface) details.surface = WEIGHTS.SURFACE

  // 5. Pièces (10 pts)
  let matchedPieces = true
  if (criteria.pieces_min && property.rooms) {
    matchedPieces = property.rooms >= criteria.pieces_min
    if (matchedPieces) details.pieces = WEIGHTS.PIECES
  }
  if (matchedPieces && !details.pieces) details.pieces = WEIGHTS.PIECES

  const score = details.commune + details.type + details.budget + details.surface + details.pieces

  return {
    property_id: property.id,
    seller_lead_id: property.seller_lead_id ?? null,
    property_type: property.source,
    score,
    score_details: details,
    matched_commune: matchedCommune,
    matched_type: matchedType,
    matched_budget: matchedBudget,
    matched_surface: matchedSurface,
    matched_pieces: matchedPieces,
  }
}

/**
 * Récupère les biens du marché (market_properties) qui pourraient matcher
 */
async function fetchMarketProperties(criteria: BuyerCriteria): Promise<MatchableProperty[]> {
  const query = supabaseAdmin
    .from('market_properties')
    .select('id, city, zipcode, property_type, price, surface, rooms')
    .neq('status', 'ignore')
    .neq('status', 'expire')

  // Filtre par commune si spécifié
  if (criteria.communes && criteria.communes.length > 0) {
    // On cherche par code postal approximatif (via les communes ciblées)
    // On ne peut pas filtrer par array dans Supabase simplement,
    // donc on récupère un maximum de données et on filtre après
  }

  const { data: properties, error } = await query

  if (error) {
    console.error('[MatchingEngine] Erreur fetch market properties:', error)
    return []
  }

  return (properties ?? []).map((p) => ({
    id: p.id,
    city: p.city,
    zipcode: p.zipcode,
    property_type: p.property_type,
    price: p.price,
    surface: p.surface,
    rooms: p.rooms,
    source: 'market' as const,
    title: null,
  }))
}

/**
 * Récupère les biens des vendeurs (seller_properties)
 */
async function fetchSellerProperties(criteria: BuyerCriteria): Promise<MatchableProperty[]> {
  const query = supabaseAdmin
    .from('seller_properties')
    .select('id, lead_id, type_bien, surface, nb_pieces, prix_estime, adresse')
    .eq('actif', true)

  const { data: properties, error } = await query

  if (error) {
    console.error('[MatchingEngine] Erreur fetch seller properties:', error)
    return []
  }

  return (properties ?? []).map((p) => ({
    id: p.id,
    city: p.adresse, // on n'a pas de champ city séparé dans seller_properties
    zipcode: null,
    property_type: p.type_bien,
    price: p.prix_estime,
    surface: p.surface,
    rooms: p.nb_pieces,
    source: 'seller' as const,
    seller_lead_id: p.lead_id,
    title: null,
  }))
}

/**
 * Sauvegarde les résultats de matching en base
 */
async function saveMatchResults(
  buyerLeadId: string,
  scores: Array<Omit<MatchScore, 'property'>>
): Promise<void> {
  // Supprime les anciens résultats pour ce buyer
  await supabaseAdmin
    .from('match_results')
    .delete()
    .eq('buyer_lead_id', buyerLeadId)

  if (scores.length === 0) return

  // Insère les nouveaux résultats
  const { error } = await supabaseAdmin
    .from('match_results')
    .insert(scores.map((s) => ({
      buyer_lead_id: buyerLeadId,
      property_id: s.property_type === 'market' ? s.property_id : null,
      seller_lead_id: s.seller_lead_id,
      property_type: s.property_type,
      score: s.score,
      score_details: s.score_details as unknown as Json,
      matched_commune: s.matched_commune,
      matched_type: s.matched_type,
      matched_budget: s.matched_budget,
      matched_surface: s.matched_surface,
      matched_pieces: s.matched_pieces,
    })))

  if (error) {
    console.error('[MatchingEngine] Erreur sauvegarde match_results:', error)
  }

  // Met à jour le timestamp de matching
  await supabaseAdmin
    .from('buyer_criteria')
    .update({ matched_at: new Date().toISOString() })
    .eq('lead_id', buyerLeadId)
}

/**
 * Point d'entrée principal : exécute le matching pour un acheteur donné
 * et sauvegarde les résultats.
 */
export async function runMatchingForBuyer(
  criteria: BuyerCriteria,
  includeSellers: boolean = true,
  threshold: number = 40
): Promise<MatchScore[]> {
  // 1. Récupère les biens du marché
  const marketProperties = await fetchMarketProperties(criteria)

  // 2. Récupère les biens des vendeurs (optionnel)
  let sellerProperties: MatchableProperty[] = []
  if (includeSellers) {
    sellerProperties = await fetchSellerProperties(criteria)
  }

  // 3. Calcule les scores
  const allProperties = [...marketProperties, ...sellerProperties]
  const scores = allProperties.map((property) => ({
    ...calculateMatchScore(criteria, property),
    property,
  }))

  // 4. Filtre par seuil et trie par score descendant
  const filtered = scores
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)

  // 5. Sauvegarde en base
  await saveMatchResults(criteria.lead_id, filtered.map((f) => {
    const { property, ...rest } = f
    return rest
  }))

  return filtered
}

/**
 * Exécute le matching pour tous les acheteurs actifs contre un bien spécifique
 * Utile quand un nouveau bien apparaît (new_listing)
 */
export async function runMatchingForProperty(
  propertyId: string,
  source: 'market' | 'seller' = 'market'
): Promise<{ buyer_lead_id: string; score: number }[]> {
  // 1. Récupère le bien
  let property: MatchableProperty | null = null

  if (source === 'market') {
    const { data } = await supabaseAdmin
      .from('market_properties')
      .select('id, city, zipcode, property_type, price, surface, rooms')
      .eq('id', propertyId)
      .single()

    if (data) {
      property = { ...data, source: 'market' as const }
    }
  } else {
    const { data } = await supabaseAdmin
      .from('seller_properties')
      .select('id, lead_id, type_bien, surface, nb_pieces, prix_estime, adresse')
      .eq('id', propertyId)
      .single()

    if (data) {
      property = {
        id: data.id,
        city: data.adresse,
        zipcode: null,
        property_type: data.type_bien,
        price: data.prix_estime,
        surface: data.surface,
        rooms: data.nb_pieces,
        source: 'seller' as const,
        seller_lead_id: data.lead_id,
        title: null,
      }
    }
  }

  if (!property) return []

  // 2. Récupère tous les acheteurs actifs
  const { data: buyers } = await supabaseAdmin
    .from('buyer_criteria')
    .select('lead_id, type_bien, communes, budget_max, surface_min, pieces_min, criteres')
    .eq('active', true)

  if (!buyers || buyers.length === 0) return []

  // 3. Calcule le score pour chaque acheteur
  const results: { buyer_lead_id: string; score: number }[] = []

  for (const buyer of buyers) {
    const criteria: BuyerCriteria = {
      lead_id: buyer.lead_id,
      type_bien: buyer.type_bien,
      communes: buyer.communes,
      budget_max: buyer.budget_max,
      surface_min: buyer.surface_min,
      pieces_min: buyer.pieces_min,
      criteres: buyer.criteres,
    }

    const scoreResult = calculateMatchScore(criteria, property)

    // Sauvegarde le résultat individuel
    await supabaseAdmin
      .from('match_results')
      .upsert({
        buyer_lead_id: buyer.lead_id,
        property_id: source === 'market' ? property.id : null,
        seller_lead_id: source === 'seller' ? property.seller_lead_id : null,
        property_type: source,
        score: scoreResult.score,
        score_details: scoreResult.score_details as unknown as Json,
        matched_commune: scoreResult.matched_commune,
        matched_type: scoreResult.matched_type,
        matched_budget: scoreResult.matched_budget,
        matched_surface: scoreResult.matched_surface,
        matched_pieces: scoreResult.matched_pieces,
      }, {
        onConflict: 'buyer_lead_id, property_id, seller_lead_id, property_type',
        ignoreDuplicates: false,
      })

    if (scoreResult.score >= 40) {
      results.push({ buyer_lead_id: buyer.lead_id, score: scoreResult.score })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
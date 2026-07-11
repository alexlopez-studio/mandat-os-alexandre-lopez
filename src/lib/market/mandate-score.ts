// ═══════════════════════════════════════════════════════════════
// MandatFinder — Adaptateur de score sur market_properties
// Rôle : faire tourner le MandateProbabilityScore (lib/mandat/scoring-service)
//        sur les biens réellement synchronisés (table market_properties)
//        plutôt que sur les tables Radar (listings) absentes en base live.
// ═══════════════════════════════════════════════════════════════

import { calculateScore } from '@/lib/mandat/scoring-service'
import type { SellerScore } from '@/lib/mandat/types'

/** Ligne d'historique de prix telle qu'écrite par la sync Stream Estate. */
export interface PriceHistoryRow {
  old_price: number | null
  new_price: number | null
  variation_amount: number | null
  variation_percent: number | null
  detected_at?: string | null
}

/** Sous-ensemble d'un bien market_properties nécessaire au scoring. */
export interface ScorableProperty {
  id: string
  price?: number | null
  first_seen_at?: string | null
  last_seen_at?: string | null
  published_at?: string | null
  status?: string | null
}

/** Score enrichi des données dérivées affichables (jours en ligne, baisses). */
export type MandateScore = SellerScore & {
  days_online: number
  price_drops_count: number
  total_drop_percent: number
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

// Republication : une annonce retirée puis remise en ligne reçoit une nouvelle
// date de publication. Si `published_at` devient postérieur à `first_seen_at` de
// plus d'un jour, on considère le bien comme republié (axe Comportement).
const RELIST_MIN_GAP_MS = MS_PER_DAY

function computeIsRelisted(firstSeenAt?: string | null, publishedAt?: string | null): boolean {
  if (!firstSeenAt || !publishedAt) return false
  const first = new Date(firstSeenAt).getTime()
  const pub = new Date(publishedAt).getTime()
  if (Number.isNaN(first) || Number.isNaN(pub)) return false
  return pub - first >= RELIST_MIN_GAP_MS
}

/**
 * Nombre de jours depuis la première mise en ligne.
 * Pour un bien encore actif on compte jusqu'à aujourd'hui ; sinon jusqu'à la
 * dernière fois où on l'a vu en ligne (last_seen_at).
 * `market_properties` ne stocke pas de colonne days_online : on la dérive ici.
 */
export function computeDaysOnline(
  firstSeenAt?: string | null,
  lastSeenAt?: string | null,
  status?: string | null,
): number {
  if (!firstSeenAt) return 0
  const start = new Date(firstSeenAt).getTime()
  if (Number.isNaN(start)) return 0

  const stillActive = !status || status === 'active'
  const endRef = stillActive ? Date.now() : new Date(lastSeenAt ?? Date.now()).getTime()
  const end = Number.isNaN(endRef) ? Date.now() : endRef

  return Math.max(0, Math.floor((end - start) / MS_PER_DAY))
}

/**
 * Dérive le nombre de baisses et la baisse totale (%) depuis l'historique.
 * Une baisse = variation_percent < 0 (ou new_price < old_price).
 * La baisse totale est calculée du prix d'origine (le plus haut connu) au prix
 * courant, plus robuste que la somme des variations.
 */
function deriveDropMetrics(
  currentPrice: number,
  priceHistory: PriceHistoryRow[],
): { priceDropsCount: number; totalDropPercent: number } {
  if (priceHistory.length === 0) {
    return { priceDropsCount: 0, totalDropPercent: 0 }
  }

  const priceDropsCount = priceHistory.filter((row) => {
    if (row.variation_percent != null) return row.variation_percent < 0
    if (row.old_price != null && row.new_price != null) return row.new_price < row.old_price
    return false
  }).length

  // Prix d'origine = le plus haut prix connu (les old_price + le prix courant).
  const knownPrices = priceHistory
    .flatMap((row) => [row.old_price, row.new_price])
    .filter((p): p is number => typeof p === 'number' && p > 0)
  const originalPrice = Math.max(currentPrice > 0 ? currentPrice : 0, ...knownPrices)

  const totalDropPercent =
    originalPrice > 0 && currentPrice > 0 && originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 10000) / 100
      : 0

  return { priceDropsCount, totalDropPercent }
}

/**
 * Calcule le MandateProbabilityScore d'un bien market_properties.
 *
 * Axe Comportement : la republication est dérivée du décalage entre
 * `published_at` (mis à jour à chaque sync) et `first_seen_at` (figé). Une
 * republication avec baisse de prix concomitante vaut le signal maximal.
 */
export function scoreMarketProperty(
  property: ScorableProperty,
  priceHistory: PriceHistoryRow[] = [],
): MandateScore {
  const currentPrice = Number(property.price) || 0
  const daysOnline = computeDaysOnline(
    property.first_seen_at,
    property.last_seen_at,
    property.status,
  )
  const { priceDropsCount, totalDropPercent } = deriveDropMetrics(currentPrice, priceHistory)
  const isRelisted = computeIsRelisted(property.first_seen_at, property.published_at)
  const isRelistedWithNewPrice = isRelisted && totalDropPercent > 0

  const score = calculateScore({
    listingId: property.id,
    daysOnline,
    priceDropsCount,
    totalDropPercent,
    isRelisted,
    isRelistedWithNewPrice,
  })

  return {
    ...score,
    days_online: daysOnline,
    price_drops_count: priceDropsCount,
    total_drop_percent: totalDropPercent,
  }
}

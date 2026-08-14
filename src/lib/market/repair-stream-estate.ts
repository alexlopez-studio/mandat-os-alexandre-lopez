import { supabaseAdmin } from '@/lib/supabase'
import { evaluateListingQuality, normalizeListing, type ListingQualityOptions, type ListingRejectionReason } from '@/lib/stream-estate'
import { upsertStreamEstateListing } from '@/lib/market/upsert-listing'

export type RepairListingChange = {
  propertyId: string
  title: string | null
  city: string | null
  /** URL avant / après : révèle les fiches pointant vers une annonce morte. */
  urlBefore: string | null
  urlAfter: string | null
  priceBefore: number | null
  priceAfter: number | null
  sellerTypeBefore: string | null
  sellerTypeAfter: string | null
  expired: boolean
  reasons: ListingRejectionReason[]
}

export type RepairListingsResult = {
  scanned: number
  repaired: number
  expired: number
  unchanged: number
  skipped: number
  reasons: Partial<Record<ListingRejectionReason, number>>
  changes: RepairListingChange[]
}

type PropertyRow = {
  id: string
  title: string | null
  city: string | null
  zipcode: string | null
  url: string | null
  price: number | null
  seller_type: string | null
  status: string | null
  raw_json: unknown
}

/**
 * Recalcule les biens Stream Estate déjà en base à partir du `raw_json` conservé
 * lors de l'import : aucun appel à l'API, donc aucun item facturé.
 *
 * Corrige rétroactivement ce que l'ancienne normalisation ratait — URL et prix pris
 * sur `adverts[0]` même expirée, vendeur déduit de la première annonce, pièces/DPE
 * jamais mappés — et sort du marché les annonces que le crawler ne suit plus.
 */
export async function repairStreamEstateListings(options: {
  dryRun?: boolean
  quality?: ListingQualityOptions
  limit?: number
} = {}): Promise<RepairListingsResult> {
  const { dryRun = false, quality: qualityOptions, limit = 5000 } = options

  const { data, error } = await supabaseAdmin
    .from('market_properties')
    .select('id, title, city, zipcode, url, price, seller_type, status, raw_json')
    .eq('source', 'stream_estate')
    .limit(limit)

  if (error) throw new Error(`Lecture des biens impossible: ${error.message}`)

  const rows = (data ?? []) as PropertyRow[]
  const result: RepairListingsResult = {
    scanned: rows.length,
    repaired: 0,
    expired: 0,
    unchanged: 0,
    skipped: 0,
    reasons: {},
    changes: [],
  }

  for (const row of rows) {
    const raw = row.raw_json as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.adverts)) {
      result.skipped++
      continue
    }

    const listing = normalizeListing(raw)
    const quality = evaluateListingQuality(listing, qualityOptions)
    const expired = !quality.online

    for (const reason of quality.reasons) {
      result.reasons[reason] = (result.reasons[reason] ?? 0) + 1
    }

    const changed =
      (listing.url ?? null) !== row.url ||
      (listing.price ?? null) !== row.price ||
      (listing.sellerType ?? null) !== row.seller_type ||
      (expired && row.status === 'active')

    if (!changed) {
      result.unchanged++
      continue
    }

    result.changes.push({
      propertyId: row.id,
      title: row.title,
      city: row.city,
      urlBefore: row.url,
      urlAfter: listing.url ?? null,
      priceBefore: row.price,
      priceAfter: listing.price ?? null,
      sellerTypeBefore: row.seller_type,
      sellerTypeAfter: listing.sellerType ?? null,
      expired,
      reasons: quality.reasons,
    })

    if (expired) result.expired++
    else result.repaired++

    if (dryRun) continue

    // Réutilise le pipeline d'ingestion : diffusions, historique de prix et
    // re-scoring restent cohérents avec ce que produit un import normal.
    await upsertStreamEstateListing({
      listing,
      fallbackZipcode: row.zipcode ?? listing.zipcode ?? '',
      source: 'reconcile',
      eventType: expired ? 'ad.update.expired' : null,
    })
  }

  return result
}

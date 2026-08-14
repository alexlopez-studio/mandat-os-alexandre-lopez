import { supabaseAdmin } from '@/lib/supabase'
import type { StreamEstateEventType, StreamEstateListing } from '@/lib/stream-estate'
import { runMatchingForProperty } from '@/lib/market/matching-engine'
import { rescoreAndPersist } from '@/lib/market/mandate-score-persist'
import { ensurePropertySourceFromProperty, upsertPropertySource } from '@/lib/market/property-deduplication'

export type StreamEstateIngestSource = 'manual' | 'reconcile' | 'webhook'

export type UpsertStreamEstateListingInput = {
  listing: StreamEstateListing
  fallbackZipcode: string
  source: StreamEstateIngestSource
  eventType?: StreamEstateEventType | string | null
}

export type UpsertStreamEstateListingResult = {
  propertyId: string
  created: boolean
  updated: boolean
  priceChanged: boolean
  expired: boolean
  deduplicated: boolean
}

type ExistingListingRow = {
  id: string
  external_id?: string | null
  title?: string | null
  price: number | null
  published_at: string | null
  seller_type: string | null
  source?: string | null
  url?: string | null
  status?: string | null
  first_seen_at?: string | null
  last_seen_at?: string | null
  raw_json?: unknown
}

function pricePerM2(price?: number | null, surface?: number | null): number | null {
  return price && surface && surface > 0 ? Math.round(price / surface) : null
}

function terminalStatusFromEvent(eventType?: string | null): 'expired' | 'removed' | null {
  const normalized = String(eventType ?? '').toLowerCase()
  if (!normalized) return null
  if (normalized.includes('expired')) return 'expired'
  if (normalized.includes('removed') || normalized.includes('deleted') || normalized.includes('delete')) return 'removed'
  return null
}

function terminalStatusFromListing(status?: string | null): 'expired' | 'removed' | null {
  const normalized = String(status ?? '').toLowerCase()
  if (!normalized) return null
  if (normalized === 'expired' || normalized === 'expire') return 'expired'
  if (['removed', 'deleted', 'offline', 'inactive', 'archived'].includes(normalized)) return 'removed'
  return null
}

/**
 * Enregistre chaque portail où le bien est diffusé. La fiche ne montre qu'une URL
 * (celle de l'annonce de référence) mais on garde la trace des autres : c'est ce qui
 * permet de voir la multi-diffusion et de savoir quelles annonces sont mortes.
 */
async function recordAllAdverts(propertyId: string, listing: StreamEstateListing, now: string) {
  for (const advert of listing.adverts) {
    if (!advert.url && !advert.uuid) continue
    await upsertPropertySource({
      propertyId,
      source: 'stream_estate',
      externalId: advert.uuid ?? null,
      url: advert.url,
      title: advert.title,
      price: advert.price,
      status: advert.expired ? 'expired' : 'active',
      publishedAt: advert.createdAt,
      firstSeenAt: advert.createdAt || now,
      lastSeenAt: advert.lastCrawledAt || now,
      rawJson: (advert.raw ?? {}) as never,
    })
  }
}

function normalizedText(value?: string | null): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function findExistingListing(
  listing: StreamEstateListing,
  externalId: string,
  fallbackZipcode: string,
): Promise<{ row: ExistingListingRow | null; deduplicated: boolean }> {
  const select = 'id, external_id, source, title, price, published_at, seller_type, url, status, first_seen_at, last_seen_at, raw_json'

  const byExternalId = await supabaseAdmin
    .from('market_properties')
    .select(select)
    .eq('external_id', externalId)
    .eq('source', 'stream_estate')
    .maybeSingle()

  if (byExternalId.error) {
    throw new Error(`Lecture bien ${externalId} impossible: ${byExternalId.error.message}`)
  }
  if (byExternalId.data) return { row: byExternalId.data as ExistingListingRow, deduplicated: false }

  if (listing.url) {
    const byUrl = await supabaseAdmin
      .from('market_properties')
      .select(select)
      .eq('url', listing.url)
      .eq('source', 'stream_estate')
      .maybeSingle()

    if (byUrl.error) {
      throw new Error(`Lecture doublon URL ${externalId} impossible: ${byUrl.error.message}`)
    }
    if (byUrl.data) return { row: byUrl.data as ExistingListingRow, deduplicated: true }
  }

  const geoColumn = listing.inseeCode ? 'insee_code' : 'zipcode'
  const geoValue = listing.inseeCode || listing.zipcode || fallbackZipcode
  const hasUsefulSurface = listing.surface != null || listing.landSurface != null
  if (!geoValue || listing.price == null || !listing.propertyType || !hasUsefulSurface) {
    return { row: null, deduplicated: false }
  }

  let signatureQuery = supabaseAdmin
    .from('market_properties')
    .select('id, external_id, title, price, published_at, seller_type, surface, land_surface, rooms, property_type')
    .eq('source', 'stream_estate')
    .eq(geoColumn, geoValue)
    .eq('property_type', listing.propertyType)
    .eq('price', listing.price)

  if (listing.surface != null) signatureQuery = signatureQuery.eq('surface', listing.surface)
  if (listing.landSurface != null) signatureQuery = signatureQuery.eq('land_surface', listing.landSurface)
  if (listing.rooms != null) signatureQuery = signatureQuery.eq('rooms', listing.rooms)

  const bySignature = await signatureQuery.limit(5)
  if (bySignature.error) {
    throw new Error(`Lecture doublon signature ${externalId} impossible: ${bySignature.error.message}`)
  }

  const incomingTitle = normalizedText(listing.title)
  const duplicate = (bySignature.data ?? []).find((row) => {
    const existingTitle = normalizedText(row.title)
    return !incomingTitle || !existingTitle || incomingTitle === existingTitle
  })

  return duplicate
    ? { row: duplicate as ExistingListingRow, deduplicated: true }
    : { row: null, deduplicated: false }
}

/**
 * Ancienneté à partir de laquelle un bien en agence devient un signal : le mandat
 * traîne, le vendeur peut vouloir changer d'agence. Aligné sur le palier haut de
 * l'axe « Temps » du mandate_score (30 points dès 90 jours).
 */
const AGENCY_NOTIFY_MIN_DAYS = 90

function daysSince(value?: string | null): number | null {
  if (!value) return null
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return null
  return Math.floor((Date.now() - time) / 86_400_000)
}

async function notifyNewListing(propertyId: string, listing: StreamEstateListing, fallbackZipcode: string) {
  const fmtPrice = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const isPap = listing.sellerType === 'individual'
  const daysOnline = daysSince(listing.publishedAt)

  // Une commune compte typiquement 10× plus de biens en agence que de PAP :
  // tout notifier noierait les vrais signaux. Un bien en agence n'est notifié
  // qu'une fois le mandat installé dans la durée — c'est là qu'il devient une
  // opportunité de reprise. Le mandate_score continue de tous les classer.
  const isAgedAgencyListing = daysOnline !== null && daysOnline >= AGENCY_NOTIFY_MIN_DAYS
  if (!isPap && !isAgedAgencyListing) return

  const where = [listing.city, listing.zipcode ?? fallbackZipcode].filter(Boolean).join(' ')
  const sellerLabel = isPap ? ' · Particulier' : listing.sellerType === 'agency' ? ' · Mandataire/pro' : ''
  const ageLabel = !isPap && daysOnline !== null ? ` · en vente depuis ${daysOnline} j` : ''

  const { error } = await supabaseAdmin.from('notifications').insert({
    type: 'new_listing',
    title: isPap
      ? `Nouveau bien : ${listing.title ?? 'annonce'}`
      : `Mandat qui traîne : ${listing.title ?? 'annonce'}`,
    message: `${where}${listing.price ? ` — ${fmtPrice.format(listing.price)}` : ''}${sellerLabel}${ageLabel}`,
    priority: isPap ? 'high' : 'medium',
    market_property_id: propertyId,
    status: 'unread',
    action_label: 'Voir le bien',
  } as never)

  if (error) {
    console.error(`[upsertStreamEstateListing] notification ${propertyId}:`, error.message)
  }
}

async function runBuyerMatching(propertyId: string) {
  runMatchingForProperty(propertyId, 'market').then(async (matches) => {
    const goodMatches = matches.filter((m) => m.score >= 60)
    if (goodMatches.length === 0) return

    const { data: propertyInfo } = await supabaseAdmin
      .from('market_properties')
      .select('title, city, price')
      .eq('id', propertyId)
      .single()

    const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

    for (const match of goodMatches) {
      await supabaseAdmin.from('notifications').insert({
        type: 'matching_buyer',
        title: 'Nouveau bien matché pour un acheteur',
        message: `${propertyInfo?.title ?? 'Nouveau bien'} à ${propertyInfo?.city ?? ''} — ${propertyInfo?.price ? formatter.format(propertyInfo.price) : ''} — Score: ${match.score}%`,
        priority: match.score >= 80 ? 'high' : 'medium',
        market_property_id: propertyId,
        status: 'unread',
        action_label: 'Voir le matching',
      } as never)
    }
  }).catch((err) =>
    console.error('[upsertStreamEstateListing] matching auto:', err)
  )
}

export async function upsertStreamEstateListing({
  listing,
  fallbackZipcode,
  eventType = null,
}: UpsertStreamEstateListingInput): Promise<UpsertStreamEstateListingResult> {
  const externalId = listing.externalId || listing.id
  if (!externalId) {
    throw new Error('Stream Estate listing sans external_id')
  }

  const now = new Date().toISOString()
  const terminalStatus = terminalStatusFromEvent(eventType) ?? terminalStatusFromListing(listing.status)
  const expired = terminalStatus !== null
  const nextStatus = terminalStatus ?? (listing.status ?? 'active')
  const nextPricePerM2 = pricePerM2(listing.price, listing.surface)
  // Date de retrait réelle quand Stream Estate la connaît, sinon l'instant du constat.
  const expiredAt = expired ? (listing.expiredAt || now) : null

  const { row: existing, deduplicated } = await findExistingListing(listing, externalId, fallbackZipcode)

  if (existing) {
    await ensurePropertySourceFromProperty(existing.id)
    await recordAllAdverts(existing.id, listing, now)

    const { error: updateError } = await supabaseAdmin
      .from('market_properties')
      .update({
        title: listing.title ?? null,
        description: listing.description ?? null,
        city: listing.city ?? null,
        zipcode: listing.zipcode ?? fallbackZipcode,
        insee_code: listing.inseeCode ?? null,
        lat: listing.lat ?? null,
        lon: listing.lon ?? null,
        property_type: listing.propertyType ?? null,
        price: listing.price ?? null,
        surface: listing.surface ?? null,
        price_per_m2: nextPricePerM2,
        land_surface: listing.landSurface ?? null,
        rooms: listing.rooms ?? null,
        bedrooms: listing.bedrooms ?? null,
        dpe: listing.dpe ?? null,
        ges: listing.ges ?? null,
        status: nextStatus,
        expired_at: expiredAt,
        last_seen_at: now,
        published_at: listing.publishedAt ?? existing.published_at ?? null,
        seller_type: listing.sellerType ?? existing.seller_type ?? null,
        url: listing.url ?? null,
        raw_json: (listing.raw ?? {}) as never,
      })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(`Mise à jour bien ${externalId} impossible: ${updateError.message}`)
    }

    let priceChanged = false
    if (existing.price != null && listing.price != null && existing.price !== listing.price) {
      const { error: historyError } = await supabaseAdmin
        .from('property_price_history')
        .insert({
          market_property_id: existing.id,
          old_price: existing.price,
          new_price: listing.price,
          variation_amount: listing.price - existing.price,
          variation_percent: existing.price > 0
            ? Math.round(((listing.price - existing.price) / existing.price) * 10000) / 100
            : 0,
        })

      if (historyError) {
        throw new Error(`Historique prix ${externalId} impossible: ${historyError.message}`)
      }
      priceChanged = true
    }

    await rescoreAndPersist(existing.id)

    return {
      propertyId: existing.id,
      created: false,
      updated: true,
      priceChanged,
      expired,
      deduplicated,
    }
  }

  const { data: newProperty, error: insertError } = await supabaseAdmin
    .from('market_properties')
    .insert({
      external_id: externalId,
      source: 'stream_estate',
      title: listing.title ?? null,
      description: listing.description ?? null,
      city: listing.city ?? null,
      zipcode: listing.zipcode ?? fallbackZipcode,
      insee_code: listing.inseeCode ?? null,
      lat: listing.lat ?? null,
      lon: listing.lon ?? null,
      property_type: listing.propertyType ?? null,
      price: listing.price ?? null,
      surface: listing.surface ?? null,
      price_per_m2: nextPricePerM2,
      land_surface: listing.landSurface ?? null,
      rooms: listing.rooms ?? null,
      bedrooms: listing.bedrooms ?? null,
      dpe: listing.dpe ?? null,
      ges: listing.ges ?? null,
      url: listing.url ?? null,
      status: nextStatus,
      first_seen_at: listing.publishedAt || now,
      last_seen_at: now,
      published_at: listing.publishedAt || null,
      expired_at: expiredAt,
      seller_type: listing.sellerType ?? null,
      raw_json: (listing.raw ?? {}) as never,
    })
    .select('id')
    .single()

  if (insertError || !newProperty?.id) {
    throw new Error(`Création bien ${externalId} impossible: ${insertError?.message ?? 'id manquant'}`)
  }

  const propertyId = newProperty.id as string
  await recordAllAdverts(propertyId, listing, now)

  const { error: tagError } = await supabaseAdmin
    .from('property_tags')
    .insert({
      market_property_id: propertyId,
      tag: 'Nouvelle annonce',
      source: 'system',
    })

  if (tagError) {
    throw new Error(`Tag bien ${externalId} impossible: ${tagError.message}`)
  }

  if (!terminalStatus) {
    await runBuyerMatching(propertyId)
    await notifyNewListing(propertyId, listing, fallbackZipcode)
  }
  await rescoreAndPersist(propertyId)

  return {
    propertyId,
    created: true,
    updated: false,
    priceChanged: false,
    expired,
    deduplicated: false,
  }
}

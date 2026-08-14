import { env } from './env'

// ── Types Stream Estate ────────────────────────────────────

/** Gagnabilité du mandat : 'individual' (PAP) | 'agency' | null (inconnu). */
export type SellerType = 'individual' | 'agency' | null

/**
 * Une diffusion de l'annonce sur un portail donné. Une propriété Stream Estate
 * en contient N (leboncoin, seloger, bienici…), chacune avec son propre cycle de
 * vie : `expired` et `lastCrawledAt` sont portés par l'annonce, pas par le bien.
 */
export interface StreamEstateAdvert {
  uuid?: string
  url?: string
  /** Portail lisible déduit de l'URL (Leboncoin, SeLoger…), pour l'affichage. */
  portal: string
  title?: string
  description?: string
  price?: number
  surface?: number
  landSurface?: number
  rooms?: number
  bedrooms?: number
  /** Classe DPE (`energy.category`). */
  dpe?: string
  /** Classe GES (`greenHouseGas.category`). */
  ges?: string
  constructionYear?: number
  images: string[]
  publisherType: number | null
  publisherCategory?: string
  publisherName?: string
  contactName?: string
  contactAgency?: string
  hasAgencyContact: boolean
  /** Prix jugé cohérent par Stream Estate (null si l'info est absente). */
  coherentPrice: boolean | null
  expired: boolean
  expiredAt?: string
  createdAt?: string
  updatedAt?: string
  /** Dernier passage du crawler Stream Estate sur cette annonce. */
  lastCrawledAt?: string
  raw: Record<string, unknown>
}

export interface StreamEstateListing {
  id: string
  externalId?: string
  sellerType?: SellerType
  title?: string
  description?: string
  city?: string
  zipcode?: string
  inseeCode?: string
  lat?: number
  lon?: number
  propertyType?: string
  price?: number
  surface?: number
  landSurface?: number
  rooms?: number
  bedrooms?: number
  dpe?: string
  ges?: string
  url?: string
  status?: string
  images?: string[]
  publishedAt?: string
  updatedAt?: string
  /** Dernier passage du crawler (niveau bien = le plus récent de ses annonces). */
  lastCrawledAt?: string
  expiredAt?: string
  /** Toutes les diffusions connues, pour alimenter `market_property_sources`. */
  adverts: StreamEstateAdvert[]
  /** Diffusion retenue comme source de vérité (prix, URL, titre, photos). */
  referenceAdvert: StreamEstateAdvert | null
  /** Nombre de diffusions encore en ligne (`expired = false`). */
  onlineAdvertCount: number
  /** Cohérence du prix de l'annonce de référence. */
  coherentPrice: boolean | null
  raw?: Record<string, unknown>
}

export interface StreamEstateSyncParams {
  zipcode: string
  /** Code INSEE de la commune. Si fourni, on filtre via includedInseeCodes[] (commune exacte). */
  inseeCode?: string | null
  /** Codes numériques Stream Estate : Appartement 0, Maison 1, … Défaut : [0, 1]. */
  propertyTypes?: number[]
  /** Type d'annonceur Stream Estate : Particulier 0, Professionnel 1. Défaut : [0] (PAP). */
  publisherTypes?: number[]
  transactionType?: 0 | 1 | null  // 0 = vente, 1 = location
  maxItems?: number
  fromDate?: string | null
  fromUpdatedAt?: string | null
  source?: 'manual' | 'reconcile' | 'webhook'
  /** Critères de qualité appliqués avant l'ingestion (cf. `evaluateListingQuality`). */
  quality?: ListingQualityOptions
  beforeRequest?: (ctx: StreamEstateRequestContext) => Promise<void> | void
  onRequest?: (event: StreamEstateRequestEvent) => Promise<void> | void
}

export interface StreamEstateSyncResult {
  listings: StreamEstateListing[]
  total: number
  page: number
  hasMore: boolean
  truncated: boolean
  externalRequests: number
  totalAvailable: number
  /** Items retournés par l'API (= items facturés), avant filtrage qualité. */
  billedItems: number
  /** Items écartés par le filtre qualité, ventilés par motif. */
  rejected: number
  rejectedReasons: Partial<Record<ListingRejectionReason, number>>
}

export interface StreamEstatePreviewResult {
  totalAvailable: number
  estimatedItems: number
  capped: boolean
  providerTotalAvailable: number
  breakdown: StreamEstatePreviewBreakdown
}

/** Ventilation gratuite (itemsPerPage=0) pour vérifier l'exactitude d'un comptage. */
export interface StreamEstatePreviewBreakdown {
  /** Annonces facturées : en ligne ET dans la fenêtre d'import. */
  onlineExact: number
  /** Toutes les annonces (incl. expirées, toutes périodes) sur la commune. */
  totalExact: number
  /**
   * `expired=false` sans fenêtre : le cumul historique. L'écart avec `onlineExact`
   * mesure les annonces que Stream Estate n'a jamais marquées expirées (88 à 94 %
   * des communes mesurées) — c'est ce qu'on évite de payer.
   */
  onlineAllTime: number
  /**
   * Estimation des biens réellement conservés après le filtre de fraîcheur.
   * Approximé par un comptage sur la fenêtre de fraîcheur : sur l'échantillon
   * mesuré, `updatedAt` et `lastCrawledAt` s'arrêtent ensemble (30/30).
   */
  estimatedKept: number
}

export type StreamEstateRequestContext = {
  zipcode: string
  endpoint: string
  page: number
  itemsPerPage: number
}

export type StreamEstateRequestEvent = StreamEstateRequestContext & {
  requestStatus: 'success' | 'error'
  startedAt: string
  finishedAt: string
  itemCount: number
  errorMessage?: string
}

export class StreamEstateRequestLimitError extends Error {
  code: string

  constructor(
    message = 'Plafond d’items Stream Estate atteint avant la fin de la pagination',
    code = 'stream_estate_item_limit_reached',
  ) {
    super(message)
    this.name = 'StreamEstateRequestLimitError'
    this.code = code
  }
}

export type StreamEstateEventType =
  | 'ad.update.price'
  | 'ad.update.surface'
  | 'ad.update.pictures'
  | 'ad.update.expired'
  | 'property.ad.create'
  | 'property.ad.update'

export type StreamEstateSavedSearchInput = {
  title: string
  zipcode: string
  inseeCode?: string | null
  propertyTypes?: number[]
  publisherTypes?: number[]
  transactionType?: 0 | 1
  endpointRecipient?: string | null
  eventEndpoint?: string | null
  subscribedEvents?: StreamEstateEventType[]
  notificationEnabled?: boolean
}

export type StreamEstateSavedSearch = {
  id: string
  title?: string
  token?: string
  raw: Record<string, unknown>
}

// ── Client ──────────────────────────────────────────────────

function getHeaders(accept = 'application/json'): Record<string, string> {
  if (!env.streamEstate.apiKey) {
    throw new Error('STREAMESTATE_API_KEY manquante dans les variables d’environnement')
  }

  return {
    'Content-Type': 'application/json',
    'X-API-KEY': env.streamEstate.apiKey,
    Accept: accept,
  }
}

const PAGE_SIZE = 30 // = itemsPerPage max autorisé par l'API → minimise le nombre de pages
const PROPERTIES_ENDPOINT = '/documents/properties'
// Codes Stream Estate : Appartement 0, Maison 1, Immeuble 2, Parking 3, Bureau 4, Terrain 5, Commerce 6
const DEFAULT_PROPERTY_TYPES = [0, 1, 5] // logements + terrains PAP, hors locaux pro/parkings/commerces
const DEFAULT_PUBLISHER_TYPES = [0] // PAP uniquement : 0=particulier, 1=professionnel

// ── Qualité des annonces ────────────────────────────────────

/**
 * Portails classés par priorité pour désigner l'annonce de référence d'un bien.
 * Leboncoin d'abord (annonce la plus consultée, souvent celle du propriétaire),
 * puis les portails PAP, puis les portails pro. Un portail inconnu passe en dernier.
 */
const PORTAL_PRIORITY = [
  'leboncoin',
  'entreparticuliers',
  'pap.fr',
  'paruvendu',
  'seloger',
  'bienici',
  'logic-immo',
  'superimmo',
  'figaro',
]

/**
 * Délai au-delà duquel une annonce non expirée est considérée hors ligne.
 * `expired` n'est positionné que si Stream Estate a *constaté* le retrait : une
 * annonce que leur crawler a cessé de suivre reste `expired = false` indéfiniment.
 * `lastCrawledAt` est donc le seul témoin fiable du « en ligne actuellement ».
 */
export const DEFAULT_MAX_CRAWL_AGE_DAYS = 90

export type ListingRejectionReason =
  | 'out_of_zone'
  | 'expired'
  | 'stale_crawl'
  | 'incoherent_price'
  | 'missing_price'
  | 'missing_url'
  | 'missing_surface'

export type ListingQualityOptions = {
  /** Ancienneté maximale du dernier crawl, en jours. `0` désactive le critère. */
  maxCrawlAgeDays?: number
  /** Écarte les annonces dont Stream Estate juge le prix incohérent. */
  requireCoherentPrice?: boolean
  now?: Date
}

export type ListingQuality = {
  online: boolean
  reasons: ListingRejectionReason[]
  crawlAgeDays: number | null
}

function hostnameOf(url?: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function portalRank(url?: string | null): number {
  const host = hostnameOf(url)
  if (!host) return PORTAL_PRIORITY.length + 1
  const index = PORTAL_PRIORITY.findIndex((portal) => host.includes(portal))
  return index === -1 ? PORTAL_PRIORITY.length : index
}

function timeValue(value?: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function ageInDays(value: string | undefined, now: Date): number | null {
  const time = timeValue(value)
  if (!time) return null
  return Math.max(0, Math.floor((now.getTime() - time) / 86_400_000))
}

/**
 * Décide si une annonce mérite d'entrer dans Mandat OS.
 * Le filtre `expired=false` de l'API ne suffit pas : il laisse passer les annonces
 * que le crawler a perdues de vue (donc vendues ou retirées sans constat).
 */
export function evaluateListingQuality(
  listing: StreamEstateListing,
  options: ListingQualityOptions = {},
): ListingQuality {
  const now = options.now ?? new Date()
  const maxCrawlAgeDays = options.maxCrawlAgeDays ?? DEFAULT_MAX_CRAWL_AGE_DAYS
  const requireCoherentPrice = options.requireCoherentPrice ?? true
  const reasons: ListingRejectionReason[] = []

  if (listing.status === 'expired' || listing.onlineAdvertCount === 0) {
    reasons.push('expired')
  }

  // Sans date de crawl connue (payload webhook allégé), on ne peut pas juger la
  // fraîcheur : on laisse passer plutôt que d'écarter un bien qui vient d'arriver.
  const crawlAgeDays = ageInDays(
    listing.lastCrawledAt ?? listing.updatedAt ?? listing.publishedAt,
    now,
  )
  if (maxCrawlAgeDays > 0 && crawlAgeDays !== null && crawlAgeDays > maxCrawlAgeDays) {
    reasons.push('stale_crawl')
  }

  if (requireCoherentPrice && listing.coherentPrice === false) reasons.push('incoherent_price')
  if (!listing.price) reasons.push('missing_price')
  if (!listing.url) reasons.push('missing_url')
  if (!listing.surface && !listing.landSurface) reasons.push('missing_surface')

  return { online: reasons.length === 0, reasons, crawlAgeDays }
}

type GeoTarget = { zipcode: string; inseeCode?: string | null }

export class StreamEstateGeoTargetError extends Error {
  code = 'stream_estate_insee_required'

  constructor(zipcode: string) {
    super(
      `Code INSEE requis pour cibler une commune (CP ${zipcode}). ` +
      `Le filtre par code postal de Stream Estate déborde très largement de la commune ` +
      `(mesuré : 4 140 biens sur le CP 83670 contre 164 sur l'INSEE 83095), ` +
      `ce qui multiplierait la facture par 25.`,
    )
    this.name = 'StreamEstateGeoTargetError'
  }
}

/**
 * Cible la commune exacte via includedInseeCodes[].
 *
 * Le repli historique sur includedZipcodes[] est condamné : ce filtre ne se limite
 * pas au code postal demandé (75001 renvoie ~9 700 biens, soit tout Paris). Un import
 * lancé dessus, en mode illimité, viderait le budget sur une seule zone.
 */
function appendGeoFilter(query: URLSearchParams, target: GeoTarget): void {
  if (!target.inseeCode) throw new StreamEstateGeoTargetError(target.zipcode)
  query.append('includedInseeCodes[]', target.inseeCode)
}

function appendPropertyTypes(query: URLSearchParams, propertyTypes: number[]): void {
  for (const code of propertyTypes) {
    query.append('propertyTypes[]', String(code))
  }
}

function appendPublisherTypes(query: URLSearchParams, publisherTypes: number[]): void {
  for (const code of publisherTypes) {
    query.append('publisherTypes[]', String(code))
  }
}

/** Filtre client de sûreté, en doublon du filtre serveur par INSEE. */
function matchesGeoTarget(listing: StreamEstateListing, target: GeoTarget): boolean {
  if (target.inseeCode) return listing.inseeCode === target.inseeCode
  return listing.zipcode === target.zipcode
}

type PageResult = {
  listings: StreamEstateListing[]
  hasMore: boolean
  totalAvailable: number
  /** Items facturés par l'API sur cette page, avant filtrage qualité. */
  billedItems: number
  rejected: number
  rejectedReasons: Partial<Record<ListingRejectionReason, number>>
}

async function fetchOnePage(
  target: GeoTarget,
  page: number,
  transactionType: number | null,
  propertyTypes: number[],
  publisherTypes: number[],
  itemsPerPage = PAGE_SIZE,
  opts: {
    fromDate?: string | null
    fromUpdatedAt?: string | null
    quality?: ListingQualityOptions
  } = {},
): Promise<PageResult> {
  const query = new URLSearchParams()
  appendGeoFilter(query, target)
  if (transactionType !== null && transactionType !== undefined) {
    query.set('transactionType', String(transactionType))
  }
  // expired=false : on ne récupère (et ne paie) que les annonces réellement en ligne.
  // C'est le filtre « en ligne » officiel de l'API (le champ status n'existe pas côté Stream Estate).
  query.set('expired', 'false')
  if (opts.fromDate) query.set('fromDate', opts.fromDate)
  if (opts.fromUpdatedAt) query.set('fromUpdatedAt', opts.fromUpdatedAt)
  query.set('page', String(page))
  query.set('itemsPerPage', String(itemsPerPage))
  appendPropertyTypes(query, propertyTypes)
  appendPublisherTypes(query, publisherTypes)

  const url = `${env.streamEstate.apiUrl}${PROPERTIES_ENDPOINT}?${query.toString()}`
  const res = await fetch(url, { method: 'GET', headers: getHeaders('application/ld+json'), cache: 'no-store' })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Stream Estate API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const rawListings: Record<string, unknown>[] = Array.isArray(data['hydra:member'])
    ? data['hydra:member']
    : Array.isArray(data)
      ? data
      : Array.isArray(data.listings)
        ? data.listings
        : Array.isArray(data.data)
          ? data.data
          : []

  const explicitTotal: number | undefined = data['hydra:totalItems'] ?? data.total ?? undefined

  // Filtrage qualité : les items sont facturés dès qu'ils sont retournés, donc on
  // écarte ici pour la base, pas pour le budget (cf. `billedItems`).
  const listings: StreamEstateListing[] = []
  const rejectedReasons: Partial<Record<ListingRejectionReason, number>> = {}
  let rejected = 0

  for (const raw of rawListings) {
    const listing = normalizeListing(raw)
    const reasons = matchesGeoTarget(listing, target)
      ? evaluateListingQuality(listing, opts.quality).reasons
      : (['out_of_zone'] as ListingRejectionReason[])

    if (reasons.length === 0) {
      listings.push(listing)
      continue
    }
    rejected++
    for (const reason of reasons) {
      rejectedReasons[reason] = (rejectedReasons[reason] ?? 0) + 1
    }
  }

  // hasMore : on se base sur le total quand il est connu (en utilisant la taille de page
  // réellement demandée), sinon on continue tant qu'une page pleine est retournée.
  const hasMore = explicitTotal !== undefined
    ? explicitTotal > page * itemsPerPage
    : rawListings.length === itemsPerPage

  return {
    listings,
    hasMore,
    totalAvailable: explicitTotal ?? rawListings.length,
    billedItems: rawListings.length,
    rejected,
    rejectedReasons,
  }
}

async function fetchTotalAvailable(
  target: GeoTarget,
  transactionType: number | null,
  propertyTypes: number[],
  publisherTypes: number[],
  opts: { expired?: boolean | null; fromUpdatedAt?: string | null } = {},
): Promise<number> {
  const query = new URLSearchParams()
  appendGeoFilter(query, target)
  if (transactionType !== null && transactionType !== undefined) {
    query.set('transactionType', String(transactionType))
  }
  // expired=false → en ligne uniquement ; null/undefined → tous (incl. expirées).
  if (opts.expired === true || opts.expired === false) {
    query.set('expired', String(opts.expired))
  }
  if (opts.fromUpdatedAt) query.set('fromUpdatedAt', opts.fromUpdatedAt)
  query.set('page', '1')
  // itemsPerPage=0 → l'API renvoie hydra:totalItems sans hydra:member : comptage gratuit
  // (facturation à l'item). Si l'API renvoyait quand même des biens, on les ignore.
  query.set('itemsPerPage', '0')
  appendPropertyTypes(query, propertyTypes)
  appendPublisherTypes(query, publisherTypes)

  const url = `${env.streamEstate.apiUrl}${PROPERTIES_ENDPOINT}?${query.toString()}`
  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders('application/ld+json'),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Stream Estate API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const explicitTotal = data['hydra:totalItems'] ?? data.total
  if (typeof explicitTotal === 'number' && Number.isFinite(explicitTotal)) {
    return explicitTotal
  }

  const rawListings: unknown[] = Array.isArray(data['hydra:member'])
    ? data['hydra:member']
    : Array.isArray(data)
      ? data
      : Array.isArray(data.listings)
        ? data.listings
        : Array.isArray(data.data)
          ? data.data
          : []

  return rawListings.length
}

/**
 * Prévisualisation 100% GRATUITE : uniquement des comptages `itemsPerPage=0`
 * (aucun item facturé). Renvoie une ventilation pour vérifier l'exactitude :
 * en ligne (expired=false) vs total (incl. expirées), et commune exacte (INSEE) vs CP.
 */
export async function previewListings(
  params: Pick<StreamEstateSyncParams, 'zipcode' | 'inseeCode' | 'propertyTypes' | 'publisherTypes' | 'transactionType' | 'maxItems' | 'fromUpdatedAt'> & {
    /** Fenêtre de fraîcheur servant à estimer ce qui sera réellement conservé. */
    keptFromUpdatedAt?: string | null
  },
): Promise<StreamEstatePreviewResult> {
  const {
    zipcode,
    inseeCode = null,
    propertyTypes = DEFAULT_PROPERTY_TYPES,
    publisherTypes = DEFAULT_PUBLISHER_TYPES,
    transactionType = 0,
    fromUpdatedAt = null,
    keptFromUpdatedAt = null,
  } = params
  const exactTarget: GeoTarget = { zipcode, inseeCode }
  const countWith = (opts: { expired?: boolean | null; fromUpdatedAt?: string | null }) =>
    fetchTotalAvailable(exactTarget, transactionType, propertyTypes, publisherTypes, opts)

  const [onlineExact, totalExact, onlineAllTime, estimatedKept] = await Promise.all([
    // Ce qui sera facturé : en ligne, dans la fenêtre d'import.
    countWith({ expired: false, fromUpdatedAt }),
    countWith({ expired: null }),
    // Sans fenêtre : mesure le cimetière qu'on évite de payer.
    fromUpdatedAt ? countWith({ expired: false }) : Promise.resolve(0),
    keptFromUpdatedAt ? countWith({ expired: false, fromUpdatedAt: keptFromUpdatedAt }) : Promise.resolve(0),
  ])

  const maxItems = params.maxItems != null ? Math.max(1, Math.floor(params.maxItems)) : null
  const estimatedItems = maxItems != null ? Math.min(onlineExact, maxItems) : onlineExact

  return {
    totalAvailable: onlineExact,
    estimatedItems,
    capped: maxItems != null && onlineExact > maxItems,
    providerTotalAvailable: totalExact,
    breakdown: {
      onlineExact,
      totalExact,
      onlineAllTime: fromUpdatedAt ? onlineAllTime : onlineExact,
      estimatedKept: keptFromUpdatedAt ? Math.min(estimatedKept, estimatedItems) : estimatedItems,
    },
  }
}

/**
 * Récupère les annonces Stream Estate pour un code postal donné.
 * Une synchronisation = un seul code postal. La pagination est plafonnée par maxItems.
 */
export async function fetchListings(
  params: StreamEstateSyncParams,
): Promise<StreamEstateSyncResult> {
  const {
    zipcode,
    inseeCode = null,
    propertyTypes = DEFAULT_PROPERTY_TYPES,
    publisherTypes = DEFAULT_PUBLISHER_TYPES,
    transactionType = 0,
    fromDate = null,
    fromUpdatedAt = null,
  } = params
  const target: GeoTarget = { zipcode, inseeCode }
  const maxItems = Math.max(1, Math.floor(params.maxItems ?? PAGE_SIZE))
  const listings: StreamEstateListing[] = []
  const rejectedReasons: Partial<Record<ListingRejectionReason, number>> = {}
  let externalRequests = 0
  let totalAvailable = 0
  let billedItems = 0
  let rejected = 0
  let hasMore = false
  let truncated = false

  // Taille de page constante : l'API pagine par offset, faire varier `itemsPerPage`
  // en cours de route décale les pages suivantes (doublons et trous). On s'arrête
  // donc avant toute page qui dépasserait le plafond d'items facturés.
  const itemsPerPage = Math.min(PAGE_SIZE, maxItems)

  for (let page = 1; billedItems + itemsPerPage <= maxItems; page++) {
    const context = { zipcode, endpoint: PROPERTIES_ENDPOINT, page, itemsPerPage }
    await params.beforeRequest?.(context)

    const startedAt = new Date().toISOString()
    try {
      const result = await fetchOnePage(target, page, transactionType, propertyTypes, publisherTypes, itemsPerPage, { fromDate, fromUpdatedAt, quality: params.quality })
      const finishedAt = new Date().toISOString()
      externalRequests++
      listings.push(...result.listings)
      billedItems += result.billedItems
      rejected += result.rejected
      for (const [reason, count] of Object.entries(result.rejectedReasons)) {
        const key = reason as ListingRejectionReason
        rejectedReasons[key] = (rejectedReasons[key] ?? 0) + count
      }
      if (page === 1) totalAvailable = result.totalAvailable
      hasMore = result.hasMore
      await params.onRequest?.({
        ...context,
        requestStatus: 'success',
        startedAt,
        // Facturation à l'item retourné : on compte le brut, pas ce qu'on garde.
        itemCount: result.billedItems,
        finishedAt,
      })
      if (!hasMore) break
    } catch (error) {
      const finishedAt = new Date().toISOString()
      externalRequests++
      const errorMessage = error instanceof Error ? error.message : String(error)
      await params.onRequest?.({
        ...context,
        requestStatus: 'error',
        startedAt,
        finishedAt,
        itemCount: 0,
        errorMessage,
      })
      throw error
    }
  }

  truncated = hasMore

  return {
    listings,
    total: listings.length,
    page: 1,
    hasMore,
    truncated,
    externalRequests,
    totalAvailable,
    billedItems,
    rejected,
    rejectedReasons,
  }
}

/** État courant d'une annonce, pour le suivi ciblé des leads connus. */
export interface StreamEstateLeadStatus {
  price?: number
  expired: boolean
  sellerType: SellerType
}

/**
 * Récupère l'état courant d'une annonce par son ID externe (1 item facturé).
 * Léger : sert au monitoring quotidien (prix + retrait) sans re-scanner la zone.
 */
export async function fetchListingStatusById(
  externalId: string,
): Promise<StreamEstateLeadStatus | null> {
  const url = `${env.streamEstate.apiUrl}/documents/properties/${encodeURIComponent(externalId)}`
  const res = await fetch(url, { method: 'GET', headers: getHeaders(), cache: 'no-store' })

  if (!res.ok) {
    if (res.status === 404) return null
    const text = await res.text().catch(() => '')
    throw new Error(`Stream Estate API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as Record<string, unknown>
  const adverts = Array.isArray(data.adverts) ? (data.adverts as Record<string, unknown>[]) : []
  const price = Number(adverts[0]?.price ?? data.price ?? data.prix ?? 0) || undefined
  const expired = data.expired === true
  return { price, expired, sellerType: mapSellerType(data) }
}

/**
 * Récupère le détail d'une annonce par son ID externe.
 */
export async function fetchListingById(
  externalId: string,
): Promise<StreamEstateListing | null> {
  const url = `${env.streamEstate.apiUrl}/documents/properties/${encodeURIComponent(externalId)}`

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    if (res.status === 404) return null
    const text = await res.text().catch(() => '')
    throw new Error(`Stream Estate API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return normalizeListing(data)
}

function savedSearchId(raw: Record<string, unknown>): string {
  const direct = raw.id ?? raw.uuid ?? raw.token
  if (direct) return String(direct)
  const iri = String(raw['@id'] ?? '')
  return iri.replace(/^\/searches\//, '')
}

export async function createSavedSearch(input: StreamEstateSavedSearchInput): Promise<StreamEstateSavedSearch> {
  const propertyTypes = input.propertyTypes ?? DEFAULT_PROPERTY_TYPES
  const publisherTypes = input.publisherTypes ?? DEFAULT_PUBLISHER_TYPES
  const subscribedEvents = input.subscribedEvents ?? [
    'property.ad.create',
    'ad.update.price',
    'ad.update.expired',
    'ad.update.surface',
    'ad.update.pictures',
    'property.ad.update',
  ]

  const body: Record<string, unknown> = {
    title: input.title,
    transactionType: input.transactionType ?? 0,
    propertyTypes,
    publisherTypes,
    includedZipcodes: [input.zipcode],
    notificationEnabled: input.notificationEnabled ?? Boolean(input.endpointRecipient || input.eventEndpoint),
    withCoherentPrice: true,
  }

  if (input.inseeCode) body.includedZipcodesInsee = [input.inseeCode]
  if (input.endpointRecipient) body.endpointRecipient = input.endpointRecipient
  if (input.eventEndpoint) {
    body.eventEndpoint = input.eventEndpoint
    body.subscribedEvents = subscribedEvents
  }

  const res = await fetch(`${env.streamEstate.apiUrl}/searches`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Stream Estate saved search error ${res.status}: ${text}`)
  }

  const raw = await res.json() as Record<string, unknown>
  return { id: savedSearchId(raw), title: String(raw.title ?? input.title), token: raw.token ? String(raw.token) : undefined, raw }
}

export async function listSavedSearches(): Promise<StreamEstateSavedSearch[]> {
  const res = await fetch(`${env.streamEstate.apiUrl}/searches`, {
    method: 'GET',
    headers: getHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Stream Estate saved searches error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const rows: Record<string, unknown>[] = Array.isArray(data['hydra:member'])
    ? data['hydra:member']
    : Array.isArray(data)
      ? data
      : Array.isArray(data.searches)
        ? data.searches
        : []

  return rows.map((raw) => ({
    id: savedSearchId(raw),
    title: raw.title ? String(raw.title) : undefined,
    token: raw.token ? String(raw.token) : undefined,
    raw,
  }))
}

export async function deleteSavedSearch(searchId: string): Promise<void> {
  const id = searchId.startsWith('/searches/') ? searchId : `/searches/${searchId}`
  const res = await fetch(`${env.streamEstate.apiUrl}${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    cache: 'no-store',
  })

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`Stream Estate delete saved search error ${res.status}: ${text}`)
  }
}

// ── Normalisation ───────────────────────────────────────────

/**
 * Libellés stockés dans `market_properties.property_type` pour des codes donnés.
 * Sert à cadrer une opération (réconciliation…) sur le périmètre réellement scanné.
 */
export function propertyTypeLabels(codes: number[]): string[] {
  return codes
    .map((code) => PROPERTY_TYPE_LABELS[code])
    .filter((label): label is string => Boolean(label))
}

/** Type de vendeur stocké en base pour un code annonceur Stream Estate. */
export function sellerTypesForPublisherTypes(
  publisherTypes: number[],
): Exclude<SellerType, null>[] {
  const types: Exclude<SellerType, null>[] = []
  if (publisherTypes.includes(0)) types.push('individual')
  if (publisherTypes.includes(1)) types.push('agency')
  return types
}

// Codes numériques Stream Estate → labels lisibles (cf. doc /documents/properties)
const PROPERTY_TYPE_LABELS: Record<number, string> = {
  0: 'Appartement',
  1: 'Maison',
  2: 'Immeuble',
  3: 'Parking',
  4: 'Bureau',
  5: 'Terrain',
  6: 'Commerce',
}

function numberOrUndefined(value: unknown): number | undefined {
  return Number(value ?? 0) || undefined
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

/** `energy` / `greenHouseGas` sont des objets `{ value, category }` chez Stream Estate. */
function energyCategory(value: unknown): string | undefined {
  if (value && typeof value === 'object') {
    const category = (value as Record<string, unknown>).category
    return String(category ?? '').trim().toUpperCase() || undefined
  }
  return String(value ?? '').trim().toUpperCase() || undefined
}

const PRIVATE_SELLER_RE = /particulier|propri[ée]taire|\bpap\b/i

/**
 * Type de vendeur porté par UNE diffusion.
 * Le contact prime sur `publisher.type` : ce dernier décrit le flux du portail
 * (SeLoger est typé « pro » même quand il diffuse l'annonce d'un particulier).
 */
function advertSellerType(advert: StreamEstateAdvert): SellerType {
  const category = String(advert.publisherCategory ?? '')
  if (PRIVATE_SELLER_RE.test(category)) return 'individual'
  if (/agence|professionnel|r[ée]seau|mandataire|promoteur/i.test(category)) return 'agency'

  const contact = `${advert.contactAgency ?? ''} ${advert.contactName ?? ''}`.trim()
  if (contact && PRIVATE_SELLER_RE.test(contact)) return 'individual'
  if (advert.hasAgencyContact) return 'agency'

  if (advert.publisherType === 1) return 'agency'
  if (advert.publisherType === 0) return 'individual'
  return null
}

export function normalizeAdvert(raw: Record<string, unknown>): StreamEstateAdvert {
  const publisher = (raw.publisher ?? {}) as Record<string, unknown>
  const contact = (raw.contact ?? {}) as Record<string, unknown>
  const url = String(raw.url ?? '') || undefined
  const publisherTypeRaw = Number(publisher.type)
  const images = stringList(raw.picturesRemote).length
    ? stringList(raw.picturesRemote)
    : stringList(raw.pictures ?? raw.photos)

  return {
    uuid: String(raw.uuid ?? '') || undefined,
    url,
    portal: portalLabel(url),
    title: String(raw.title ?? '') || undefined,
    description: String(raw.description ?? '') || undefined,
    price: numberOrUndefined(raw.price),
    surface: numberOrUndefined(raw.surface),
    landSurface: numberOrUndefined(raw.landSurface),
    rooms: numberOrUndefined(raw.room ?? raw.rooms),
    bedrooms: numberOrUndefined(raw.bedroom ?? raw.bedrooms),
    dpe: energyCategory(raw.energy),
    ges: energyCategory(raw.greenHouseGas),
    constructionYear: numberOrUndefined(raw.constructionYear),
    images,
    publisherType: Number.isFinite(publisherTypeRaw) ? publisherTypeRaw : null,
    publisherCategory: String(publisher.category ?? '') || undefined,
    publisherName: String(publisher.name ?? '') || undefined,
    contactName: String(contact.name ?? '') || undefined,
    contactAgency: String(contact.agency ?? '') || undefined,
    // Certains portails renseignent `agency` avec « Propriétaire particulier » :
    // c'est l'inverse d'une agence, on ne le compte pas comme un professionnel.
    hasAgencyContact: Boolean(contact.agency)
      && !PRIVATE_SELLER_RE.test(String(contact.agency)),
    coherentPrice: typeof raw.coherentPrice === 'boolean' ? raw.coherentPrice : null,
    expired: raw.expired === true,
    expiredAt: String(raw.expiredAt ?? '') || undefined,
    createdAt: String(raw.createdAt ?? '') || undefined,
    updatedAt: String(raw.updatedAt ?? '') || undefined,
    lastCrawledAt: String(raw.lastCrawledAt ?? '') || undefined,
    raw,
  }
}

/** Nom lisible du portail, déduit de l'URL de diffusion. */
export function portalLabel(url?: string | null): string {
  const host = hostnameOf(url)
  if (!host) return 'Source inconnue'
  if (host.includes('leboncoin')) return 'Leboncoin'
  if (host.includes('entreparticuliers')) return 'Entre Particuliers'
  if (host.includes('pap.fr')) return 'PAP'
  if (host.includes('paruvendu')) return 'ParuVendu'
  if (host.includes('seloger')) return 'SeLoger'
  if (host.includes('bienici')) return "Bien'ici"
  if (host.includes('logic-immo')) return 'Logic-Immo'
  if (host.includes('superimmo')) return 'SuperImmo'
  if (host.includes('figaro')) return 'Figaro Immobilier'
  return host
}

/**
 * Désigne la diffusion qui fait foi pour le prix, l'URL, le titre et les photos.
 * Priorité : annonce encore en ligne > portail le mieux classé > crawl le plus récent.
 * Sans cette sélection, `adverts[0]` renvoie souvent une annonce morte (URL cassée
 * et prix périmé) alors qu'une autre diffusion du même bien est toujours active.
 */
export function pickReferenceAdvert(adverts: StreamEstateAdvert[]): StreamEstateAdvert | null {
  if (adverts.length === 0) return null

  const byRelevance = (a: StreamEstateAdvert, b: StreamEstateAdvert) => {
    const rank = portalRank(a.url) - portalRank(b.url)
    if (rank !== 0) return rank
    const crawl = timeValue(b.lastCrawledAt) - timeValue(a.lastCrawledAt)
    if (crawl !== 0) return crawl
    return timeValue(b.updatedAt) - timeValue(a.updatedAt)
  }

  const online = adverts.filter((advert) => !advert.expired)
  if (online.length > 0) return [...online].sort(byRelevance)[0]

  // Aucune diffusion en ligne : on garde la plus récemment vue pour pouvoir
  // dater le retrait du marché, mais le bien sera écarté par le filtre qualité.
  return [...adverts].sort(
    (a, b) => timeValue(b.lastCrawledAt) - timeValue(a.lastCrawledAt),
  )[0]
}

/**
 * Type de vendeur agrégé sur les diffusions **encore en ligne**.
 * Une seule annonce PAP vivante suffit à qualifier le bien de PAP : c'est le
 * signal d'un propriétaire qui vend en direct, donc un mandat à aller chercher.
 */
export function sellerTypeFromAdverts(
  adverts: StreamEstateAdvert[],
  publisherTypes?: unknown,
): SellerType {
  const online = adverts.filter((advert) => !advert.expired)
  const pool = online.length > 0 ? online : adverts
  const types = pool.map(advertSellerType)

  if (types.includes('individual')) return 'individual'
  if (types.includes('agency')) return 'agency'

  if (Array.isArray(publisherTypes)) {
    const codes = publisherTypes.map(Number)
    if (codes.includes(0)) return 'individual'
    if (codes.includes(1)) return 'agency'
  }
  return null
}

/**
 * Déduit le type de vendeur d'un document Stream Estate complet.
 * Conservé pour les appels unitaires (`fetchListingStatusById`).
 */
export function mapSellerType(raw: Record<string, unknown>): SellerType {
  const adverts = Array.isArray(raw.adverts) ? (raw.adverts as Record<string, unknown>[]) : []
  return sellerTypeFromAdverts(adverts.map(normalizeAdvert), raw.publisherTypes)
}

export function normalizeListing(raw: Record<string, unknown>): StreamEstateListing {
  const adverts = (Array.isArray(raw.adverts) ? raw.adverts as Record<string, unknown>[] : [])
    .map(normalizeAdvert)
  const reference = pickReferenceAdvert(adverts)
  const onlineAdvertCount = adverts.reduce((count, advert) => count + (advert.expired ? 0 : 1), 0)

  // Photos : celles du bien sont consolidées par Stream Estate, on retombe sur
  // l'annonce de référence quand elles manquent.
  const propertyImages = stringList(raw.pictures ?? raw.photos ?? raw.images)
  const images = propertyImages.length > 0 ? propertyImages : (reference?.images ?? [])

  // Prix et URL viennent de l'annonce de référence : c'est la seule encore valable.
  const price = reference?.price ?? numberOrUndefined(raw.price ?? raw.prix)
  const url = reference?.url ?? String(raw.url ?? raw.source_url ?? '')

  const location = (raw.location ?? {}) as Record<string, unknown>

  const cityObj = (typeof raw.city === 'object' && raw.city !== null)
    ? raw.city as Record<string, unknown>
    : null
  const cityName  = String(cityObj?.name ?? cityObj?.originalName ?? raw.ville ?? '')
  const zipcode   = String(cityObj?.zipcode ?? raw.zipcode ?? raw.postalCode ?? raw.code_postal ?? '')
  const rawTitle  = String(reference?.title ?? raw.title ?? raw.titre ?? '').trim()
  const ptRaw     = raw.propertyType ?? raw.property_type ?? raw.type
  const ptNum     = typeof ptRaw === 'number' ? ptRaw : (ptRaw !== undefined ? Number(ptRaw) : NaN)
  const pType     = (!isNaN(ptNum) && PROPERTY_TYPE_LABELS[ptNum])
    ? PROPERTY_TYPE_LABELS[ptNum]
    : (typeof ptRaw === 'string' && ptRaw ? ptRaw : '')

  // Le document bien porte des valeurs consolidées, l'annonce de référence complète
  // les trous (`landSurface` et le DPE ne sont souvent renseignés qu'au niveau annonce).
  const surfaceN     = numberOrUndefined(raw.surface ?? raw.surface_habitable) ?? reference?.surface
  const roomsN       = numberOrUndefined(raw.room ?? raw.roomsCount ?? raw.rooms ?? raw.pieces) ?? reference?.rooms
  const bedroomsN    = numberOrUndefined(raw.bedroom ?? raw.bedroomsCount ?? raw.bedrooms ?? raw.chambres) ?? reference?.bedrooms
  const landSurfaceN = numberOrUndefined(raw.landSurface ?? raw.land_surface ?? raw.terrain) ?? reference?.landSurface
  const dpe          = energyCategory(raw.energy ?? raw.dpeValue ?? raw.dpe) ?? reference?.dpe ?? ''
  const ges          = energyCategory(raw.greenHouseGas ?? raw.gesValue ?? raw.ges) ?? reference?.ges ?? ''

  // Génère un titre lisible si Stream Estate retourne un titre trop générique ou vide
  function buildTitle(): string {
    if (rawTitle && rawTitle.length > 5 && !rawTitle.toLowerCase().includes('neuf à vendre')) return rawTitle
    const parts: string[] = []
    if (pType) parts.push(pType)
    if (roomsN) parts.push(`${roomsN} pièce${roomsN > 1 ? 's' : ''}`)
    if (surfaceN) parts.push(`${surfaceN} m²`)
    if (cityName) parts.push(`à ${cityName}`)
    return parts.length ? parts.join(' · ') : rawTitle || 'Bien immobilier'
  }

  // Fraîcheur mesurée sur les diffusions **encore en ligne** : le `lastCrawledAt`
  // d'une annonce expirée date du constat de retrait, il ferait passer pour vivant
  // un bien dont la seule annonce active n'a plus été vue depuis un an.
  const mostRecentCrawl = (pool: StreamEstateAdvert[]) =>
    pool
      .map((advert) => advert.lastCrawledAt ?? '')
      .filter(Boolean)
      .sort((a, b) => timeValue(b) - timeValue(a))[0]

  const onlineAdverts = adverts.filter((advert) => !advert.expired)
  const lastCrawledAt = onlineAdverts.length > 0
    ? mostRecentCrawl(onlineAdverts)
    : String(raw.lastCrawledAt ?? '') || mostRecentCrawl(adverts)

  // Un bien sans aucune diffusion vivante est sorti du marché, quoi qu'en dise
  // le flag `expired` du document.
  const offline = raw.expired === true || (adverts.length > 0 && onlineAdvertCount === 0)

  return {
    id: String(raw.uuid ?? raw.id ?? raw['@id'] ?? ''),
    externalId: String(raw.uuid ?? raw.id ?? raw.external_id ?? raw.externalId ?? ''),
    sellerType: sellerTypeFromAdverts(adverts, raw.publisherTypes),
    title: buildTitle(),
    description: String(reference?.description ?? raw.description ?? ''),
    city: cityName,
    zipcode,
    inseeCode: String(cityObj?.insee ?? raw.inseeCode ?? raw.insee_code ?? ''),
    lat: Number(location.lat ?? raw.lat ?? raw.latitude ?? 0) || undefined,
    lon: Number(location.lon ?? location.lng ?? raw.lon ?? raw.longitude ?? 0) || undefined,
    propertyType: pType,
    price,
    surface: surfaceN,
    landSurface: landSurfaceN,
    rooms: roomsN,
    bedrooms: bedroomsN,
    dpe,
    ges,
    url,
    status: offline ? 'expired' : String(raw.status ?? raw.statut ?? 'active'),
    images,
    publishedAt: (raw.published_at ?? raw.date_publication ?? raw.created_at ?? raw.createdAt) as string | undefined || undefined,
    updatedAt: (raw.updated_at ?? raw.date_mise_a_jour ?? raw.updatedAt) as string | undefined || undefined,
    lastCrawledAt: lastCrawledAt || undefined,
    expiredAt: String(raw.expiredAt ?? '') || reference?.expiredAt,
    adverts,
    referenceAdvert: reference,
    onlineAdvertCount,
    coherentPrice: reference?.coherentPrice ?? null,
    raw,
  }
}

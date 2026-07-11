import { env } from './env'

// ── Types Stream Estate ────────────────────────────────────

/** Gagnabilité du mandat : 'individual' (PAP) | 'agency' | null (inconnu). */
export type SellerType = 'individual' | 'agency' | null

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
  /** Annonces en ligne (expired=false) sur la cible exacte (INSEE si dispo, sinon CP). */
  onlineExact: number
  /** Toutes les annonces (incl. expirées) sur la même cible. */
  totalExact: number
  /** En ligne par code postal seul (communes voisines incluses) ; null si pas d'INSEE. */
  onlineByZipcode: number | null
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
const OFFLINE_STATUSES = new Set(['expired', 'removed', 'inactive', 'deleted', 'archived', 'closed', 'sold'])

type GeoTarget = { zipcode: string; inseeCode?: string | null }

/**
 * Ajoute le filtre géographique le plus fin possible :
 * - includedInseeCodes[] (commune exacte) si un code INSEE est disponible ;
 * - includedZipcodes[] (peut couvrir plusieurs communes) sinon.
 */
function appendGeoFilter(query: URLSearchParams, target: GeoTarget): void {
  if (target.inseeCode) {
    query.append('includedInseeCodes[]', target.inseeCode)
  } else {
    query.append('includedZipcodes[]', target.zipcode)
  }
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

/** Filtre client de sûreté : par INSEE si on a filtré par INSEE, sinon par CP. */
function matchesGeoTarget(listing: StreamEstateListing, target: GeoTarget): boolean {
  if (target.inseeCode) return listing.inseeCode === target.inseeCode
  return listing.zipcode === target.zipcode
}

function isOnlineListingStatus(status?: string | null): boolean {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized) return true
  return !OFFLINE_STATUSES.has(normalized)
}

async function fetchOnePage(
  target: GeoTarget,
  page: number,
  transactionType: number | null,
  propertyTypes: number[],
  publisherTypes: number[],
  itemsPerPage = PAGE_SIZE,
  opts: { fromDate?: string | null; fromUpdatedAt?: string | null } = {},
): Promise<{ listings: StreamEstateListing[]; hasMore: boolean; totalAvailable: number }> {
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
  const listings = rawListings
    .map(normalizeListing)
    .filter((listing) => matchesGeoTarget(listing, target))
    .filter((listing) => isOnlineListingStatus(listing.status))
  // hasMore : on se base sur le total quand il est connu (en utilisant la taille de page
  // réellement demandée), sinon on continue tant qu'une page pleine est retournée.
  const hasMore = explicitTotal !== undefined
    ? explicitTotal > page * itemsPerPage
    : rawListings.length === itemsPerPage
  return { listings, hasMore, totalAvailable: explicitTotal ?? listings.length }
}

async function fetchTotalAvailable(
  target: GeoTarget,
  transactionType: number | null,
  propertyTypes: number[],
  publisherTypes: number[],
  opts: { expired?: boolean | null } = {},
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
  params: Pick<StreamEstateSyncParams, 'zipcode' | 'inseeCode' | 'propertyTypes' | 'publisherTypes' | 'transactionType' | 'maxItems'>,
): Promise<StreamEstatePreviewResult> {
  const {
    zipcode,
    inseeCode = null,
    propertyTypes = DEFAULT_PROPERTY_TYPES,
    publisherTypes = DEFAULT_PUBLISHER_TYPES,
    transactionType = 0,
  } = params
  const exactTarget: GeoTarget = { zipcode, inseeCode }

  const [onlineExact, totalExact, onlineByZipcode] = await Promise.all([
    fetchTotalAvailable(exactTarget, transactionType, propertyTypes, publisherTypes, { expired: false }),
    fetchTotalAvailable(exactTarget, transactionType, propertyTypes, publisherTypes, { expired: null }),
    // Comparaison CP seul (communes voisines) seulement si on cible une commune par INSEE.
    inseeCode
      ? fetchTotalAvailable({ zipcode, inseeCode: null }, transactionType, propertyTypes, publisherTypes, { expired: false })
      : Promise.resolve<number | null>(null),
  ])

  const maxItems = params.maxItems != null ? Math.max(1, Math.floor(params.maxItems)) : null
  const estimatedItems = maxItems != null ? Math.min(onlineExact, maxItems) : onlineExact

  return {
    totalAvailable: onlineExact,
    estimatedItems,
    capped: maxItems != null && onlineExact > maxItems,
    providerTotalAvailable: totalExact,
    breakdown: { onlineExact, totalExact, onlineByZipcode },
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
  let externalRequests = 0
  let totalAvailable = 0
  let hasMore = false
  let truncated = false

  for (let page = 1; listings.length < maxItems; page++) {
    const itemsPerPage = Math.min(PAGE_SIZE, maxItems - listings.length)
    const context = { zipcode, endpoint: PROPERTIES_ENDPOINT, page, itemsPerPage }
    await params.beforeRequest?.(context)

    const startedAt = new Date().toISOString()
    try {
      const result = await fetchOnePage(target, page, transactionType, propertyTypes, publisherTypes, itemsPerPage, { fromDate, fromUpdatedAt })
      const finishedAt = new Date().toISOString()
      externalRequests++
      const remainingSlots = Math.max(0, maxItems - listings.length)
      const pageListings = result.listings.slice(0, remainingSlots)
      listings.push(...pageListings)
      totalAvailable = result.totalAvailable
      hasMore = result.hasMore
      await params.onRequest?.({
        ...context,
        requestStatus: 'success',
        startedAt,
        finishedAt,
        itemCount: pageListings.length,
      })
      if (!hasMore || listings.length >= maxItems) break
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

  truncated = hasMore && listings.length >= maxItems

  return {
    listings,
    total: listings.length,
    page: 1,
    hasMore,
    truncated,
    externalRequests,
    totalAvailable,
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

/**
 * Déduit le type de vendeur depuis adverts[].publisher / contact / publisherTypes.
 * type 1 + catégorie « Agences… » + contact.agency = agence (confirmé terrain).
 */
export function mapSellerType(raw: Record<string, unknown>): SellerType {
  const adverts = Array.isArray(raw.adverts) ? (raw.adverts as Record<string, unknown>[]) : []
  for (const a of adverts) {
    const pub = (a.publisher ?? {}) as Record<string, unknown>
    const cat = String(pub.category ?? '').toLowerCase()
    if (/particulier|propri[ée]taire|\bpap\b/.test(cat)) return 'individual'
    if (/agence|professionnel|r[ée]seau|mandataire|promoteur/.test(cat)) return 'agency'
    if (Number(pub.type) === 1) return 'agency'
    const contact = (a.contact ?? {}) as Record<string, unknown>
    if (contact.agency) return 'agency'
  }
  const pt = raw.publisherTypes
  if (Array.isArray(pt) && pt.map(Number).includes(1)) return 'agency'
  if (Array.isArray(pt) && pt.map(Number).includes(0)) return 'individual'
  return null
}

export function normalizeListing(raw: Record<string, unknown>): StreamEstateListing {
  // stream.estate renvoie les photos dans adverts[0].photos ou directement photos
  const adverts = Array.isArray(raw.adverts) ? raw.adverts as Record<string, unknown>[] : []
  const firstAdvert = adverts[0] ?? {}
  const imagesRaw = raw.photos ?? firstAdvert.photos ?? raw.images
  const images: string[] = Array.isArray(imagesRaw) ? imagesRaw.map(String) : []

  // Prix : stream.estate stocke le prix dans adverts[0].price ou price
  const price = Number(firstAdvert.price ?? raw.price ?? raw.prix ?? 0) || undefined

  // URL de l'annonce : adverts[0].url ou url
  const url = String(firstAdvert.url ?? raw.url ?? raw.source_url ?? '')

  const location = (raw.location ?? {}) as Record<string, unknown>

  const cityObj = (typeof raw.city === 'object' && raw.city !== null)
    ? raw.city as Record<string, unknown>
    : null
  const cityName  = String(cityObj?.name ?? cityObj?.originalName ?? raw.ville ?? '')
  const zipcode   = String(cityObj?.zipcode ?? raw.zipcode ?? raw.postalCode ?? raw.code_postal ?? '')
  const rawTitle  = String(firstAdvert.title ?? raw.title ?? raw.titre ?? '').trim()
  const ptRaw     = raw.propertyType ?? raw.property_type ?? raw.type
  const ptNum     = typeof ptRaw === 'number' ? ptRaw : (ptRaw !== undefined ? Number(ptRaw) : NaN)
  const pType     = (!isNaN(ptNum) && PROPERTY_TYPE_LABELS[ptNum])
    ? PROPERTY_TYPE_LABELS[ptNum]
    : (typeof ptRaw === 'string' && ptRaw ? ptRaw : '')
  const surfaceN  = Number(raw.surface ?? raw.surface_habitable ?? 0) || undefined
  const roomsN    = Number(raw.roomsCount ?? raw.rooms ?? raw.pieces ?? 0) || undefined

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

  return {
    id: String(raw.uuid ?? raw.id ?? raw['@id'] ?? ''),
    externalId: String(raw.uuid ?? raw.id ?? raw.external_id ?? raw.externalId ?? ''),
    sellerType: mapSellerType(raw),
    title: buildTitle(),
    description: String(firstAdvert.description ?? raw.description ?? ''),
    city: cityName,
    zipcode,
    inseeCode: String(cityObj?.insee ?? raw.inseeCode ?? raw.insee_code ?? ''),
    lat: Number(location.lat ?? raw.lat ?? raw.latitude ?? 0) || undefined,
    lon: Number(location.lon ?? location.lng ?? raw.lon ?? raw.longitude ?? 0) || undefined,
    propertyType: pType,
    price,
    surface: surfaceN,
    landSurface: Number(raw.landSurface ?? raw.land_surface ?? raw.terrain ?? 0) || undefined,
    rooms: roomsN,
    bedrooms: Number(raw.bedroomsCount ?? raw.bedrooms ?? raw.chambres ?? 0) || undefined,
    dpe: String(raw.dpeValue ?? raw.dpe ?? ''),
    ges: String(raw.gesValue ?? raw.ges ?? ''),
    url,
    status: raw.expired === true ? 'expired' : String(raw.status ?? raw.statut ?? 'active'),
    images,
    publishedAt: (raw.published_at ?? raw.date_publication ?? raw.created_at ?? raw.createdAt) as string | undefined || undefined,
    updatedAt: (raw.updated_at ?? raw.date_mise_a_jour ?? raw.updatedAt) as string | undefined || undefined,
    raw,
  }
}

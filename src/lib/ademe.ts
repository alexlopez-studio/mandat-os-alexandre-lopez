/**
 * ADEME DPE API client — Phase B v2 Step B2-1.
 *
 * Cherche un DPE officiel via l'API open data ADEME (data-fair / Koumoul).
 * Deux datasets sources :
 *   - dpe03existant  (logements existants depuis juillet 2021)
 *   - dpe02neuf      (logements neufs depuis juillet 2021)
 *
 * Stratégie : recherche par adresse BAN quand elle est disponible, puis
 * recherche par proximité géographique en repli.
 */

const ADEME_BASE = 'https://data.ademe.fr/data-fair/api/v1/datasets'
const DATASET_EXISTING = 'dpe03existant'
const DATASET_NEW = 'dpe02neuf'
const DEFAULT_TIMEOUT_MS = 5000
const MAX_RADIUS_M = 500
const ADDRESS_SEARCH_RADIUS_M = 1000

export type DpeClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type DpeDataset = 'existing' | 'new'
export type DpeConfidence = 'exact' | 'approximatif' | 'non_trouve'

export interface AdemeDpeRecord {
  numero_dpe: string
  etiquette_dpe: DpeClass | null
  etiquette_ges: DpeClass | null
  surface_habitable_logement: number | null
  adresse_ban: string | null
  code_postal_ban: string | null
  code_insee_ban: string | null
  date_etablissement_dpe: string | null
  annee_construction: number | null
  type_batiment: string | null
  version_dpe: string | null
  /** [longitude, latitude] (GeoJSON convention) */
  geopoint: [number, number] | null
  /** Source dataset */
  dataset: DpeDataset
  /** ADEME full-text relevance score when available. */
  score?: number
  /** Distance to query point in meters (only set when geo search) */
  distance_m?: number
}

export interface DpeLookupResult {
  dpe: AdemeDpeRecord | null
  confidence: DpeConfidence
  /** Number of records inspected across all datasets */
  candidates: number
}

export interface DpeSearchOptions {
  lat: number
  lng: number
  /** Full BAN label selected by the user, used for exact text fallback. */
  address?: string
  /** Search radius in meters (default 150m, capped at 500m) */
  radius?: number
  /** Optional surface (m²) to disambiguate close candidates (±10% match boost) */
  surface?: number
  /** Fetch timeout (default 5000ms) */
  timeoutMs?: number
}

const SELECT_FIELDS = [
  'numero_dpe',
  'etiquette_dpe',
  'etiquette_ges',
  'surface_habitable_logement',
  'adresse_ban',
  'code_postal_ban',
  'code_insee_ban',
  'date_etablissement_dpe',
  'annee_construction',
  'type_batiment',
  'version_dpe',
  '_geopoint',
].join(',')

interface AdemeRawResults {
  total?: number
  results?: Array<Record<string, unknown>>
}

async function ademeFetch(
  dataset: string,
  params: Record<string, string | number | boolean>,
  timeoutMs: number,
): Promise<AdemeRawResults> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = new URL(`${ADEME_BASE}/${dataset}/lines`)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`ADEME ${dataset} HTTP ${res.status}`)
    }
    return (await res.json()) as AdemeRawResults
  } finally {
    clearTimeout(timer)
  }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return String(v)
}
function dpeClassOrNull(v: unknown): DpeClass | null {
  const s = strOrNull(v)
  if (s && /^[A-G]$/.test(s)) return s as DpeClass
  return null
}

function parseGeopoint(raw: unknown): [number, number] | null {
  if (typeof raw !== 'string') return null
  const [latStr, lngStr] = raw.split(',')
  const latNum = Number(latStr)
  const lngNum = Number(lngStr)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null
  return [lngNum, latNum]
}

function normalizeRecord(
  raw: Record<string, unknown>,
  dataset: DpeDataset,
): AdemeDpeRecord {
  const score = numOrNull(raw._score)
  return {
    numero_dpe: String(raw.numero_dpe ?? ''),
    etiquette_dpe: dpeClassOrNull(raw.etiquette_dpe),
    etiquette_ges: dpeClassOrNull(raw.etiquette_ges),
    surface_habitable_logement: numOrNull(raw.surface_habitable_logement),
    adresse_ban: strOrNull(raw.adresse_ban),
    code_postal_ban: strOrNull(raw.code_postal_ban),
    code_insee_ban: strOrNull(raw.code_insee_ban),
    date_etablissement_dpe: strOrNull(raw.date_etablissement_dpe),
    annee_construction: numOrNull(raw.annee_construction),
    type_batiment: strOrNull(raw.type_batiment),
    version_dpe: strOrNull(raw.version_dpe),
    geopoint: parseGeopoint(raw._geopoint),
    dataset,
    ...(score != null ? { score } : {}),
  }
}

/** Haversine distance in meters between two [lng, lat] points. */
export function haversineMeters(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function enrichRecords(
  rows: Array<Record<string, unknown>>,
  dataset: DpeDataset,
  opts: DpeSearchOptions,
): AdemeDpeRecord[] {
  return rows.map((r) => {
    const rec = normalizeRecord(r, dataset)
    if (rec.geopoint) {
      rec.distance_m = haversineMeters([opts.lng, opts.lat], rec.geopoint)
    }
    return rec
  })
}

function enrichAndSortByDistance(
  rows: Array<Record<string, unknown>>,
  dataset: DpeDataset,
  opts: DpeSearchOptions,
): AdemeDpeRecord[] {
  const enriched = enrichRecords(rows, dataset, opts)
  enriched.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity))
  return enriched
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function sortAddressCandidates(candidates: AdemeDpeRecord[], searchedAddress: string): AdemeDpeRecord[] {
  const normalizedSearch = normalizeAddress(searchedAddress)
  return candidates.sort((a, b) => {
    const aAddress = normalizeAddress(a.adresse_ban)
    const bAddress = normalizeAddress(b.adresse_ban)
    const aExact = aAddress === normalizedSearch ? 1 : 0
    const bExact = bAddress === normalizedSearch ? 1 : 0
    if (aExact !== bExact) return bExact - aExact

    const aStarts = normalizedSearch && aAddress.startsWith(normalizedSearch) ? 1 : 0
    const bStarts = normalizedSearch && bAddress.startsWith(normalizedSearch) ? 1 : 0
    if (aStarts !== bStarts) return bStarts - aStarts

    const byScore = (b.score ?? 0) - (a.score ?? 0)
    if (byScore !== 0) return byScore

    return (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)
  })
}

function scoreConfidence(
  rec: AdemeDpeRecord,
  opts: DpeSearchOptions,
): DpeConfidence {
  const distance = rec.distance_m ?? Infinity
  const surfaceMatches =
    opts.surface != null && rec.surface_habitable_logement != null
      ? Math.abs(rec.surface_habitable_logement - opts.surface) /
          opts.surface <=
        0.1
      : null

  if (distance <= 30) {
    if (surfaceMatches === false) return 'approximatif'
    return 'exact'
  }
  if (distance <= 150) return 'approximatif'
  return 'non_trouve'
}

async function searchDatasetByAddress(
  dataset: DpeDataset,
  opts: DpeSearchOptions,
): Promise<AdemeDpeRecord[]> {
  const address = opts.address?.trim()
  if (!address) return []
  const slug = dataset === 'existing' ? DATASET_EXISTING : DATASET_NEW
  const data = await ademeFetch(
    slug,
    {
      q: address,
      select: SELECT_FIELDS,
      size: 25,
      count: false,
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  const candidates = enrichRecords(data.results ?? [], dataset, opts).filter(
    (rec) => rec.distance_m == null || rec.distance_m <= ADDRESS_SEARCH_RADIUS_M,
  )
  return sortAddressCandidates(candidates, address)
}

async function searchDatasetByGeo(
  dataset: DpeDataset,
  opts: DpeSearchOptions,
): Promise<AdemeDpeRecord[]> {
  const slug = dataset === 'existing' ? DATASET_EXISTING : DATASET_NEW
  const radius = Math.min(opts.radius ?? 150, MAX_RADIUS_M)
  const data = await ademeFetch(
    slug,
    {
      geo_distance: `${opts.lat},${opts.lng},${radius}`,
      select: SELECT_FIELDS,
      size: 25,
      count: false,
      sort: '-date_etablissement_dpe',
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  return enrichAndSortByDistance(data.results ?? [], dataset, opts)
}

async function searchDataset(
  dataset: DpeDataset,
  opts: DpeSearchOptions,
): Promise<AdemeDpeRecord[]> {
  const byAddress = await searchDatasetByAddress(dataset, opts)
  if (byAddress.length > 0) return byAddress
  return searchDatasetByGeo(dataset, opts)
}

/**
 * Find the most relevant DPE near a given lat/lng. Searches the existing
 * dataset first, falls back to the new-build dataset if nothing is found.
 * Resilient: returns { dpe: null, confidence: 'non_trouve' } on errors.
 */
export async function findDpeNearby(
  opts: DpeSearchOptions,
): Promise<DpeLookupResult> {
  let total = 0
  try {
    const existing = await searchDataset('existing', opts)
    total += existing.length
    let best = existing[0] ?? null
    if (!best) {
      const neufs = await searchDataset('new', opts)
      total += neufs.length
      best = neufs[0] ?? null
    }
    if (!best) return { dpe: null, confidence: 'non_trouve', candidates: total }
    return {
      dpe: best,
      confidence: scoreConfidence(best, opts),
      candidates: total,
    }
  } catch (err) {
    console.error('[ademe] findDpeNearby failed', err)
    return { dpe: null, confidence: 'non_trouve', candidates: total }
  }
}

/**
 * Direct lookup by official DPE number (numero_dpe).
 * Returns null if not found in either dataset.
 */
export async function getDpeByNumber(
  numero: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AdemeDpeRecord | null> {
  const trimmed = numero.trim()
  if (!trimmed) return null
  for (const dataset of ['existing', 'new'] as const) {
    try {
      const slug = dataset === 'existing' ? DATASET_EXISTING : DATASET_NEW
      const data = await ademeFetch(
        slug,
        {
          q: trimmed,
          select: SELECT_FIELDS,
          size: 1,
          count: false,
        },
        timeoutMs,
      )
      const row = data.results?.[0]
      if (row) return normalizeRecord(row, dataset)
    } catch (err) {
      console.error(`[ademe] getDpeByNumber on ${dataset} failed`, err)
    }
  }
  return null
}

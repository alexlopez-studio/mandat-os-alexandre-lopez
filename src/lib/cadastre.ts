/**
 * APICarto IGN Cadastre client — Phase B v2 Step B2-2.
 *
 * Récupère la parcelle cadastrale (n° + section + surface terrain) à partir
 * d'un point géographique (lat/lng) ou d'un code (INSEE + section + numéro).
 *
 * Endpoint : https://apicarto.ign.fr/api/cadastre/parcelle
 * Source par défaut : PCI (Parcellaire Express)
 * Réponse : GeoJSON FeatureCollection
 */

const APICARTO_BASE = 'https://apicarto.ign.fr/api/cadastre'
const DEFAULT_TIMEOUT_MS = 5000
const CADASTRE_FALLBACK_RADIUS_M = 35

export interface Parcel {
  /** Identifiant unique parcelle (15 caractères, ex. 830420000A0123) */
  idu: string
  code_insee: string
  code_dep: string
  code_com: string
  code_arr: string
  nom_com: string
  section: string
  numero: string
  /** Surface terrain en m² (contenance cadastrale) */
  contenance_m2: number | null
  /** Géométrie GeoJSON brute (Polygon ou MultiPolygon) */
  geometry: unknown
}

export interface ParcelByCodeOptions {
  codeInsee: string
  section: string
  numero: string
  timeoutMs?: number
}

export interface ParcelByPointOptions {
  lat: number
  lng: number
  timeoutMs?: number
}

interface FeatureCollectionLike {
  type?: string
  features?: Array<{
    type?: string
    geometry?: unknown
    properties?: Record<string, unknown> | null
  }>
}

type Position = [number, number]

async function apicartoFetch(
  url: string,
  timeoutMs: number,
): Promise<FeatureCollectionLike> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`APICarto Cadastre HTTP ${res.status}`)
    }
    return (await res.json()) as FeatureCollectionLike
  } finally {
    clearTimeout(timer)
  }
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return String(v)
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeSection(section: string): string {
  const clean = section.trim().toUpperCase()
  if (/^[A-Z]$/.test(clean)) return '0' + clean
  return clean
}

function normalizeNumero(numero: string): string {
  const clean = numero.trim()
  return /^\d+$/.test(clean) ? clean.padStart(4, '0') : clean
}

function normalizeFeature(
  f: NonNullable<FeatureCollectionLike['features']>[number],
): Parcel | null {
  const p = f.properties ?? {}
  const idu = strOrNull(p.idu)
  if (!idu) return null
  return {
    idu,
    code_insee: strOrNull(p.code_insee) ?? '',
    code_dep: strOrNull(p.code_dep) ?? '',
    code_com: strOrNull(p.code_com) ?? '',
    code_arr: strOrNull(p.code_arr) ?? '',
    nom_com: strOrNull(p.nom_com) ?? '',
    section: strOrNull(p.section) ?? '',
    numero: strOrNull(p.numero) ?? '',
    contenance_m2: numOrNull(p.contenance),
    geometry: f.geometry ?? null,
  }
}

function parcelsFromCollection(fc: FeatureCollectionLike): Parcel[] {
  const features = fc.features ?? []
  const parcels: Parcel[] = []
  for (const f of features) {
    const parcel = normalizeFeature(f)
    if (parcel) parcels.push(parcel)
  }
  return parcels
}

function firstParcel(fc: FeatureCollectionLike): Parcel | null {
  return parcelsFromCollection(fc)[0] ?? null
}

function bboxAroundPoint(lat: number, lng: number, radiusM: number) {
  const latDelta = radiusM / 111_320
  const lngDelta = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - lngDelta, lat - latDelta],
      [lng + lngDelta, lat - latDelta],
      [lng + lngDelta, lat + latDelta],
      [lng - lngDelta, lat + latDelta],
      [lng - lngDelta, lat - latDelta],
    ]],
  }
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'number'
    && typeof value[1] === 'number'
}

function collectRings(value: unknown, rings: Position[][] = []): Position[][] {
  if (!Array.isArray(value)) return rings
  if (value.every(isPosition)) {
    rings.push(value as Position[])
    return rings
  }
  for (const item of value) collectRings(item, rings)
  return rings
}

function project(position: Position, origin: { lat: number; lng: number }) {
  return {
    x: (position[0] - origin.lng) * 111_320 * Math.cos((origin.lat * Math.PI) / 180),
    y: (position[1] - origin.lat) * 111_320,
  }
}

function pointInRing(ring: Position[], origin: { lat: number; lng: number }): boolean {
  let inside = false
  const p = { x: 0, y: 0 }
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = project(ring[i], origin)
    const pj = project(ring[j], origin)
    const intersects = ((pi.y > p.y) !== (pj.y > p.y))
      && (p.x < ((pj.x - pi.x) * (p.y - pi.y)) / ((pj.y - pi.y) || Number.EPSILON) + pi.x)
    if (intersects) inside = !inside
  }
  return inside
}

function distanceToSegmentMeters(a: Position, b: Position, origin: { lat: number; lng: number }): number {
  const pa = project(a, origin)
  const pb = project(b, origin)
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(pa.x, pa.y)
  const t = Math.max(0, Math.min(1, -(pa.x * dx + pa.y * dy) / lengthSq))
  const x = pa.x + t * dx
  const y = pa.y + t * dy
  return Math.hypot(x, y)
}

function distanceToParcelMeters(parcel: Parcel, origin: { lat: number; lng: number }): number {
  const geometry = parcel.geometry as { coordinates?: unknown } | null
  const rings = collectRings(geometry?.coordinates)
  if (rings.length === 0) return Number.POSITIVE_INFINITY

  if (rings.some((ring) => pointInRing(ring, origin))) return 0

  let min = Number.POSITIVE_INFINITY
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) {
      min = Math.min(min, distanceToSegmentMeters(ring[i - 1], ring[i], origin))
    }
  }
  return min
}

function nearestParcel(parcels: Parcel[], origin: { lat: number; lng: number }): Parcel | null {
  return parcels
    .map((parcel) => ({ parcel, distance: distanceToParcelMeters(parcel, origin) }))
    .sort((a, b) => a.distance - b.distance)[0]?.parcel ?? null
}

async function findNearestParcelAroundPoint(opts: ParcelByPointOptions): Promise<Parcel | null> {
  const geom = JSON.stringify(bboxAroundPoint(opts.lat, opts.lng, CADASTRE_FALLBACK_RADIUS_M))
  const url = `${APICARTO_BASE}/parcelle?geom=${encodeURIComponent(geom)}`
  const fc = await apicartoFetch(url, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  return nearestParcel(parcelsFromCollection(fc), { lat: opts.lat, lng: opts.lng })
}

/**
 * Find the cadastral parcel at or nearest to a given lat/lng point.
 *
 * Why the fallback exists:
 * BAN address points can be placed a few metres outside the parcel boundary
 * (on the road, entrance or address plate). APICarto's strict point lookup can
 * then return no result even when the parcel is immediately adjacent. We first
 * try the strict lookup, then query a small area and choose the closest parcel.
 */
export async function findParcelByPoint(
  opts: ParcelByPointOptions,
): Promise<Parcel | null> {
  try {
    const geom = JSON.stringify({
      type: 'Point',
      coordinates: [opts.lng, opts.lat],
    })
    const url = `${APICARTO_BASE}/parcelle?geom=${encodeURIComponent(geom)}`
    const fc = await apicartoFetch(
      url,
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )
    return firstParcel(fc) ?? await findNearestParcelAroundPoint(opts)
  } catch (err) {
    console.error('[cadastre] findParcelByPoint failed', err)
    try {
      return await findNearestParcelAroundPoint(opts)
    } catch (fallbackErr) {
      console.error('[cadastre] findNearestParcelAroundPoint failed', fallbackErr)
      return null
    }
  }
}

/**
 * Direct lookup by INSEE code + cadastral section + numero.
 * Returns null if not found or on error.
 */
export async function findParcelByCode(
  opts: ParcelByCodeOptions,
): Promise<Parcel | null> {
  try {
    const params = new URLSearchParams({
      code_insee: opts.codeInsee,
      section: normalizeSection(opts.section),
      numero: normalizeNumero(opts.numero),
    })
    const url = `${APICARTO_BASE}/parcelle?${params.toString()}`
    const fc = await apicartoFetch(
      url,
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )
    return firstParcel(fc)
  } catch (err) {
    console.error('[cadastre] findParcelByCode failed', err)
    return null
  }
}

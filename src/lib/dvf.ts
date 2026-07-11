import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API DVF historique utilisée par le moteur d'estimation.
 *
 * Conservée pour les comparables autour d'une coordonnée. Le nouveau module
 * Observatoire DVF plus bas importe, lui, les fichiers publics par commune.
 */
const CEREMA_DVF_API = 'https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/'
const CQUEST_DVF_API = 'https://api.cquest.org/dvf'

type DvfProvider = 'cerema' | 'cquest'

export interface DvfMutation {
  valeur_fonciere: number
  surface_reelle_bati: number
  type_local: string
  date_mutation: string
  code_postal: string
  /** Distance au bien estimé quand la géométrie DVF est disponible. */
  distance_m?: number
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function num(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : undefined
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function coordinatesFromFeature(feature: Record<string, unknown>): { lat: number; lng: number } | null {
  const geometry = feature.geometry as { coordinates?: unknown; type?: unknown } | undefined
  const coords = geometry?.coordinates

  if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return { lng: coords[0], lat: coords[1] }
  }

  if (Array.isArray(coords) && Array.isArray(coords[0]) && typeof coords[0][0] === 'number' && typeof coords[0][1] === 'number') {
    return { lng: coords[0][0], lat: coords[0][1] }
  }

  return null
}

function normalizeMutation(raw: Record<string, unknown>, origin: { lat: number; lng: number }): DvfMutation | null {
  const valeur =
    num(raw.valeur_fonciere) ??
    num(raw.valeur) ??
    num(raw.valeurfonc) ??
    num(raw.prix)

  const surface =
    num(raw.surface_reelle_bati) ??
    num(raw.surface_bati) ??
    num(raw.sbati) ??
    num(raw.surface)

  if (!valeur || !surface) return null

  const lat = num(raw.lat) ?? num(raw.latitude)
  const lng = num(raw.lon) ?? num(raw.lng) ?? num(raw.longitude)
  const hasPoint = typeof lat === 'number' && typeof lng === 'number'

  return {
    valeur_fonciere: valeur,
    surface_reelle_bati: surface,
    type_local: str(raw.type_local ?? raw.type_local_label ?? raw.local_type),
    date_mutation: str(raw.date_mutation ?? raw.date ?? raw.datemut),
    code_postal: str(raw.code_postal ?? raw.postal_code ?? raw.cp),
    ...(hasPoint ? { distance_m: haversineMeters(origin, { lat, lng }) } : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeDvfResponse(data: unknown, origin: { lat: number; lng: number }): DvfMutation[] {
  if (Array.isArray(data)) {
    return data
      .map((raw) => normalizeMutation(asRecord(raw), origin))
      .filter((mutation: DvfMutation | null): mutation is DvfMutation => mutation != null)
  }

  const record = asRecord(data)

  if (Array.isArray(record.results)) {
    return record.results
      .map((raw) => normalizeMutation(asRecord(raw), origin))
      .filter((mutation: DvfMutation | null): mutation is DvfMutation => mutation != null)
  }

  if (Array.isArray(record.features)) {
    return record.features
      .map((featureRaw) => {
        const feature = asRecord(featureRaw)
        const props = asRecord(feature.properties)
        const point = coordinatesFromFeature(feature)
        return normalizeMutation({ ...props, ...(point ? { lat: point.lat, lng: point.lng } : {}) }, origin)
      })
      .filter((mutation: DvfMutation | null): mutation is DvfMutation => mutation != null)
  }

  return []
}

function providerFromEnv(): DvfProvider {
  return process.env.DVF_PRIMARY_PROVIDER === 'cquest' ? 'cquest' : 'cerema'
}

function shouldUseFallback(primary: DvfProvider): boolean {
  if (process.env.DVF_ENABLE_FALLBACK === 'false') return false
  return primary === 'cerema'
}

function buildCeremaUrl(lat: number, lng: number, typeLocal: string, rayonMetres: number, dateMinStr: string): string {
  const base = (process.env.DVF_CEREMA_API_URL || CEREMA_DVF_API).replace(/\?$/, '')
  return (
    base +
    `?lat=${lat}&lon=${lng}&rayon=${rayonMetres}` +
    `&date_mutation_min=${dateMinStr}&nature_mutation=Vente` +
    `&in_type_local=${encodeURIComponent(typeLocal)}&ordering=-date_mutation&limit=100`
  )
}

function buildCquestUrl(lat: number, lng: number, typeLocal: string, rayonMetres: number): string {
  const base = (process.env.DVF_CQUEST_API_URL || CQUEST_DVF_API).replace(/\?$/, '')
  return (
    base +
    `?lat=${lat}&lon=${lng}&dist=${rayonMetres}` +
    `&nature_mutation=Vente&type_local=${encodeURIComponent(typeLocal)}`
  )
}

function buildProviderUrl(
  provider: DvfProvider,
  lat: number,
  lng: number,
  typeLocal: string,
  rayonMetres: number,
  dateMinStr: string,
): string {
  return provider === 'cquest'
    ? buildCquestUrl(lat, lng, typeLocal, rayonMetres)
    : buildCeremaUrl(lat, lng, typeLocal, rayonMetres, dateMinStr)
}

async function fetchProviderMutations({
  provider,
  lat,
  lng,
  typeLocal,
  rayonMetres,
  dateMinStr,
}: {
  provider: DvfProvider
  lat: number
  lng: number
  typeLocal: string
  rayonMetres: number
  dateMinStr: string
}): Promise<DvfMutation[]> {
  const url = buildProviderUrl(provider, lat, lng, typeLocal, rayonMetres, dateMinStr)

  try {
    const r = await fetch(url, { next: { revalidate: 86400 } } as RequestInit & { next: { revalidate: number } })
    if (!r.ok) {
      console.warn(`[DVF] Source ${provider} indisponible (${r.status})`)
      return []
    }

    const data = await r.json()
    return normalizeDvfResponse(data, { lat, lng })
  } catch (err) {
    console.warn(`[DVF] Source ${provider} en erreur`, err)
    return []
  }
}

export async function fetchDvfMutations(
  lat: number,
  lng: number,
  typeBien: string,
  rayonMetres = 1500,
): Promise<DvfMutation[]> {
  const dateMin = new Date()
  dateMin.setFullYear(dateMin.getFullYear() - 3)
  const dateMinStr = dateMin.toISOString().split('T')[0]
  const typeLocal = typeBien === 'appartement' ? 'Appartement' : 'Maison'
  const primary = providerFromEnv()

  const primaryMutations = await fetchProviderMutations({
    provider: primary,
    lat,
    lng,
    typeLocal,
    rayonMetres,
    dateMinStr,
  })

  if (primaryMutations.length > 0 || !shouldUseFallback(primary)) {
    return primaryMutations
  }

  return fetchProviderMutations({
    provider: 'cquest',
    lat,
    lng,
    typeLocal,
    rayonMetres,
    dateMinStr,
  })
}

export const DVF_DATASET_URL = 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres'
export const DVF_DATASET_API_URL = 'https://www.data.gouv.fr/api/1/datasets/demandes-de-valeurs-foncieres/'
const GEO_DVF_BASE_URL = process.env.DVF_GEO_CSV_BASE_URL ?? 'https://files.data.gouv.fr/geo-dvf/latest/csv'

type Db = {
  from: (table: string) => any
}

const db = supabaseAdmin as unknown as Db

export type DvfImportResult = {
  runId: string
  inseeCode: string
  year: number
  sourceUrl: string
  scannedRows: number
  importedRows: number
  skippedRows: number
}

type DvfRow = Record<string, string>

function parseInteger(value?: string | null): number | null {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNumber(value?: string | null): number | null {
  if (!value) return null
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      i += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }

  cells.push(current)
  return cells
}

function rowFromCsv(headers: string[], line: string): DvfRow {
  const values = splitCsvLine(line)
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
}

function currentDvfYear(): number {
  // Les fichiers DVF publiés en année N couvrent au plus N-1.
  return new Date().getFullYear() - 1
}

export function normalizeDvfYear(year?: number | string | null): number {
  const parsed = typeof year === 'number' ? year : Number.parseInt(String(year ?? ''), 10)
  const fallback = currentDvfYear()
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(fallback, Math.max(2019, parsed))
}

export function departmentFromInsee(inseeCode: string): string {
  if (inseeCode.startsWith('2A') || inseeCode.startsWith('2B')) return inseeCode.slice(0, 2)
  return inseeCode.slice(0, 2)
}

export function dvfDepartmentCsvUrl(year: number, departmentCode: string): string {
  return `${GEO_DVF_BASE_URL}/${year}/departements/${departmentCode}.csv.gz`
}

function toTransaction(row: DvfRow, sourceRowId: string, sourceFileYear: number) {
  const value = parseNumber(row.valeur_fonciere)
  const builtSurface = parseNumber(row.surface_reelle_bati)
  const pricePerM2 = value && builtSurface && builtSurface > 0
    ? Math.round((value / builtSurface) * 100) / 100
    : null

  return {
    source_row_id: sourceRowId,
    mutation_id: row.id_mutation,
    disposition_number: parseInteger(row.numero_disposition),
    mutation_date: row.date_mutation || null,
    mutation_year: row.date_mutation ? Number.parseInt(row.date_mutation.slice(0, 4), 10) : sourceFileYear,
    nature_mutation: row.nature_mutation || null,
    value,
    address_number: row.adresse_numero || null,
    address_suffix: row.adresse_suffixe || null,
    street_name: row.adresse_nom_voie || null,
    postal_code: row.code_postal || null,
    insee_code: row.code_commune,
    city_name: row.nom_commune || null,
    department_code: row.code_departement || null,
    parcel_id: row.id_parcelle || null,
    lot_count: parseInteger(row.nombre_lots),
    local_type_code: row.code_type_local || null,
    local_type: row.type_local || null,
    built_surface: builtSurface,
    rooms: parseInteger(row.nombre_pieces_principales),
    land_nature: row.nature_culture || null,
    land_surface: parseNumber(row.surface_terrain),
    longitude: parseNumber(row.longitude),
    latitude: parseNumber(row.latitude),
    price_per_m2: pricePerM2,
    source_file_year: sourceFileYear,
    raw_json: row,
  }
}

async function upsertBatch(rows: ReturnType<typeof toTransaction>[]) {
  if (rows.length === 0) return
  const { error } = await db
    .from('dvf_transactions')
    .upsert(rows, { onConflict: 'source_row_id' })

  if (error) {
    throw new Error(`Import DVF impossible: ${error.message}`)
  }
}

export async function importDvfCommune({
  inseeCode,
  communeName,
  zipcode,
  year,
}: {
  inseeCode: string
  communeName?: string | null
  zipcode?: string | null
  year?: number | string | null
}): Promise<DvfImportResult> {
  const normalizedInsee = inseeCode.trim()
  if (!/^[0-9AB]{2}[0-9]{3}$/i.test(normalizedInsee)) {
    throw new Error('Code INSEE invalide')
  }

  const sourceFileYear = normalizeDvfYear(year)
  const departmentCode = departmentFromInsee(normalizedInsee)
  const sourceUrl = dvfDepartmentCsvUrl(sourceFileYear, departmentCode)

  const { data: run, error: runError } = await db
    .from('dvf_import_runs')
    .insert({
      insee_code: normalizedInsee,
      commune_name: communeName ?? null,
      department_code: departmentCode,
      source_file_year: sourceFileYear,
      source_url: sourceUrl,
      status: 'running',
    })
    .select('id')
    .single()

  if (runError || !run?.id) {
    throw new Error(`Création run DVF impossible: ${runError?.message ?? 'id manquant'}`)
  }

  const runId = run.id as string
  let scannedRows = 0
  let importedRows = 0
  let skippedRows = 0

  try {
    const res = await fetch(sourceUrl, { headers: { Accept: 'application/gzip,text/csv,*/*' } })
    if (!res.ok || !res.body) {
      throw new Error(`Source DVF indisponible (${res.status})`)
    }

    const input = Readable.fromWeb(res.body as any)
    const lines = createInterface({ input: input.pipe(createGunzip()), crlfDelay: Infinity })
    let headers: string[] | null = null
    const batch: ReturnType<typeof toTransaction>[] = []
    let sourceLine = 0
    let detectedCommuneName = communeName ?? null
    let detectedZipcode = zipcode ?? null

    for await (const line of lines) {
      sourceLine += 1
      if (!headers) {
        headers = splitCsvLine(line)
        continue
      }
      if (!line.trim()) continue

      scannedRows += 1
      const row = rowFromCsv(headers, line)
      if (row.code_commune !== normalizedInsee) continue

      const value = parseNumber(row.valeur_fonciere)
      if (!row.id_mutation || !row.date_mutation || !value || value <= 0) {
        skippedRows += 1
        continue
      }

      detectedCommuneName ||= row.nom_commune || null
      detectedZipcode ||= row.code_postal || null
      batch.push(toTransaction(row, `${sourceFileYear}:${sourceLine}`, sourceFileYear))

      if (batch.length >= 500) {
        await upsertBatch(batch.splice(0, batch.length))
      }
    }

    await upsertBatch(batch)

    const countResult = await db
      .from('dvf_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('insee_code', normalizedInsee)
      .eq('source_file_year', sourceFileYear)

    importedRows = countResult.count ?? 0

    await db
      .from('dvf_communes')
      .upsert({
        insee_code: normalizedInsee,
        name: detectedCommuneName ?? communeName ?? normalizedInsee,
        zipcode: detectedZipcode ?? zipcode ?? null,
        department_code: departmentCode,
        active: true,
        last_imported_at: new Date().toISOString(),
        last_import_year: sourceFileYear,
        last_import_status: 'success',
        last_import_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'insee_code' })

    await db
      .from('dvf_import_runs')
      .update({
        status: 'success',
        scanned_rows: scannedRows,
        imported_rows: importedRows,
        skipped_rows: skippedRows,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return { runId, inseeCode: normalizedInsee, year: sourceFileYear, sourceUrl, scannedRows, importedRows, skippedRows }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur import DVF'
    await db
      .from('dvf_import_runs')
      .update({
        status: 'error',
        scanned_rows: scannedRows,
        imported_rows: importedRows,
        skipped_rows: skippedRows,
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)

    await db
      .from('dvf_communes')
      .upsert({
        insee_code: normalizedInsee,
        name: communeName ?? normalizedInsee,
        zipcode: zipcode ?? null,
        department_code: departmentCode,
        active: true,
        last_import_year: sourceFileYear,
        last_import_status: 'error',
        last_import_error: message,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'insee_code' })

    throw error
  }
}

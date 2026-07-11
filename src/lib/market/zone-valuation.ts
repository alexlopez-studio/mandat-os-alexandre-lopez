// ═══════════════════════════════════════════════════════════════
// MandatFinder — Valorisation par zone (sous-évaluation)
// Dimension de lecture : un bien nettement sous la médiane prix/m² de sa
// zone est un signal d'opportunité (marge de négociation / mauvais
// positionnement). Calculé à la lecture, jamais stocké → toujours frais.
// ═══════════════════════════════════════════════════════════════

export interface ZoneValuationRow {
  insee_code?: string | null
  zipcode?: string | null
  price_per_m2?: number | null
  status?: string | null
}

const TERMINAL_STATUSES = new Set(['expired', 'removed', 'sold', 'vendu'])

/** Clé de zone : commune exacte (INSEE) si dispo, sinon code postal. */
export function zoneKey(row: ZoneValuationRow): string {
  return row.insee_code || row.zipcode || ''
}

export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/** Médiane du prix/m² par zone, sur les biens actifs disposant d'un prix/m². */
export function buildZoneMedians(rows: ZoneValuationRow[]): Map<string, number> {
  const byZone = new Map<string, number[]>()
  for (const r of rows) {
    if (r.status && TERMINAL_STATUSES.has(r.status)) continue
    const ppm = Number(r.price_per_m2)
    if (!Number.isFinite(ppm) || ppm <= 0) continue
    const key = zoneKey(r)
    if (!key) continue
    if (!byZone.has(key)) byZone.set(key, [])
    byZone.get(key)!.push(ppm)
  }
  const medians = new Map<string, number>()
  for (const [key, vals] of byZone) {
    const m = median(vals)
    if (m != null) medians.set(key, m)
  }
  return medians
}

/**
 * Écart de sous-évaluation (%) d'un bien vs la médiane de sa zone.
 * 0 si au-dessus/égal à la médiane ou données insuffisantes ; arrondi à 0,1 %.
 */
export function undervaluationPct(pricePerM2: number | null | undefined, zoneMedian: number | null | undefined): number {
  const ppm = Number(pricePerM2)
  const med = Number(zoneMedian)
  if (!Number.isFinite(ppm) || ppm <= 0 || !Number.isFinite(med) || med <= 0) return 0
  if (ppm >= med) return 0
  return Math.round(((med - ppm) / med) * 1000) / 10
}

/** Formatage fr-FR du rapport. Un blanc assumé s'écrit « — », jamais 0. */

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

export const BLANK = '—'

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? BLANK : numberFormatter.format(value)
}

export function formatPrice(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? BLANK
    : `${numberFormatter.format(value)} €`
}

export function formatPricePerM2(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? BLANK
    : `${numberFormatter.format(value)} €/m²`
}

export function formatSurface(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? BLANK
    : `${decimalFormatter.format(value)} m²`
}

export function formatPercent(value: number | null | undefined, options?: { signed?: boolean }): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return BLANK
  const sign = options?.signed && value > 0 ? '+' : ''
  return `${sign}${decimalFormatter.format(value)} %`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return BLANK
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return BLANK
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return BLANK
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return BLANK
  const label = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDistance(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return BLANK
  return value < 1 ? `${Math.round(value * 1000)} m` : `${decimalFormatter.format(value)} km`
}

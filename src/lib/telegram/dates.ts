/**
 * Interprétation des dates dictées à l'agent Telegram.
 *
 * Alexandre écrit entre deux rendez-vous : « lundi prochain », « 10/08 »,
 * « demain », « 10 août 2026 ». Le modèle est censé rendre du AAAA-MM-JJ, mais
 * il ne le fait pas toujours — et jusqu'ici la chaîne partait telle quelle vers
 * Postgres, qui la refusait au milieu de l'insertion.
 *
 * Ce module est le point de passage obligé : soit il rend une date ISO valide,
 * soit il rend un message d'erreur exploitable par le modèle. Rien d'autre ne
 * sort d'ici.
 */

export type ParsedDate =
  | { ok: true; iso: string }
  | { ok: false; error: string }

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
}

/** Lundi = 1 … dimanche = 7, comme en usage courant en France. */
const WEEKDAYS: Record<string, number> = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4,
  vendredi: 5, samedi: 6, dimanche: 7,
}

const ERROR = "Date incomprise. Formats acceptés : AAAA-MM-JJ, JJ/MM/AAAA, « 10 août 2026 », « demain », « lundi prochain »."

export function parseFrenchDate(input: unknown, today: Date): ParsedDate {
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: ERROR }
  }

  const text = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/1er\b/g, '1')
    .replace(/[^a-z0-9\/\-. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const direct = tryFormats(text, today)
  if (direct) return direct

  // « lundi 10 août 2026 » : le jour de la semaine est redondant avec la date
  // qui suit. On le retire — mais seulement après avoir essayé le texte entier,
  // pour ne pas casser « lundi prochain », qui n'a que lui.
  const stripped = new RegExp(`^(?:${Object.keys(WEEKDAYS).join('|')}) (.+)$`).exec(text)
  if (stripped) {
    const retry = tryFormats(stripped[1], today)
    if (retry) return retry
  }

  return { ok: false, error: ERROR }
}

function tryFormats(text: string, today: Date): ParsedDate | null {
  return (
    parseIso(text)
      ?? parseNumeric(text, today)
      ?? parseLiteral(text, today)
      ?? parseRelative(text, today)
  )
}

function parseIso(text: string): ParsedDate | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (!match) return null
  return build(Number(match[1]), Number(match[2]), Number(match[3]))
}

/** 10/08/2026, 10-08-26, 10.08 — le jour d'abord, usage français. */
function parseNumeric(text: string, today: Date): ParsedDate | null {
  const match = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2}|\d{4}))?$/.exec(text)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = match[3]
    ? normalizeYear(Number(match[3]))
    : inferYear(month, day, today)

  return build(year, month, day)
}

/** 10 aout 2026, 10 aout, aout 10. */
function parseLiteral(text: string, today: Date): ParsedDate | null {
  const names = Object.keys(MONTHS).join('|')
  const match =
    new RegExp(`^(\\d{1,2}) (${names})(?: (\\d{2}|\\d{4}))?$`).exec(text)
    ?? new RegExp(`^(${names}) (\\d{1,2})(?: (\\d{2}|\\d{4}))?$`).exec(text)
  if (!match) return null

  const dayFirst = /^\d/.test(match[1])
  const day = Number(dayFirst ? match[1] : match[2])
  const month = MONTHS[dayFirst ? match[2] : match[1]]
  const year = match[3] ? normalizeYear(Number(match[3])) : inferYear(month, day, today)

  return build(year, month, day)
}

function parseRelative(text: string, today: Date): ParsedDate | null {
  const base = startOfUtcDay(today)

  if (/^(aujourd hui|aujourdhui|ce soir|maintenant)$/.test(text)) return isoOf(base)
  if (/^demain$/.test(text)) return isoOf(addDays(base, 1))
  if (/^(apres demain|apres-demain)$/.test(text)) return isoOf(addDays(base, 2))

  const inDays = /^dans (\d{1,3}) (jour|jours|semaine|semaines|mois)$/.exec(text)
  if (inDays) {
    const count = Number(inDays[1])
    const unit = inDays[2]
    if (unit.startsWith('jour')) return isoOf(addDays(base, count))
    if (unit.startsWith('semaine')) return isoOf(addDays(base, count * 7))
    return isoOf(addMonths(base, count))
  }

  const weekday = new RegExp(`^(?:ce |le )?(${Object.keys(WEEKDAYS).join('|')})(?: prochain| qui vient)?$`).exec(text)
  if (weekday) {
    const target = WEEKDAYS[weekday[1]]
    // Jour de la semaine en base ISO : dimanche vaut 0 côté JS.
    const current = base.getUTCDay() === 0 ? 7 : base.getUTCDay()
    // Toujours la prochaine occurrence à venir : « lundi » un lundi désigne
    // le lundi suivant, jamais aujourd'hui — on ne planifie pas dans le passé.
    const delta = ((target - current + 7) % 7) || 7
    return isoOf(addDays(base, delta))
  }

  return null
}

// ── Helpers ───────────────────────────────────────────────────

function build(year: number, month: number, day: number): ParsedDate {
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, error: ERROR }

  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejette les dates qui n'existent pas (31 février) : Date les reporte
  // silencieusement sur le mois suivant.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, error: `Cette date n'existe pas au calendrier (${day}/${month}).` }
  }

  return isoOf(date)
}

/** Année omise : on retient celle qui place la date à venir, pas derrière soi. */
function inferYear(month: number, day: number, today: Date) {
  const base = startOfUtcDay(today)
  const candidate = new Date(Date.UTC(base.getUTCFullYear(), month - 1, day))
  return candidate.getTime() < base.getTime() ? base.getUTCFullYear() + 1 : base.getUTCFullYear()
}

function normalizeYear(year: number) {
  return year < 100 ? 2000 + year : year
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 3600 * 1000)
}

function addMonths(date: Date, months: number) {
  const result = new Date(date.getTime())
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}

function isoOf(date: Date): ParsedDate {
  return { ok: true, iso: date.toISOString().slice(0, 10) }
}

/** « 2026-08-10 » → « lundi 10 août 2026 », pour les confirmations. */
export function formatFrenchDate(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date)
}

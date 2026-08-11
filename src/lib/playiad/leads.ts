/**
 * Normalisation et deduplication des leads acquereurs remontes par l'extension
 * Chrome Playiad (`extensions/playiad-sync`).
 *
 * Ces fonctions vivent hors du fichier de route : un `route.ts` Next.js ne peut
 * exporter que les handlers HTTP et quelques options reservees.
 */

export type PlayiadLeadPayload = {
  playiad_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  source?: string
  property_ref?: string
  property_title?: string
  city?: string
  property_type?: string
  budget_max?: number
  message?: string
}

export type LeadIdentity = {
  email: string | null
  phone: string | null
  playiadId: string | null
}

export function parseText(val: unknown): string | null {
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  return trimmed || null
}

export function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

/**
 * Numero francais ramene a une forme canonique `0XXXXXXXXX`, seule facon de
 * reconnaitre un meme acquereur entre deux scrapes (Playiad affiche tantot
 * `+33 6 12 …`, tantot `06.12.…`).
 */
export function normalizePhone(val: unknown): string | null {
  const raw = parseText(val)
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+33')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('0033')) digits = `0${digits.slice(4)}`
  else if (digits.startsWith('33') && digits.length === 11) digits = `0${digits.slice(2)}`
  digits = digits.replace(/\D/g, '')
  return digits.length === 10 ? digits : null
}

export function normalizeEmail(val: unknown): string | null {
  const raw = parseText(val)
  return raw ? raw.toLowerCase() : null
}

/**
 * Cle de deduplication d'un lead. L'identifiant Playiad n'est utilise que s'il
 * est reellement fourni par la page : un identifiant derive de la position dans
 * le tableau changerait a chaque nouveau lead et re-importerait tout.
 */
export function leadDedupKey(lead: LeadIdentity): string | null {
  if (lead.email) return `email:${lead.email}`
  if (lead.phone) return `phone:${lead.phone}`
  if (lead.playiadId) return `playiad:${lead.playiadId}`
  return null
}

/**
 * Toutes les identites d'un lead, pas seulement sa cle principale : un meme
 * acquereur peut apparaitre une fois avec son e-mail et une fois avec son seul
 * telephone, et les deux lignes doivent se reconnaitre.
 */
export function leadIdentityKeys(lead: LeadIdentity): string[] {
  const keys: string[] = []
  if (lead.email) keys.push(`email:${lead.email}`)
  if (lead.phone) keys.push(`phone:${lead.phone}`)
  if (!keys.length && lead.playiadId) keys.push(`playiad:${lead.playiadId}`)
  return keys
}

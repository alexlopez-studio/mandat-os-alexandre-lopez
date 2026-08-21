import type { Database } from '@/types/supabase'

export type AngleInsert = Database['public']['Tables']['content_angles']['Insert']
export type AngleUpdate = Database['public']['Tables']['content_angles']['Update']
export type PostInsert = Database['public']['Tables']['content_posts']['Insert']
export type PostUpdate = Database['public']['Tables']['content_posts']['Update']

export const VALID_PILLARS = new Set<string>([
  'taux',
  'reglementation',
  'marche_national',
  'marche_local',
  'premium',
  'conseils',
])

export const VALID_ANGLE_STATUSES = new Set<string>(['idea', 'planned', 'done', 'dropped'])

export const VALID_CHANNELS = new Set<string>([
  'blog',
  'linkedin',
  'instagram',
  'facebook',
  'newsletter',
])

export const VALID_POST_STATUSES = new Set<string>([
  'draft',
  'ready',
  'scheduled',
  'published',
  'cancelled',
])

export const VALID_AUTHORS = new Set<string>(['claude', 'admin'])

/** Un angle ne se decline pas en trente posts : garde-fou sur la creation groupee. */
export const MAX_POSTS_PER_ANGLE = 12

export type Parsed<T> = { value: T } | { error: string }

export function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map((v) => text(v)).filter((v): v is string => v !== null)
}

/** Date ISO ou null ; renvoie `undefined` si la valeur est invalide. */
export function isoDate(value: unknown): string | null | undefined {
  if (value === null) return null
  const raw = text(value)
  if (!raw) return undefined
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

/**
 * Champs d'un post acceptes en ecriture. Le body brut n'est jamais repris tel
 * quel : `id`, `created_at`, `angle_id` et `published_at` restent hors de portee
 * du client (`published_at` est pose par le serveur au passage en `published`).
 */
export function parsePostFields(raw: unknown, at: string): Parsed<PostUpdate> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: `${at} : objet attendu` }
  }
  const item = raw as Record<string, unknown>
  const out: PostUpdate = {}

  if ('channel' in item) {
    const channel = text(item.channel)
    if (!channel || !VALID_CHANNELS.has(channel)) {
      return { error: `${at}.channel invalide (${[...VALID_CHANNELS].join('|')})` }
    }
    out.channel = channel as PostUpdate['channel']
  }

  if ('status' in item) {
    const status = text(item.status)
    if (!status || !VALID_POST_STATUSES.has(status)) {
      return { error: `${at}.status invalide (${[...VALID_POST_STATUSES].join('|')})` }
    }
    out.status = status as PostUpdate['status']
  }

  if ('scheduled_for' in item) {
    const scheduled = isoDate(item.scheduled_for)
    if (scheduled === undefined) {
      return { error: `${at}.scheduled_for n'est pas une date ISO valide` }
    }
    out.scheduled_for = scheduled
  }

  if ('hashtags' in item) {
    const tags = stringArray(item.hashtags)
    if (tags === null) return { error: `${at}.hashtags doit être un tableau de chaînes` }
    out.hashtags = tags
  }

  if ('created_by' in item) {
    const author = text(item.created_by)
    if (!author || !VALID_AUTHORS.has(author)) {
      return { error: `${at}.created_by invalide (claude|admin)` }
    }
    out.created_by = author as PostUpdate['created_by']
  }

  for (const key of [
    'title',
    'body',
    'hook',
    'cta',
    'visual_brief',
    'seo_slug',
    'seo_keyword',
    'seo_description',
    'external_ref',
    'external_url',
  ] as const) {
    if (key in item) out[key] = text(item[key])
  }

  return { value: out }
}

/** Champs d'un angle acceptes en ecriture. */
export function parseAngleFields(raw: unknown, at: string): Parsed<AngleUpdate> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: `${at} : objet attendu` }
  }
  const item = raw as Record<string, unknown>
  const out: AngleUpdate = {}

  if ('title' in item) {
    const title = text(item.title)
    if (!title) return { error: `${at}.title ne peut pas être vide` }
    out.title = title
  }

  if ('pillar' in item) {
    const pillar = text(item.pillar)
    if (pillar && !VALID_PILLARS.has(pillar)) {
      return { error: `${at}.pillar invalide (${[...VALID_PILLARS].join('|')})` }
    }
    out.pillar = pillar as AngleUpdate['pillar']
  }

  if ('status' in item) {
    const status = text(item.status)
    if (!status || !VALID_ANGLE_STATUSES.has(status)) {
      return { error: `${at}.status invalide (${[...VALID_ANGLE_STATUSES].join('|')})` }
    }
    out.status = status as AngleUpdate['status']
  }

  if ('created_by' in item) {
    const author = text(item.created_by)
    if (!author || !VALID_AUTHORS.has(author)) {
      return { error: `${at}.created_by invalide (claude|admin)` }
    }
    out.created_by = author as AngleUpdate['created_by']
  }

  for (const key of ['angle', 'insee_code', 'city', 'notes', 'news_item_id'] as const) {
    if (key in item) out[key] = text(item[key])
  }

  return { value: out }
}

/** Selection commune : un post et l'angle dont il decoule, jusqu'a l'article source. */
export const POST_WITH_ANGLE_SELECT =
  '*, content_angles(id, title, pillar, city, news_items(id, title, url))'

/** Selection commune : un angle, ses declinaisons et l'article de veille d'origine. */
export const ANGLE_WITH_POSTS_SELECT =
  '*, content_posts(*), news_items(id, title, url, source)'

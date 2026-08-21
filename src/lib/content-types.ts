import type {
  ContentAngleStatus,
  ContentAuthor,
  ContentChannel,
  ContentPostStatus,
  Database,
  NewsCategory,
} from '@/types/supabase'

export type { ContentAngleStatus, ContentAuthor, ContentChannel, ContentPostStatus }

/** Tons admis par `StatusPill` (`src/components/pro/status-pill.tsx`). */
export type ContentTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export type ContentAngle = Database['public']['Tables']['content_angles']['Row']
export type ContentPost = Database['public']['Tables']['content_posts']['Row']

/** Angle tel que renvoye par l'API : ses declinaisons sont imbriquees. */
export type ContentAngleWithPosts = ContentAngle & {
  content_posts: ContentPost[]
  news_items?: { id: string; title: string; url: string; source: string } | null
}

/** Post tel que renvoye par le calendrier : son angle est imbrique. */
export type ContentPostWithAngle = ContentPost & {
  content_angles?: (Pick<ContentAngle, 'id' | 'title' | 'pillar' | 'city'> & {
    news_items?: { id: string; title: string; url: string } | null
  }) | null
}

export const CONTENT_CHANNELS: ContentChannel[] = [
  'blog',
  'linkedin',
  'instagram',
  'facebook',
  'newsletter',
]

/**
 * `tone` porte le canal, pas l'urgence : c'est la couleur de pastille du
 * calendrier, ce qui permet de lire une semaine d'un coup d'oeil.
 */
export const CONTENT_CHANNEL_META: Record<
  ContentChannel,
  { label: string; short: string; tone: ContentTone }
> = {
  blog: { label: 'Blog', short: 'Blog', tone: 'brand' },
  linkedin: { label: 'LinkedIn', short: 'in', tone: 'success' },
  instagram: { label: 'Instagram', short: 'IG', tone: 'danger' },
  facebook: { label: 'Facebook', short: 'FB', tone: 'warning' },
  newsletter: { label: 'Newsletter', short: 'News', tone: 'neutral' },
}

export const CONTENT_POST_STATUSES: ContentPostStatus[] = [
  'draft',
  'ready',
  'scheduled',
  'published',
  'cancelled',
]

export const CONTENT_POST_STATUS_META: Record<
  ContentPostStatus,
  { label: string; tone: ContentTone }
> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  ready: { label: 'Prêt', tone: 'brand' },
  scheduled: { label: 'Planifié', tone: 'warning' },
  published: { label: 'Publié', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
}

export const CONTENT_ANGLE_STATUSES: ContentAngleStatus[] = ['idea', 'planned', 'done', 'dropped']

export const CONTENT_ANGLE_STATUS_META: Record<
  ContentAngleStatus,
  { label: string; tone: ContentTone }
> = {
  idea: { label: 'Idée', tone: 'neutral' },
  planned: { label: 'Planifié', tone: 'brand' },
  done: { label: 'Traité', tone: 'success' },
  dropped: { label: 'Abandonné', tone: 'neutral' },
}

/** Piliers editoriaux : memes valeurs que `news_items.category`. */
export type ContentPillar = NewsCategory

import type { Database, NewsCategory, NewsConfidence, NewsStatus } from '@/types/supabase'

export type { NewsCategory, NewsConfidence, NewsStatus }

/** Tons admis par `StatusPill` (`src/components/pro/status-pill.tsx`). */
export type NewsStatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export type NewsItem = Database['public']['Tables']['news_items']['Row']

export const NEWS_CATEGORIES: NewsCategory[] = [
  'taux',
  'reglementation',
  'marche_national',
  'marche_local',
  'premium',
  'conseils',
]

export const NEWS_CATEGORY_META: Record<NewsCategory, { label: string }> = {
  taux: { label: 'Taux & crédit' },
  reglementation: { label: 'Réglementation & fiscalité' },
  marche_national: { label: 'Marché national' },
  marche_local: { label: 'Marché local (Var)' },
  premium: { label: 'Premium & luxe' },
  conseils: { label: 'Conseils vendeurs / acquéreurs' },
}

export const NEWS_STATUS_META: Record<NewsStatus, { label: string; tone: NewsStatusTone }> = {
  new: { label: 'Nouveau', tone: 'neutral' },
  reviewed: { label: 'Relu', tone: 'brand' },
  newsletter: { label: 'Newsletter', tone: 'success' },
  published: { label: 'Publié', tone: 'success' },
  archived: { label: 'Archivé', tone: 'neutral' },
}

/** Repartition par statut, renvoyee par `GET /api/market/news` pour les compteurs d'onglets. */
export type NewsStatusCounts = Record<NewsStatus, number>

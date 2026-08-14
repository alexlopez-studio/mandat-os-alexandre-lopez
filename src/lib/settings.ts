// ═══════════════════════════════════════════════════════════════
// App Settings — paramètres clé/valeur persistés dans Supabase
// (table public.app_settings, voir migration 006)
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_MAX_CRAWL_AGE_DAYS, type ListingQualityOptions } from '@/lib/stream-estate'
import type { Json } from '@/types/supabase'

// ── Cadence de re-vérification du monitoring (règles, ajustables) ──
// Intervalle minimal en heures entre deux re-checks d'un lead, selon sa phase.
export const MONITORING_RECHECK_HOURS_KEYS = {
  golden: 'monitoring_recheck_hours_golden',
  hot: 'monitoring_recheck_hours_hot',
  warm: 'monitoring_recheck_hours_warm',
  cold: 'monitoring_recheck_hours_cold',
} as const

export const DEFAULT_MONITORING_RECHECK_HOURS = { golden: 20, hot: 20, warm: 20, cold: 72 }

export type MonitoringRecheckHours = typeof DEFAULT_MONITORING_RECHECK_HOURS

/**
 * Lit un paramètre par sa clé. Retourne `fallback` si la clé n'existe
 * pas ou si Supabase est inaccessible (ne doit jamais faire planter
 * un cron ou une API route).
 */
export async function getSetting<T extends Json>(key: string, fallback: T): Promise<T> {
    try {
        const { data, error } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .maybeSingle()

        if (error || !data) return fallback
        return (data.value as T) ?? fallback
    } catch (err) {
        console.error(`[settings] Erreur lecture "${key}":`, err)
        return fallback
    }
}

/**
 * Écrit (upsert) un paramètre.
 */
export async function setSetting(key: string, value: Json): Promise<void> {
    const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) throw error
}

// ── Qualité des annonces Stream Estate ────────────────────────────
export const STREAM_ESTATE_QUALITY_KEYS = {
    maxCrawlAgeDays: 'stream_estate_max_crawl_age_days',
    requireCoherentPrice: 'stream_estate_require_coherent_price',
    importWindowDays: 'stream_estate_import_window_days',
} as const

/**
 * Fenêtre `fromUpdatedAt` appliquée aux imports, en jours.
 *
 * Sans elle, on paie l'intégralité des annonces jamais marquées expirées par
 * Stream Estate : 88 à 94 % du total sur les communes mesurées (Pontevès 164 → 20
 * réellement vivants, Brignoles 9 062 → 951). Le filtre serveur évite de payer
 * ce cimetière, le filtre de fraîcheur côté client fait ensuite le tri fin.
 *
 * 180 jours : sur 30 biens tirés de la bande écartée (contenu figé depuis 180 à
 * 365 j), 30 avaient aussi cessé d'être crawlés — zéro annonce vivante perdue.
 * `0` désactive la fenêtre (on repaie tout).
 */
export const DEFAULT_IMPORT_WINDOW_DAYS = 180

export async function getStreamEstateImportWindowDays(): Promise<number> {
    const raw = await getSetting<number>(STREAM_ESTATE_QUALITY_KEYS.importWindowDays, DEFAULT_IMPORT_WINDOW_DAYS)
    const days = Number(raw)
    return Number.isFinite(days) && days >= 0 ? Math.floor(days) : DEFAULT_IMPORT_WINDOW_DAYS
}

/** Date ISO correspondant à `days` jours en arrière, ou null si `days` vaut 0. */
export function windowStartIso(days: number): string | null {
    return days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : null
}

/**
 * Critères d'admission des annonces importées depuis Stream Estate.
 * Ajustables sans redéploiement via `app_settings`.
 */
export async function getStreamEstateQualityOptions(): Promise<ListingQualityOptions> {
    const [maxCrawlAgeDays, requireCoherentPrice] = await Promise.all([
        getSetting<number>(STREAM_ESTATE_QUALITY_KEYS.maxCrawlAgeDays, DEFAULT_MAX_CRAWL_AGE_DAYS),
        getSetting<boolean>(STREAM_ESTATE_QUALITY_KEYS.requireCoherentPrice, true),
    ])
    const days = Number(maxCrawlAgeDays)

    return {
        maxCrawlAgeDays: Number.isFinite(days) && days >= 0 ? days : DEFAULT_MAX_CRAWL_AGE_DAYS,
        requireCoherentPrice: requireCoherentPrice !== false,
    }
}

/**
 * Cadence de re-vérification du monitoring (heures par phase), ajustable depuis
 * les réglages. Valeurs positives garanties, défauts si absentes/invalides.
 */
export async function getMonitoringRecheckHours(): Promise<MonitoringRecheckHours> {
    const [golden, hot, warm, cold] = await Promise.all([
        getSetting<number>(MONITORING_RECHECK_HOURS_KEYS.golden, DEFAULT_MONITORING_RECHECK_HOURS.golden),
        getSetting<number>(MONITORING_RECHECK_HOURS_KEYS.hot, DEFAULT_MONITORING_RECHECK_HOURS.hot),
        getSetting<number>(MONITORING_RECHECK_HOURS_KEYS.warm, DEFAULT_MONITORING_RECHECK_HOURS.warm),
        getSetting<number>(MONITORING_RECHECK_HOURS_KEYS.cold, DEFAULT_MONITORING_RECHECK_HOURS.cold),
    ])
    const pos = (v: unknown, d: number) => {
        const n = Number(v)
        return Number.isFinite(n) && n > 0 ? n : d
    }
    return {
        golden: pos(golden, DEFAULT_MONITORING_RECHECK_HOURS.golden),
        hot: pos(hot, DEFAULT_MONITORING_RECHECK_HOURS.hot),
        warm: pos(warm, DEFAULT_MONITORING_RECHECK_HOURS.warm),
        cold: pos(cold, DEFAULT_MONITORING_RECHECK_HOURS.cold),
    }
}

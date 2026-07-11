// ═══════════════════════════════════════════════════════════════
// App Settings — paramètres clé/valeur persistés dans Supabase
// (table public.app_settings, voir migration 006)
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

export const MANDATFINDER_PIPELINE_ENABLED_KEY = 'mandatfinder_pipeline_enabled'

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

/**
 * Indique si le pipeline MandatFinder (import Stream Estate + scoring)
 * est activé. Par défaut `true` pour conserver le comportement actuel
 * si le paramètre n'existe pas encore.
 */
export async function isMandatFinderPipelineEnabled(): Promise<boolean> {
    return getSetting<boolean>(MANDATFINDER_PIPELINE_ENABLED_KEY, true)
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

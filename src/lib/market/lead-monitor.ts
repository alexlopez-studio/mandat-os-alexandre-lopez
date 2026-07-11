// ═══════════════════════════════════════════════════════════════
// MandatFinder — Suivi ciblé des leads connus (économie de crédits)
// Au lieu de re-scanner toute la zone (on re-paierait tous les items),
// on re-récupère NOS annonces actives une par une par leur id
// (~1 item chacune) pour détecter baisse de prix / retrait, puis on
// re-score. Cf. mémoire stream-estate-credit-optimization.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import { fetchListingStatusById } from '@/lib/stream-estate'
import {
  getStreamEstateBudgetSnapshot,
  getAvailableStreamEstateItems,
  recordStreamEstateUsageEvent,
} from '@/lib/stream-estate-budget'
import { rescoreAndPersist } from './mandate-score-persist'
import { getMonitoringRecheckHours } from '@/lib/settings'

export interface LeadMonitorResult {
  skipped: boolean
  reason?: string
  checked: number
  price_changes: number
  expired: number
  billed_items: number
  estimated_cost_eur: number
}

const TERMINAL_STATUSES = ['expired', 'removed', 'sold', 'vendu']

const HOUR = 60 * 60 * 1000

const PHASE_PRIORITY: Record<string, number> = { golden: 3, hot: 2, warm: 1, cold: 0 }

interface LeadRow {
  id: string
  external_id: string | null
  zipcode: string | null
  price: number | null
  status: string | null
  mandate_phase: string | null
  scored_at: string | null
}

/**
 * Un lead est « à re-vérifier » si jamais scoré, ou si l'intervalle de sa phase
 * (réglages, ajustables) est écoulé. Phase inconnue → cadence des biens froids.
 */
function isDue(lead: LeadRow, now: number, intervalsMs: Record<string, number>): boolean {
  if (!lead.scored_at) return true
  const interval = intervalsMs[lead.mandate_phase ?? ''] ?? intervalsMs.cold
  const age = now - new Date(lead.scored_at).getTime()
  return Number.isNaN(age) || age >= interval
}

/**
 * Re-vérifie l'état des leads connus actifs (prix + retrait) via l'endpoint
 * par-id, dans la limite du budget Stream Estate. Best-effort, par bien.
 *
 * Sélection : seuls les biens « dus » selon leur cadence de phase sont vérifiés
 * (chauds/golden quotidiens, froids en roulement) → coût sous-linéaire.
 */
export async function monitorKnownLeads(maxLeads = 200): Promise<LeadMonitorResult> {
  const empty: LeadMonitorResult = {
    skipped: true, checked: 0, price_changes: 0, expired: 0, billed_items: 0, estimated_cost_eur: 0,
  }

  const snapshot = await getStreamEstateBudgetSnapshot()
  if (!snapshot.syncEnabled) return { ...empty, reason: 'stream_estate_sync_disabled' }

  const available = getAvailableStreamEstateItems(snapshot)
  if (available < 1) return { ...empty, reason: 'stream_estate_budget_insufficient' }

  // Cadence ajustable (réglages) → intervalles en ms par phase.
  const hours = await getMonitoringRecheckHours()
  const intervalsMs: Record<string, number> = {
    golden: hours.golden * HOUR,
    hot: hours.hot * HOUR,
    warm: hours.warm * HOUR,
    cold: hours.cold * HOUR,
  }

  // On lit les candidats actifs puis on applique les règles de cadence en mémoire
  // (portefeuille modeste) pour décider qui est « dû » ce soir.
  const { data: candidates, error } = await supabaseAdmin
    .from('market_properties')
    .select('id, external_id, zipcode, price, status, mandate_phase, scored_at')
    .eq('source', 'stream_estate')
    .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
    .limit(5000)

  if (error) {
    console.error('[monitorKnownLeads] lecture leads:', error.message)
    return { ...empty, reason: 'read_error' }
  }

  const now = Date.now()
  const leads = (candidates as LeadRow[] ?? [])
    .filter((l) => l.external_id && isDue(l, now, intervalsMs))
    .sort((a, b) => {
      // Priorité : phase la plus chaude d'abord, puis le plus anciennement scoré.
      const pa = PHASE_PRIORITY[a.mandate_phase ?? ''] ?? 0
      const pb = PHASE_PRIORITY[b.mandate_phase ?? ''] ?? 0
      if (pa !== pb) return pb - pa
      return new Date(a.scored_at ?? 0).getTime() - new Date(b.scored_at ?? 0).getTime()
    })
    .slice(0, Math.min(maxLeads, available))

  if (leads.length === 0) {
    return { ...empty, skipped: false }
  }

  const cost = snapshot.costPerItemEur
  let checked = 0
  let priceChanges = 0
  let expiredCount = 0
  let billed = 0

  for (const lead of leads) {
    if (!lead.external_id) continue
    const startedAt = new Date().toISOString()
    let detail
    try {
      detail = await fetchListingStatusById(lead.external_id)
    } catch (e) {
      await recordStreamEstateUsageEvent({
        syncRunId: null, zipcode: lead.zipcode ?? '', endpoint: '/documents/properties/{id}',
        page: 1, requestStatus: 'error', itemCount: 0, estimatedCostEur: 0,
        startedAt, finishedAt: new Date().toISOString(),
        errorMessage: e instanceof Error ? e.message : 'unknown',
        source: 'monitoring',
        eventType: 'property.status.check',
      })
      continue
    }

    billed++
    checked++
    await recordStreamEstateUsageEvent({
      syncRunId: null, zipcode: lead.zipcode ?? '', endpoint: '/documents/properties/{id}',
      page: 1, requestStatus: 'success', itemCount: 1, estimatedCostEur: cost,
      startedAt, finishedAt: new Date().toISOString(),
      source: 'monitoring',
      eventType: 'property.status.check',
    })

    const now = new Date().toISOString()

    if (detail === null || detail.expired) {
      await supabaseAdmin
        .from('market_properties')
        .update({ status: 'expired', expired_at: now, last_seen_at: now })
        .eq('id', lead.id)
      expiredCount++
    } else {
      const newPrice = detail.price ?? null
      if (newPrice != null && lead.price != null && newPrice !== lead.price) {
        await supabaseAdmin.from('property_price_history').insert({
          market_property_id: lead.id,
          old_price: lead.price,
          new_price: newPrice,
          variation_amount: newPrice - lead.price,
          variation_percent: lead.price > 0
            ? Math.round(((newPrice - lead.price) / lead.price) * 10000) / 100
            : 0,
        })
        priceChanges++
      }
      const update: Record<string, unknown> = { price: newPrice ?? lead.price, last_seen_at: now }
      if (detail.sellerType) update.seller_type = detail.sellerType
      await supabaseAdmin.from('market_properties').update(update as never).eq('id', lead.id)
    }

    // Re-score + alerte éventuelle (passage hot/golden).
    await rescoreAndPersist(lead.id)
  }

  return {
    skipped: false,
    checked,
    price_changes: priceChanges,
    expired: expiredCount,
    billed_items: billed,
    estimated_cost_eur: Math.round(billed * cost * 100) / 100,
  }
}

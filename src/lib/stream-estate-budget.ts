import { supabaseAdmin } from '@/lib/supabase'
import { getSetting } from '@/lib/settings'

export const STREAM_ESTATE_SYNC_ENABLED_KEY = 'stream_estate_sync_enabled'
export const STREAM_ESTATE_MANUAL_BALANCE_KEY = 'stream_estate_manual_balance_eur'
export const STREAM_ESTATE_COST_PER_REQUEST_KEY = 'stream_estate_cost_per_request_eur'
export const STREAM_ESTATE_MAX_REQUESTS_PER_SYNC_KEY = 'stream_estate_max_requests_per_sync'
export const STREAM_ESTATE_MIN_BALANCE_KEY = 'stream_estate_min_balance_eur'
export const STREAM_ESTATE_MONTHLY_BUDGET_KEY = 'stream_estate_monthly_budget_eur'
export const STREAM_ESTATE_WEBHOOK_EVENT_COST_KEY = 'stream_estate_webhook_event_cost_eur'
// Mode « illimité » : la sync manuelle tire toute la base en ligne d'une zone,
// bornée uniquement par le budget disponible (ignore max_items_per_sync).
export const STREAM_ESTATE_UNLIMITED_ITEMS_KEY = 'stream_estate_unlimited_items'

const DEFAULT_SYNC_ENABLED = false
const DEFAULT_MANUAL_BALANCE_EUR = 0
const DEFAULT_COST_PER_REQUEST_EUR = 0.01
const DEFAULT_MAX_REQUESTS_PER_SYNC = 30
const DEFAULT_MIN_BALANCE_EUR = 0
const DEFAULT_UNLIMITED_ITEMS = false
const DEFAULT_MONTHLY_BUDGET_EUR = 0
const DEFAULT_WEBHOOK_EVENT_COST_EUR = 0

export type StreamEstateBudgetSettings = {
  syncEnabled: boolean
  manualBalanceEur: number
  costPerItemEur: number
  webhookEventCostEur: number
  maxItemsPerSync: number
  minBalanceEur: number
  monthlyBudgetEur: number
  unlimitedItems: boolean
}

export type StreamEstateBudgetSnapshot = StreamEstateBudgetSettings & {
  estimatedSpentTotalEur: number
  estimatedSpentTodayEur: number
  estimatedSpentMonthEur: number
  estimatedMonthRemainingEur: number
  estimatedBalanceEur: number
  costPerRequestEur: number
  maxRequestsPerSync: number
  estimatedItemsTotal: number
  estimatedItemsToday: number
  estimatedItemsMonth: number
  externalRequestsTotal: number
  externalRequestsToday: number
  externalRequestsMonth: number
  webhookEventsTotal: number
  webhookEventsToday: number
  webhookEventsMonth: number
  lastBlockedReason: string | null
}

export type StreamEstateUsageEventInput = {
  syncRunId: string | null
  zipcode: string
  endpoint: string
  page: number
  requestStatus: 'success' | 'error'
  itemCount: number
  estimatedCostEur: number
  startedAt: string
  finishedAt: string
  errorMessage?: string | null
  source?: 'manual' | 'reconcile' | 'webhook' | 'monitoring'
  eventType?: string | null
}

function numericSetting(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function startOfTodayIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

function startOfMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export async function getStreamEstateBudgetSettings(): Promise<StreamEstateBudgetSettings> {
  const [
    syncEnabled,
    manualBalance,
    costPerRequest,
    maxRequests,
    minBalance,
    monthlyBudget,
    webhookEventCost,
    unlimitedItems,
  ] = await Promise.all([
    getSetting<boolean>(STREAM_ESTATE_SYNC_ENABLED_KEY, DEFAULT_SYNC_ENABLED),
    getSetting<number>(STREAM_ESTATE_MANUAL_BALANCE_KEY, DEFAULT_MANUAL_BALANCE_EUR),
    getSetting<number>(STREAM_ESTATE_COST_PER_REQUEST_KEY, DEFAULT_COST_PER_REQUEST_EUR),
    getSetting<number>(STREAM_ESTATE_MAX_REQUESTS_PER_SYNC_KEY, DEFAULT_MAX_REQUESTS_PER_SYNC),
    getSetting<number>(STREAM_ESTATE_MIN_BALANCE_KEY, DEFAULT_MIN_BALANCE_EUR),
    getSetting<number>(STREAM_ESTATE_MONTHLY_BUDGET_KEY, DEFAULT_MONTHLY_BUDGET_EUR),
    getSetting<number>(STREAM_ESTATE_WEBHOOK_EVENT_COST_KEY, DEFAULT_WEBHOOK_EVENT_COST_EUR),
    getSetting<boolean>(STREAM_ESTATE_UNLIMITED_ITEMS_KEY, DEFAULT_UNLIMITED_ITEMS),
  ])

  return {
    syncEnabled: Boolean(syncEnabled),
    manualBalanceEur: Math.max(0, numericSetting(manualBalance, DEFAULT_MANUAL_BALANCE_EUR)),
    costPerItemEur: Math.max(0, numericSetting(costPerRequest, DEFAULT_COST_PER_REQUEST_EUR)),
    webhookEventCostEur: Math.max(0, numericSetting(webhookEventCost, DEFAULT_WEBHOOK_EVENT_COST_EUR)),
    maxItemsPerSync: Math.max(1, Math.floor(numericSetting(maxRequests, DEFAULT_MAX_REQUESTS_PER_SYNC))),
    minBalanceEur: Math.max(0, numericSetting(minBalance, DEFAULT_MIN_BALANCE_EUR)),
    monthlyBudgetEur: Math.max(0, numericSetting(monthlyBudget, DEFAULT_MONTHLY_BUDGET_EUR)),
    unlimitedItems: Boolean(unlimitedItems),
  }
}

async function sumUsageSince(since?: string): Promise<{ items: number; cost: number; webhookEvents: number }> {
  try {
    let query = supabaseAdmin
      .from('stream_estate_usage_events')
      .select('estimated_cost_eur, item_count, source')

    if (since) query = query.gte('created_at', since)

    const { data, error } = await query.limit(5000)
    if (error) {
      let legacyQuery = supabaseAdmin
        .from('stream_estate_usage_events')
        .select('estimated_cost_eur')

      if (since) legacyQuery = legacyQuery.gte('created_at', since)

      const legacy = await legacyQuery.limit(5000)
      if (legacy.error) {
        console.error('[stream-estate-budget] usage summary unavailable:', legacy.error.message)
        return { items: 0, cost: 0, webhookEvents: 0 }
      }

      const legacyRows = legacy.data ?? []
      return {
        items: legacyRows.length,
        cost: legacyRows.reduce((sum, row) => sum + Number(row.estimated_cost_eur ?? 0), 0),
        webhookEvents: 0,
      }
    }

    const rows = data ?? []
    return {
      items: rows.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.item_count ?? 0) || 0)), 0),
      cost: rows.reduce((sum, row) => sum + Number(row.estimated_cost_eur ?? 0), 0),
      webhookEvents: rows.filter((row) => row.source === 'webhook').length,
    }
  } catch (err) {
    console.error('[stream-estate-budget] usage summary failed:', err)
    return { items: 0, cost: 0, webhookEvents: 0 }
  }
}

async function getLastBlockedReason(): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sync_runs')
      .select('blocked_reason')
      .not('blocked_reason', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return null
    return data?.blocked_reason ?? null
  } catch {
    return null
  }
}

export async function getStreamEstateBudgetSnapshot(): Promise<StreamEstateBudgetSnapshot> {
  const settings = await getStreamEstateBudgetSettings()
  const [total, today, month, lastBlockedReason] = await Promise.all([
    sumUsageSince(),
    sumUsageSince(startOfTodayIso()),
    sumUsageSince(startOfMonthIso()),
    getLastBlockedReason(),
  ])

  return {
    ...settings,
    estimatedSpentTotalEur: total.cost,
    estimatedSpentTodayEur: today.cost,
    estimatedSpentMonthEur: month.cost,
    estimatedMonthRemainingEur: Math.max(0, settings.monthlyBudgetEur - month.cost),
    estimatedBalanceEur: Math.max(0, settings.manualBalanceEur - total.cost),
    costPerRequestEur: settings.costPerItemEur,
    maxRequestsPerSync: settings.maxItemsPerSync,
    estimatedItemsTotal: total.items,
    estimatedItemsToday: today.items,
    estimatedItemsMonth: month.items,
    externalRequestsTotal: total.items,
    externalRequestsToday: today.items,
    externalRequestsMonth: month.items,
    webhookEventsTotal: total.webhookEvents,
    webhookEventsToday: today.webhookEvents,
    webhookEventsMonth: month.webhookEvents,
    lastBlockedReason,
  }
}

/**
 * Nombre d'items que le budget peut financer (cap budgétaire pur).
 * Le plafond `max_items_per_sync` est appliqué séparément par les routes via Math.min,
 * sauf en mode illimité où on l'ignore. Quand le coût/item est nul, le budget est de
 * facto infini → MAX_SAFE_INTEGER (les routes le re-bornent au besoin).
 */
export function getAvailableStreamEstateItems(snapshot: StreamEstateBudgetSnapshot): number {
  if (snapshot.costPerItemEur <= 0) return Number.MAX_SAFE_INTEGER
  const balanceSpendable = snapshot.estimatedBalanceEur - snapshot.minBalanceEur
  const monthlySpendable = snapshot.monthlyBudgetEur > 0 ? snapshot.estimatedMonthRemainingEur : Number.MAX_SAFE_INTEGER
  const spendable = Math.min(balanceSpendable, monthlySpendable)
  if (spendable <= 0) return 0
  return Math.floor(spendable / snapshot.costPerItemEur)
}

export const getAvailableStreamEstateRequests = getAvailableStreamEstateItems

/**
 * Plafond effectif d'items pour UNE synchronisation :
 * - mode illimité → seul le budget borne (toute la base en ligne) ;
 * - sinon → min(max_items_per_sync, budget disponible).
 */
export function getStreamEstateSyncItemCap(snapshot: StreamEstateBudgetSnapshot): number {
  const budgetItems = getAvailableStreamEstateItems(snapshot)
  return snapshot.unlimitedItems ? budgetItems : Math.min(snapshot.maxItemsPerSync, budgetItems)
}

export async function canSpendStreamEstateItems(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const snapshot = await getStreamEstateBudgetSnapshot()

  if (!snapshot.syncEnabled) {
    return { ok: false, reason: 'stream_estate_sync_disabled' }
  }

  if (getAvailableStreamEstateItems(snapshot) < 1) {
    return { ok: false, reason: 'stream_estate_budget_insufficient' }
  }

  return { ok: true }
}

export const canSpendStreamEstateRequest = canSpendStreamEstateItems

export async function recordStreamEstateUsageEvent(input: StreamEstateUsageEventInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('stream_estate_usage_events')
      .insert({
        sync_run_id: input.syncRunId,
        zipcode: input.zipcode,
        endpoint: input.endpoint,
        page: input.page,
        request_status: input.requestStatus,
        item_count: input.itemCount,
        estimated_cost_eur: input.estimatedCostEur,
        started_at: input.startedAt,
        finished_at: input.finishedAt,
        error_message: input.errorMessage ?? null,
        source: input.source ?? 'manual',
        event_type: input.eventType ?? null,
      })

    if (error) {
      const retry = await supabaseAdmin
        .from('stream_estate_usage_events')
        .insert({
          sync_run_id: input.syncRunId,
          zipcode: input.zipcode,
          endpoint: input.endpoint,
          page: input.page,
          request_status: input.requestStatus,
          item_count: input.itemCount,
          estimated_cost_eur: input.estimatedCostEur,
          started_at: input.startedAt,
          finished_at: input.finishedAt,
          error_message: input.errorMessage ?? null,
        })
      if (retry.error) {
        console.error('[stream-estate-budget] usage event insert failed:', retry.error.message)
      }
    }
  } catch (err) {
    console.error('[stream-estate-budget] usage event insert crashed:', err)
  }
}

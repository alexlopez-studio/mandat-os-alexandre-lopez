import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getStreamEstateBudgetSnapshot } from '@/lib/stream-estate-budget'
import { getSetting } from '@/lib/settings'

const STREAM_ESTATE_RESYNC_WINDOW_KEY = 'stream_estate_resync_window_minutes'
const DEFAULT_RESYNC_WINDOW_MINUTES = 360

type SyncRunStat = {
  id: string
  zone_id: string | null
  started_at: string | null
  fetched_count: number | null
  status: string | null
  external_request_count?: number | null
  external_item_count?: number | null
  estimated_cost_eur?: number | null
  blocked_reason?: string | null
  source?: string | null
}

async function fetchSyncRuns(): Promise<SyncRunStat[]> {
  const fullSelect = 'id, zone_id, started_at, fetched_count, status, external_request_count, external_item_count, estimated_cost_eur, blocked_reason, source'
  const legacySelect = 'id, zone_id, started_at, fetched_count, status'

  const full = await supabaseAdmin
    .from('sync_runs')
    .select(fullSelect)
    .order('started_at', { ascending: false })
    .limit(2000)

  if (!full.error) return (full.data ?? []) as SyncRunStat[]

  const legacy = await supabaseAdmin
    .from('sync_runs')
    .select(legacySelect)
    .order('started_at', { ascending: false })
    .limit(2000)

  if (legacy.error) {
    console.error('[API /market/sync-stats] sync_runs error:', legacy.error.message)
    return []
  }

  return (legacy.data ?? []) as SyncRunStat[]
}

/**
 * GET /api/market/sync-stats
 * Agrège les statistiques de consommation Stream Estate et la fraîcheur par zone.
 */
export async function GET() {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    // Tous les sync_runs (cap 2000 pour éviter de charger trop)
    const runs = await fetchSyncRuns()
    const todayRuns = runs.filter((r) => (r.started_at ?? '') >= todayStart)
    const monthRuns = runs.filter((r) => (r.started_at ?? '') >= monthStart)

    const total_syncs = runs.length
    const syncs_today = todayRuns.length
    const syncs_this_month = monthRuns.length
    const properties_fetched_total = runs.reduce((s, r) => s + (r.fetched_count ?? 0), 0)
    const properties_fetched_today = todayRuns.reduce((s, r) => s + (r.fetched_count ?? 0), 0)
    const properties_fetched_month = monthRuns.reduce((s, r) => s + (r.fetched_count ?? 0), 0)
    const last_sync_at = runs[0]?.started_at ?? null
    const budget = await getStreamEstateBudgetSnapshot()
    const resyncWindowRaw = await getSetting<number>(STREAM_ESTATE_RESYNC_WINDOW_KEY, DEFAULT_RESYNC_WINDOW_MINUTES)
    const resyncWindowMinutes = Number.isFinite(Number(resyncWindowRaw))
      ? Math.max(0, Math.floor(Number(resyncWindowRaw)))
      : DEFAULT_RESYNC_WINDOW_MINUTES

    // Sparkline : items par jour sur les 30 derniers jours
    const sparklineMap: Record<string, { syncs: number; fetched: number }> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      sparklineMap[key] = { syncs: 0, fetched: 0 }
    }
    for (const run of runs.filter((r) => (r.started_at ?? '') >= thirtyDaysAgo)) {
      const key = (run.started_at ?? '').slice(0, 10)
      if (sparklineMap[key]) {
        sparklineMap[key].syncs++
        sparklineMap[key].fetched += run.fetched_count ?? 0
      }
    }
    const sparkline = Object.entries(sparklineMap).map(([date, v]) => ({ date, ...v }))

    // Zones avec statut de fraîcheur et nombre de biens
    const { data: zones } = await supabaseAdmin
      .from('monitored_zones')
      .select('id, name, zipcode, city, insee_code, last_synced_at, last_reconciled_at, stream_estate_search_id, active, sync_frequency')
      .order('created_at', { ascending: true })

    const monitoredZipcodes = new Set((zones ?? []).map((zone) => zone.zipcode).filter(Boolean))
    const { data: propertyZipcodes } = await supabaseAdmin
      .from('market_properties')
      .select('id, zipcode')
      .limit(10000)

    const orphanProperties = (propertyZipcodes ?? []).filter((property) => {
      if (!property.zipcode) return true
      return !monitoredZipcodes.has(property.zipcode)
    })
    const orphanByZipcode = orphanProperties.reduce<Record<string, number>>((acc, property) => {
      const key = property.zipcode ?? 'sans_cp'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const zoneStats = await Promise.all(
      (zones ?? []).map(async (zone) => {
        // Dernier run pour cette zone
        const lastRun = runs.find((r) => r.zone_id === zone.id)
        const lastSuccessRun = runs.find((r) => r.zone_id === zone.id && r.status === 'success')

        // Nombre de biens en base pour cette zone : par INSEE si la zone cible une commune
        // exacte (plusieurs communes peuvent partager un CP), sinon par code postal.
        const zoneInsee = (zone as { insee_code?: string | null }).insee_code ?? null
        const zoneFilterColumn = zoneInsee ? 'insee_code' : 'zipcode'
        const zoneFilterValue = zoneInsee ?? zone.zipcode

        const { count: property_count } = await supabaseAdmin
          .from('market_properties')
          .select('id', { count: 'exact', head: true })
          .eq(zoneFilterColumn, zoneFilterValue)

        const { count: not_seen_property_count } = lastSuccessRun?.started_at
          ? await supabaseAdmin
              .from('market_properties')
              .select('id', { count: 'exact', head: true })
              .eq(zoneFilterColumn, zoneFilterValue)
              .lt('last_seen_at', lastSuccessRun.started_at)
          : { count: 0 }

        const totalProperties = property_count ?? 0
        const notSeenProperties = not_seen_property_count ?? 0

        return {
          zone_id: zone.id,
          name: zone.name,
          zipcode: zone.zipcode,
          city: zone.city,
          last_synced_at: zone.last_synced_at,
          last_reconciled_at: (zone as { last_reconciled_at?: string | null }).last_reconciled_at ?? null,
          stream_estate_search_id: (zone as { stream_estate_search_id?: string | null }).stream_estate_search_id ?? null,
          active: zone.active,
          sync_frequency: zone.sync_frequency,
          last_sync_status: lastRun?.status ?? null,
          last_sync_started_at: lastRun?.started_at ?? null,
          last_success_sync_at: lastSuccessRun?.started_at ?? null,
          last_external_requests: lastRun?.external_item_count ?? lastRun?.external_request_count ?? 0,
          last_estimated_cost_eur: lastRun?.estimated_cost_eur ?? 0,
          last_blocked_reason: lastRun?.blocked_reason ?? null,
          property_count: totalProperties,
          seen_property_count: Math.max(0, totalProperties - notSeenProperties),
          not_seen_property_count: notSeenProperties,
        }
      }),
    )

    return NextResponse.json({
      total_syncs,
      syncs_today,
      syncs_this_month,
      properties_fetched_total,
      properties_fetched_today,
      properties_fetched_month,
      last_sync_at,
      sparkline,
      zones: zoneStats,
      orphan_properties: {
        count: orphanProperties.length,
        zipcodes: Object.entries(orphanByZipcode)
          .map(([zipcode, count]) => ({ zipcode, count }))
          .sort((a, b) => b.count - a.count || a.zipcode.localeCompare(b.zipcode)),
      },
      stream_estate_budget: {
        sync_enabled: budget.syncEnabled,
        manual_balance_eur: budget.manualBalanceEur,
        cost_per_item_eur: budget.costPerItemEur,
        max_items_per_sync: budget.maxItemsPerSync,
        unlimited_items: budget.unlimitedItems,
        cost_per_request_eur: budget.costPerItemEur,
        max_requests_per_sync: budget.maxItemsPerSync,
        min_balance_eur: budget.minBalanceEur,
        monthly_budget_eur: budget.monthlyBudgetEur,
        estimated_month_remaining_eur: budget.estimatedMonthRemainingEur,
        webhook_event_cost_eur: budget.webhookEventCostEur,
        resync_window_minutes: resyncWindowMinutes,
        estimated_balance_eur: budget.estimatedBalanceEur,
        estimated_spent_total_eur: budget.estimatedSpentTotalEur,
        estimated_spent_today_eur: budget.estimatedSpentTodayEur,
        estimated_spent_month_eur: budget.estimatedSpentMonthEur,
        estimated_items_total: budget.estimatedItemsTotal,
        estimated_items_today: budget.estimatedItemsToday,
        estimated_items_month: budget.estimatedItemsMonth,
        external_items_total: budget.externalRequestsTotal,
        external_items_today: budget.externalRequestsToday,
        external_items_month: budget.externalRequestsMonth,
        external_requests_total: budget.externalRequestsTotal,
        external_requests_today: budget.externalRequestsToday,
        external_requests_month: budget.externalRequestsMonth,
        webhook_events_total: budget.webhookEventsTotal,
        webhook_events_today: budget.webhookEventsToday,
        webhook_events_month: budget.webhookEventsMonth,
        last_blocked_reason: budget.lastBlockedReason,
      },
    })
  } catch (e) {
    console.error('[API /market/sync-stats]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

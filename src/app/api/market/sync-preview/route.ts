import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { previewListings } from '@/lib/stream-estate'
import {
  getStreamEstateImportWindowDays,
  getStreamEstateQualityOptions,
  windowStartIso,
} from '@/lib/settings'
import { getStreamEstateSyncItemCap, getStreamEstateBudgetSnapshot } from '@/lib/stream-estate-budget'

const ZIPCODE_RE = /^\d{5}$/
const ALLOWED_PROPERTY_TYPES = new Set([0, 1, 5])
const DEFAULT_PROPERTY_TYPES = [0, 1, 5]
// 0 = particulier (PAP), 1 = professionnel. Doit rester aligné sur /api/market/sync :
// le comptage sert de devis, il doit porter sur exactement le même périmètre.
const ALLOWED_PUBLISHER_TYPES = new Set([0, 1])
const DEFAULT_PUBLISHER_TYPES = [0]

function readMaxItems(body: Record<string, unknown> | null | undefined, fallback: number): number {
  const raw = body?.max_items ?? body?.maxItems ?? body?.max_requests_per_sync ?? body?.maxRequestsPerSync
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

function readPropertyTypes(body: Record<string, unknown> | null | undefined): number[] {
  const raw = body?.property_types ?? body?.propertyTypes
  const values = Array.isArray(raw) ? raw : []
  const parsed = values
    .map((value) => Number(value))
    .filter((value) => ALLOWED_PROPERTY_TYPES.has(value))
  return parsed.length > 0 ? Array.from(new Set(parsed)) : DEFAULT_PROPERTY_TYPES
}

function readPublisherTypes(body: Record<string, unknown> | null | undefined): number[] {
  const raw = body?.publisher_types ?? body?.publisherTypes
  const values = Array.isArray(raw) ? raw : []
  const parsed = values
    .map((value) => Number(value))
    .filter((value) => ALLOWED_PUBLISHER_TYPES.has(value))
  return parsed.length > 0 ? Array.from(new Set(parsed)).sort() : DEFAULT_PUBLISHER_TYPES
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const zipcode = body?.zipcode

    if (typeof zipcode !== 'string' || !ZIPCODE_RE.test(zipcode)) {
      return NextResponse.json({ error: 'zipcode invalide : un seul code postal à 5 chiffres est attendu' }, { status: 400 })
    }

    const budget = await getStreamEstateBudgetSnapshot()
    const propertyTypes = readPropertyTypes(body as Record<string, unknown>)
    const publisherTypes = readPublisherTypes(body as Record<string, unknown>)
    // Plafond effectif : en illimité, seul le budget borne (toute la base en ligne).
    const syncCap = getStreamEstateSyncItemCap(budget)
    const requestedMaxItems = readMaxItems(
      body as Record<string, unknown>,
      budget.unlimitedItems ? syncCap : budget.maxItemsPerSync,
    )
    const effectiveMaxItems = budget.unlimitedItems
      ? Math.min(requestedMaxItems, syncCap)
      : Math.min(requestedMaxItems, budget.maxItemsPerSync)

    // On prend l'INSEE fourni par le client (commune visée dans le panneau) en priorité,
    // sinon on retombe sur la zone CP existante. On évite `.maybeSingle()` qui plante dès
    // que deux communes partagent un CP.
    const rawInsee = (body as Record<string, unknown>)?.insee_code ?? (body as Record<string, unknown>)?.inseeCode
    let inseeCode: string | null =
      typeof rawInsee === 'string' && /^\d{5}$/.test(rawInsee) ? rawInsee : null

    if (!inseeCode) {
      const { data: zoneRows } = await supabaseAdmin
        .from('monitored_zones')
        .select('insee_code')
        .eq('zipcode', zipcode)
        .order('created_at', { ascending: true })
        .limit(1)
      inseeCode = (zoneRows?.[0]?.insee_code as string | null) ?? null
    }

    // Le devis doit porter sur exactement le périmètre de /api/market/sync :
    // même fenêtre d'import, sinon le coût annoncé est faux.
    const [importWindowDays, quality] = await Promise.all([
      getStreamEstateImportWindowDays(),
      getStreamEstateQualityOptions(),
    ])
    const preview = await previewListings({
      zipcode,
      inseeCode,
      maxItems: effectiveMaxItems,
      propertyTypes,
      publisherTypes,
      fromUpdatedAt: windowStartIso(importWindowDays),
      keptFromUpdatedAt: windowStartIso(quality.maxCrawlAgeDays ?? 0),
    })
    const estimatedItems = preview.estimatedItems
    const estimatedCostEur = estimatedItems * budget.costPerItemEur
    const availableItems = syncCap
    const balanceSpendable = Math.max(0, budget.estimatedBalanceEur - budget.minBalanceEur)
    const monthlySpendable = budget.monthlyBudgetEur > 0 ? budget.estimatedMonthRemainingEur : Number.MAX_SAFE_INTEGER
    const spendable = Math.min(balanceSpendable, monthlySpendable)
    // En illimité, pas de plafond max_items → jamais bloqué pour dépassement de ce plafond.
    const maxItemsBlocked = !budget.unlimitedItems && requestedMaxItems > budget.maxItemsPerSync

    return NextResponse.json({
      zipcode,
      unlimited_items: budget.unlimitedItems,
      requested_max_items: requestedMaxItems,
      budget_max_items_per_sync: budget.maxItemsPerSync,
      effective_max_items: effectiveMaxItems,
      max_items: effectiveMaxItems,
      property_types: propertyTypes,
      publisher_types: publisherTypes,
      total_available: preview.totalAvailable,
      provider_total_available: preview.providerTotalAvailable,
      // Ventilation gratuite pour vérifier l'exactitude du comptage.
      online_exact: preview.breakdown.onlineExact,
      total_exact: preview.breakdown.totalExact,
      // Cumul historique hors fenêtre : mesure ce qu'on évite de payer.
      online_all_time: preview.breakdown.onlineAllTime,
      estimated_kept: preview.breakdown.estimatedKept,
      import_window_days: importWindowDays,
      max_crawl_age_days: quality.maxCrawlAgeDays,
      estimated_items: estimatedItems,
      estimated_cost_eur: estimatedCostEur,
      estimated_balance_after: Math.max(0, budget.manualBalanceEur - budget.estimatedSpentTotalEur - estimatedCostEur),
      preview_capped: preview.capped,
      online_only: true,
      sync_enabled: budget.syncEnabled,
      can_confirm: budget.syncEnabled && availableItems >= 1 && estimatedCostEur <= spendable && !maxItemsBlocked,
      blocked_reason: !budget.syncEnabled
        ? 'stream_estate_sync_disabled'
        : maxItemsBlocked
          ? 'stream_estate_max_items_exceeded'
          : availableItems < 1 || estimatedCostEur > spendable
          ? 'stream_estate_budget_insufficient'
          : null,
      cost_per_item_eur: budget.costPerItemEur,
      min_balance_eur: budget.minBalanceEur,
      monthly_budget_eur: budget.monthlyBudgetEur,
      estimated_month_remaining_eur: budget.estimatedMonthRemainingEur,
      estimated_balance_eur: budget.estimatedBalanceEur,
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[API /market/sync-preview]', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

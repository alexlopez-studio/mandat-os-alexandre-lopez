import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchListings, StreamEstateRequestLimitError } from '@/lib/stream-estate'
import { upsertStreamEstateListing, type StreamEstateIngestSource } from '@/lib/market/upsert-listing'
import { getSetting } from '@/lib/settings'
import {
  canSpendStreamEstateItems,
  getStreamEstateSyncItemCap,
  getStreamEstateBudgetSnapshot,
  recordStreamEstateUsageEvent,
} from '@/lib/stream-estate-budget'

const ZIPCODE_RE = /^\d{5}$/
const ALLOWED_PROPERTY_TYPES = new Set([0, 1, 5])
const DEFAULT_PROPERTY_TYPES = [0, 1, 5]

// Moteur de règles `management_rules` neutralisé : le mandate_score est la source de
// vérité (motivation + dimensions + alertes). Les règles seed à conditions vides
// généraient un bruit massif de notifications `rule_triggered`. Réversible : passer à true.
const RULES_ENGINE_ENABLED = false

// Fenêtre anti-re-sync : on ne re-synchronise pas une zone vue récemment (0 appel API).
const STREAM_ESTATE_RESYNC_WINDOW_KEY = 'stream_estate_resync_window_minutes'
const DEFAULT_RESYNC_WINDOW_MINUTES = 360 // 6 h
const LEGACY_OPPORTUNITY_STAGE_MAP: Record<string, string> = {
  'À qualifier': 'Nouveau contact',
  'À analyser': 'Pré-estimation',
  'À contacter': 'Nouveau contact',
  Contacté: 'Pré-estimation',
  'Rendez-vous à préparer': 'RDV / Visite',
  'En suivi': 'Suivi moyen terme',
  'Mandat potentiel': 'Décision vendeur',
  Converti: 'Mandat signé',
  Écarté: 'Perdu / Écarté',
}

function normalizeOpportunityStage(stage: string | undefined) {
  return stage ? LEGACY_OPPORTUNITY_STAGE_MAP[stage] ?? stage : 'Nouveau contact'
}

async function getResyncWindowMinutes(): Promise<number> {
  const raw = await getSetting<number>(STREAM_ESTATE_RESYNC_WINDOW_KEY, DEFAULT_RESYNC_WINDOW_MINUTES)
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : DEFAULT_RESYNC_WINDOW_MINUTES
}

function errorResponse(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status })
}

function estimatedBalanceAfter(manualBalanceEur: number, totalSpentEur: number, currentRunCostEur: number) {
  return Math.max(0, manualBalanceEur - totalSpentEur - currentRunCostEur)
}

async function updateSyncRun(syncId: string | undefined, payload: Record<string, unknown>) {
  if (!syncId) return
  const { error } = await supabaseAdmin
    .from('sync_runs')
    .update(payload as never)
    .eq('id', syncId)

  if (error) {
    console.error('[API /market/sync] sync_run update failed:', error.message)
  }
}

async function createSyncRun(zoneId: string, status: 'running' | 'blocked', blockedReason?: string, source: StreamEstateIngestSource = 'manual') {
  const now = new Date().toISOString()

  const fullPayload = {
    zone_id: zoneId,
    provider: 'stream_estate',
    status,
    started_at: now,
    finished_at: status === 'blocked' ? now : null,
    fetched_count: 0,
    created_count: 0,
    updated_count: 0,
    external_request_count: 0,
    external_item_count: 0,
    estimated_cost_eur: 0,
    blocked_reason: blockedReason ?? null,
    error_message: blockedReason ?? null,
    source,
  }

  const legacyPayload = {
    zone_id: zoneId,
    provider: 'stream_estate',
    status,
    started_at: now,
    finished_at: status === 'blocked' ? now : null,
    fetched_count: 0,
    created_count: 0,
    updated_count: 0,
    error_message: blockedReason ?? null,
  }

  let { data, error } = await supabaseAdmin
    .from('sync_runs')
    .insert(fullPayload as never)
    .select('id')
    .single()

  if (error) {
    const retry = await supabaseAdmin
      .from('sync_runs')
      .insert(legacyPayload as never)
      .select('id')
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    throw new Error(`Impossible de créer le journal de synchronisation: ${error.message}`)
  }

  return data?.id as string | undefined
}

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

type ZoneInfo = { id: string; inseeCode: string | null; lastSyncedAt: string | null }

type ZoneLookup = { zipcode: string; inseeCode?: string | null; name?: string | null; city?: string | null }

/**
 * Identifie la zone à synchroniser. Une commune (code INSEE) est l'identité fine :
 * plusieurs communes peuvent partager un même code postal, donc on cible d'abord par INSEE
 * quand il est connu, et seulement sinon par CP (zone « catch-all » sans INSEE).
 * On évite `.maybeSingle()` qui plante dès que deux zones partagent un CP.
 */
async function getOrCreateZone({ zipcode, inseeCode, name, city }: ZoneLookup): Promise<ZoneInfo> {
  const normalizedInsee = inseeCode && /^\d{5}$/.test(inseeCode) ? inseeCode : null

  const baseSelect = supabaseAdmin
    .from('monitored_zones')
    .select('id, insee_code, last_synced_at')

  const query = normalizedInsee
    ? baseSelect.eq('insee_code', normalizedInsee)
    : baseSelect.eq('zipcode', zipcode).is('insee_code', null)

  const { data: matches } = await query
    .order('created_at', { ascending: true })
    .limit(1)

  const existingZone = matches?.[0]
  if (existingZone) {
    return {
      id: existingZone.id as string,
      inseeCode: (existingZone.insee_code as string | null) ?? null,
      lastSyncedAt: (existingZone.last_synced_at as string | null) ?? null,
    }
  }

  const { data: created } = await supabaseAdmin
    .from('monitored_zones')
    .insert({
      name: name?.trim() || (city?.trim() ? city.trim() : `Zone ${zipcode}`),
      zipcode,
      city: city?.trim() || null,
      insee_code: normalizedInsee,
      sync_frequency: 'manual',
    })
    .select('id, insee_code, last_synced_at')
    .single()

  if (!created) {
    throw new Error('Impossible de créer la zone')
  }

  return { id: created.id as string, inseeCode: (created.insee_code as string | null) ?? null, lastSyncedAt: null }
}

/**
 * POST /api/market/sync
 * Lance une synchronisation Stream Estate pour une zone surveillée.
 * Body : { zipcode: string, max_items?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const zipcode = body?.zipcode

    if (typeof zipcode !== 'string' || !ZIPCODE_RE.test(zipcode)) {
      return errorResponse('zipcode invalide : un seul code postal à 5 chiffres est attendu', 400)
    }

    const budget = await getStreamEstateBudgetSnapshot()
    const force = (body as Record<string, unknown>)?.force === true
    const propertyTypes = readPropertyTypes(body as Record<string, unknown>)
    const rawSource = (body as Record<string, unknown>)?.source
    const source: StreamEstateIngestSource = rawSource === 'reconcile' || rawSource === 'webhook' ? rawSource : 'manual'
    const rawFromDate = (body as Record<string, unknown>)?.fromDate ?? (body as Record<string, unknown>)?.from_date
    const rawFromUpdatedAt = (body as Record<string, unknown>)?.fromUpdatedAt ?? (body as Record<string, unknown>)?.from_updated_at
    const fromDate = typeof rawFromDate === 'string' && rawFromDate ? rawFromDate : null
    const fromUpdatedAt = typeof rawFromUpdatedAt === 'string' && rawFromUpdatedAt ? rawFromUpdatedAt : null
    const rawInsee = (body as Record<string, unknown>)?.insee_code ?? (body as Record<string, unknown>)?.inseeCode
    const inseeCode = typeof rawInsee === 'string' && /^\d{5}$/.test(rawInsee) ? rawInsee : null
    const rawName = (body as Record<string, unknown>)?.name
    const rawCity = (body as Record<string, unknown>)?.city
    const zone = await getOrCreateZone({
      zipcode,
      inseeCode,
      name: typeof rawName === 'string' ? rawName : null,
      city: typeof rawCity === 'string' ? rawCity : null,
    })
    const zoneId = zone.id

    // 0. Garde-fou anti-re-sync : zone synchronisée récemment → on renvoie la base, 0 appel API.
    if (!force && zone.lastSyncedAt) {
      const windowMinutes = await getResyncWindowMinutes()
      const ageMs = Date.now() - new Date(zone.lastSyncedAt).getTime()
      if (windowMinutes > 0 && Number.isFinite(ageMs) && ageMs >= 0 && ageMs < windowMinutes * 60_000) {
        const cacheCountQuery = supabaseAdmin
          .from('market_properties')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'stream_estate')
        const { count } = await (zone.inseeCode
          ? cacheCountQuery.eq('insee_code', zone.inseeCode)
          : cacheCountQuery.eq('zipcode', zipcode))
        return NextResponse.json({
          success: true,
          from_cache: true,
          skipped_reason: 'recently_synced',
          zone_id: zoneId,
          last_synced_at: zone.lastSyncedAt,
          resync_window_minutes: windowMinutes,
          fetched: count ?? 0,
          created: 0,
          updated: 0,
          external_requests: 0,
          billed_items: 0,
          estimated_cost_eur: 0,
          estimated_balance_after: budget.estimatedBalanceEur,
        })
      }
    }

    if (!budget.syncEnabled) {
      const syncId = await createSyncRun(zoneId, 'blocked', 'stream_estate_sync_disabled', source)
      return errorResponse('Synchronisation Stream Estate désactivée', 403, {
        sync_id: syncId,
        blocked_reason: 'stream_estate_sync_disabled',
        estimated_items: 0,
        external_requests: 0,
        fetched: 0,
        billed_items: 0,
        estimated_cost_eur: 0,
        estimated_balance_after: budget.estimatedBalanceEur,
      })
    }

    // Plafond effectif : en mode illimité, seul le budget borne (toute la base en ligne).
    const availableItems = getStreamEstateSyncItemCap(budget)

    if (availableItems < 1) {
      const syncId = await createSyncRun(zoneId, 'blocked', 'stream_estate_budget_insufficient', source)
      return errorResponse('Budget Stream Estate insuffisant', 402, {
        sync_id: syncId,
        blocked_reason: 'stream_estate_budget_insufficient',
        estimated_items: 0,
        external_requests: 0,
        fetched: 0,
        billed_items: 0,
        estimated_cost_eur: 0,
        estimated_balance_after: budget.estimatedBalanceEur,
      })
    }

    // maxItems borné par le budget disponible → plus besoin d'un appel preview facturé séparé.
    // En illimité, on ne plafonne pas par max_items_per_sync : une demande explicite borne,
    // sinon on prend tout ce que le budget permet (la boucle s'arrête à !hasMore).
    const requestedMaxItems = budget.unlimitedItems
      ? readMaxItems(body as Record<string, unknown>, availableItems)
      : Math.min(
          readMaxItems(body as Record<string, unknown>, budget.maxItemsPerSync),
          budget.maxItemsPerSync,
        )
    const maxItems = Math.min(requestedMaxItems, availableItems)

    const syncId = await createSyncRun(zoneId, 'running', undefined, source)
    let externalRequestCount = 0
    let estimatedCostEur = 0
    let billedItemCount = 0

    try {
      // 3. Appel Stream Estate
      const result = await fetchListings({
        zipcode,
        inseeCode: zone.inseeCode,
        propertyTypes,
        maxItems,
        fromDate,
        fromUpdatedAt,
        source,
        beforeRequest: async () => {
          const allowed = await canSpendStreamEstateItems()
          if (!allowed.ok) {
            throw new StreamEstateRequestLimitError(allowed.reason, allowed.reason)
          }
        },
        onRequest: async (event) => {
          externalRequestCount++
          billedItemCount += event.itemCount
          estimatedCostEur += event.itemCount * budget.costPerItemEur
          await recordStreamEstateUsageEvent({
            syncRunId: syncId ?? null,
            zipcode,
            endpoint: event.endpoint,
            page: event.page,
            requestStatus: event.requestStatus,
            itemCount: event.itemCount,
            estimatedCostEur: event.itemCount * budget.costPerItemEur,
            startedAt: event.startedAt,
            finishedAt: event.finishedAt,
            errorMessage: event.errorMessage ?? null,
            source,
          })
        },
      })
      const listings = result.listings
      // totalAvailable provient de la page 1 (hydra:totalItems) → estimation sans appel séparé.
      const estimatedItems = Math.min(result.totalAvailable, maxItems)

      let createdCount = 0
      let updatedCount = 0
      const skippedCount = 0

      // 4. Upsert des biens dans market_properties
      for (const listing of listings) {
        const upsert = await upsertStreamEstateListing({
          listing,
          fallbackZipcode: zipcode,
          source,
        })
        if (upsert.created) createdCount++
        if (upsert.updated) updatedCount++
      }

      // 5. Marquer les biens non vus comme expirés (sera fait par un job planifié)
      // Note MVP : les biens expirés sont détectés lors des synchronisations suivantes.

      // 6. Exécuter les règles actives (neutralisé — cf. RULES_ENGINE_ENABLED)
      if (RULES_ENGINE_ENABLED) {
        await executeRulesForZone(zoneId)
      }

      // 7. Mettre à jour le journal
      const syncStatus = result.truncated ? 'blocked' : 'success'
      const blockedReason = result.truncated ? 'stream_estate_item_limit_reached' : null

      if (syncId) {
        await updateSyncRun(syncId, {
          status: syncStatus,
          finished_at: new Date().toISOString(),
          fetched_count: listings.length,
          external_item_count: billedItemCount,
          created_count: createdCount,
          updated_count: updatedCount,
          external_request_count: externalRequestCount,
          estimated_cost_eur: estimatedCostEur,
          blocked_reason: blockedReason,
        })
      }

      // 8. Mettre à jour la fraîcheur de la zone.
      const zoneFreshnessUpdate: Record<string, unknown> = { last_synced_at: new Date().toISOString() }
      if (source === 'reconcile') zoneFreshnessUpdate.last_reconciled_at = zoneFreshnessUpdate.last_synced_at
      await supabaseAdmin
        .from('monitored_zones')
        .update(zoneFreshnessUpdate as never)
        .eq('id', zoneId)

      return NextResponse.json({
        success: true,
        partial: result.truncated,
        blocked_reason: blockedReason,
        zone_id: zoneId,
        sync_id: syncId,
        source,
        from_date: fromDate,
        from_updated_at: fromUpdatedAt,
        fetched: listings.length,
        skipped: skippedCount,
        created: createdCount,
        updated: updatedCount,
        estimated_items: estimatedItems,
        external_requests: externalRequestCount,
        billed_items: billedItemCount,
        estimated_cost_eur: estimatedCostEur,
        estimated_balance_after: estimatedBalanceAfter(
          budget.manualBalanceEur,
          budget.estimatedSpentTotalEur,
          estimatedCostEur,
        ),
      })
    } catch (err) {
      // Erreur pendant la sync
      const errMsg = err instanceof Error ? err.message : String(err)
      if (syncId) {
        await updateSyncRun(syncId, {
          status: 'error',
          finished_at: new Date().toISOString(),
          error_message: errMsg,
          blocked_reason: null,
          external_request_count: externalRequestCount,
          external_item_count: billedItemCount,
          estimated_cost_eur: estimatedCostEur,
        })
      }
      return errorResponse(errMsg, 500, {
        blocked_reason: null,
        external_requests: externalRequestCount,
        billed_items: billedItemCount,
        estimated_cost_eur: estimatedCostEur,
        estimated_balance_after: estimatedBalanceAfter(
          budget.manualBalanceEur,
          budget.estimatedSpentTotalEur,
          estimatedCostEur,
        ),
      })
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[API /market/sync]', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

// ── Exécution des règles ─────────────────────────────────────

async function executeRulesForZone(zoneId: string) {
  const { data: rules } = await supabaseAdmin
    .from('management_rules')
    .select('*')
    .eq('active', true)

  if (!rules || rules.length === 0) return

  // Récupérer les biens de la zone mis à jour dans la dernière heure
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { data: latestZone } = await supabaseAdmin
    .from('monitored_zones')
    .select('zipcode')
    .eq('id', zoneId)
    .single()

  if (!latestZone?.zipcode) return

  const { data: zoneProperties } = await supabaseAdmin
    .from('market_properties')
    .select('*')
    .eq('zipcode', latestZone.zipcode)
    .gte('updated_at', oneHourAgo)

  const propsToCheck = zoneProperties ?? []

  for (const rule of rules) {
    try {
      const conditions = rule.conditions_json as { all?: Array<{ field: string; operator: string; value: unknown }> } | null
      if (!conditions?.all) continue

      for (const property of propsToCheck) {
        const matches = conditions.all.every(cond => evaluateCondition(property as unknown as Record<string, unknown>, cond))
        if (!matches) continue

        const actions = rule.actions_json as { actions?: Array<{ type: string; value?: string; stage?: string; priority?: string }> } | null
        if (!actions?.actions) continue

        for (const action of actions.actions) {
          switch (action.type) {
            case 'add_tag':
              await supabaseAdmin.from('property_tags').upsert({
                market_property_id: property.id,
                tag: action.value ?? 'Signal',
                source: 'rule',
                rule_id: rule.id,
              } as never, { onConflict: 'market_property_id,tag' as never })
              break

            case 'create_notification':
              await supabaseAdmin.from('notifications').insert({
                type: 'rule_triggered',
                title: `Règle : ${rule.name}`,
                message: `${property.title ?? 'Bien'} à ${property.city ?? property.zipcode} — ${action.value ?? ''}`,
                priority: action.priority ?? 'medium',
                market_property_id: property.id,
                rule_id: rule.id,
              } as never)
              break

            case 'create_opportunity':
              await supabaseAdmin.from('opportunities').insert({
                market_property_id: property.id,
                title: `${property.title ?? 'Bien'} — ${rule.name}`,
                description: `Créé automatiquement par la règle "${rule.name}"`,
                stage: normalizeOpportunityStage(action.stage),
                priority: action.priority ?? 'medium',
                signal_type: rule.trigger_type,
                source_channel: 'annonce',
                property_city: property.city,
                property_zipcode: property.zipcode,
                property_type: property.property_type,
                estimated_price_min: property.price,
                estimated_price_max: property.price,
                created_from: 'rule',
              } as never)
              break
          }
        }
      }

      // Mettre à jour last_run_at
      await supabaseAdmin
        .from('management_rules')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', rule.id)
    } catch (ruleErr) {
      console.error(`[executeRulesForZone] Rule "${rule.name}" failed:`, ruleErr)
    }
  }
}

// ── Évaluateur de condition ──────────────────────────────────

function evaluateCondition(
  property: Record<string, unknown>,
  condition: { field: string; operator: string; value: unknown },
): boolean {
  const { field, operator, value } = condition
  const fieldValue = property[field]

  switch (operator) {
    case 'equals':
      return fieldValue === value
    case 'not_equals':
      return fieldValue !== value
    case 'gt':
      return Number(fieldValue) > Number(value)
    case 'gte':
      return Number(fieldValue) >= Number(value)
    case 'lt':
      return Number(fieldValue) < Number(value)
    case 'lte':
      return Number(fieldValue) <= Number(value)
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(value).toLowerCase())
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue)
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return Number(fieldValue) >= Number(value[0]) && Number(fieldValue) <= Number(value[1])
      }
      return false
    default:
      return false
  }
}

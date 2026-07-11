// ═══════════════════════════════════════════════════════════════
// Cron : suivi récurrent Stream Estate (pipeline market_properties)
// 1) monitoring ciblé par ID pour les biens connus ;
// 2) pull incrémental de sécurité par zone via fromUpdatedAt.
// Chaque appel réutilise TOUS les garde-fous existants (budget, fenêtre anti-re-sync).
//
// Contrairement à /api/jobs/import-stream-estate (qui alimente la table
// `listings` du monde radar mort), ce job alimente `market_properties`,
// la source de vérité sur laquelle tourne le mandate_score.
//
// Sécurité — deux filets pour « zéro crédit brûlé par surprise » :
//   1. STREAM_ESTATE_CRON_ENABLED doit valoir 'true' (défaut OFF) pour exécuter.
//      C'est l'interrupteur volontaire : sans lui, le job no-op (0 appel API).
//   2. Chaque /api/market/sync respecte le budget Stream Estate : si la sync
//      est désactivée ou le solde insuffisant, 0 item facturé.
// Auth cron : si CRON_SECRET est défini, l'en-tête Authorization Bearer est exigé.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { monitorKnownLeads } from '@/lib/market/lead-monitor'
import { getSetting } from '@/lib/settings'
import { ensureStreamEstateSavedSearchForZone } from '@/lib/market/stream-estate-searches'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // limite plan Hobby Vercel

// Plafond de zones traitées par exécution (évite de dépasser maxDuration).
const MAX_ZONES_PER_RUN = 20
const STREAM_ESTATE_RECONCILE_WINDOW_DAYS_KEY = 'stream_estate_reconcile_window_days'
const DEFAULT_RECONCILE_WINDOW_DAYS = 1

function resolveBaseUrl(req: NextRequest): string {
  if (process.env.SYNC_CRON_BASE_URL) return process.env.SYNC_CRON_BASE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3002'
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  // 1. Auth cron (si un secret est configuré).
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  // 2. Interrupteur volontaire. `?test=1` permet de tester l'orchestration à la
  //    main (les garde-fous budget restent actifs → reste sans danger).
  const isTest = new URL(req.url).searchParams.get('test') === '1'
  const cronEnabled = process.env.STREAM_ESTATE_CRON_ENABLED === 'true'
  if (!cronEnabled && !isTest) {
    console.log('[Cron sync-zones] désactivé (STREAM_ESTATE_CRON_ENABLED != true), arrêt.')
    return NextResponse.json({ success: true, skipped: true, reason: 'cron_disabled' })
  }

  // ── 3. Monitoring quotidien : suivi ciblé des leads connus (pas cher) ──
  // Re-fetch par-id de nos annonces actives → baisse de prix / retrait + re-score.
  const monitoring = await monitorKnownLeads()

  // ── 4. Filet de sécurité incrémental ──
  // Pas de scan complet quotidien : seules les propriétés créées/modifiées depuis la
  // dernière réconciliation (avec une fenêtre de recouvrement) sont demandées.
  const reconcileParam = new URL(req.url).searchParams.get('reconcile')
  const shouldReconcile = reconcileParam !== '0'
  const windowDaysRaw = await getSetting<number>(STREAM_ESTATE_RECONCILE_WINDOW_DAYS_KEY, DEFAULT_RECONCILE_WINDOW_DAYS)
  const windowDays = Number.isFinite(Number(windowDaysRaw))
    ? Math.max(1, Math.floor(Number(windowDaysRaw)))
    : DEFAULT_RECONCILE_WINDOW_DAYS

  const reconcile: {
    ran: boolean
    zones: number
    totals: { created: number; updated: number; billed_items: number; estimated_cost_eur: number }
    results: Array<Record<string, unknown>>
  } = { ran: false, zones: 0, totals: { created: 0, updated: 0, billed_items: 0, estimated_cost_eur: 0 }, results: [] }

  if (shouldReconcile) {
    const { data: zones, error } = await supabaseAdmin
      .from('monitored_zones')
      .select('id, zipcode, insee_code, name, city, active, last_synced_at, last_reconciled_at, stream_estate_search_id')
      .eq('active', true)
      .not('last_synced_at', 'is', null)
      .order('last_reconciled_at', { ascending: true, nullsFirst: true })
      .limit(MAX_ZONES_PER_RUN)

    if (error) {
      console.error('[Cron sync-zones] lecture zones impossible:', error.message)
    } else if (zones && zones.length > 0) {
      reconcile.ran = true
      reconcile.zones = zones.length
      const base = resolveBaseUrl(req)
      // Séquentiel : respecte maxDuration et laisse le budget se décrémenter entre zones.
      for (const zone of zones) {
        try {
          await ensureStreamEstateSavedSearchForZone(zone)
          const anchor = zone.last_reconciled_at ?? zone.last_synced_at ?? new Date().toISOString()
          const fromUpdatedAt = new Date(new Date(anchor).getTime() - windowDays * 86400000).toISOString()
          const res = await fetch(`${base}/api/market/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zipcode: zone.zipcode,
              insee_code: zone.insee_code,
              name: zone.name,
              city: zone.city,
              source: 'reconcile',
              fromUpdatedAt,
            }),
          })
          const payload = await res.json().catch(() => ({}))
          reconcile.totals.created += Number(payload?.created) || 0
          reconcile.totals.updated += Number(payload?.updated) || 0
          reconcile.totals.billed_items += Number(payload?.billed_items) || 0
          reconcile.totals.estimated_cost_eur += Number(payload?.estimated_cost_eur) || 0
          reconcile.results.push({
            zone_id: zone.id,
            zipcode: zone.zipcode,
            status: res.status,
            from_cache: payload?.from_cache ?? false,
            skipped_reason: payload?.skipped_reason ?? payload?.blocked_reason ?? null,
            created: Number(payload?.created) || 0,
            updated: Number(payload?.updated) || 0,
            billed_items: Number(payload?.billed_items) || 0,
            from_updated_at: fromUpdatedAt,
          })
        } catch (e) {
          console.error(`[Cron sync-zones] échec zone ${zone.zipcode}:`, e)
          reconcile.results.push({ zone_id: zone.id, zipcode: zone.zipcode, status: 'error', error: e instanceof Error ? e.message : 'unknown' })
        }
      }
      reconcile.totals.estimated_cost_eur = Math.round(reconcile.totals.estimated_cost_eur * 100) / 100
    }
  }

  console.log(
    `[Cron sync-zones] monitoring: ${monitoring.checked} vérifiés, ${monitoring.price_changes} baisses, ` +
      `${monitoring.expired} retirés (~${monitoring.estimated_cost_eur} €) | reconcile: ${reconcile.ran ? `${reconcile.zones} zone(s), ${reconcile.totals.created} nouveaux, ${reconcile.totals.updated} maj` : 'non'}`,
  )

  return NextResponse.json({
    success: true,
    test: isTest,
    monitoring,
    reconcile,
  })
}

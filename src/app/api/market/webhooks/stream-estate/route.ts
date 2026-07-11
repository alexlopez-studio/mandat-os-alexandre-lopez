import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'
import { normalizeListing, type StreamEstateEventType } from '@/lib/stream-estate'
import { upsertStreamEstateListing } from '@/lib/market/upsert-listing'
import {
  getStreamEstateBudgetSnapshot,
  recordStreamEstateUsageEvent,
} from '@/lib/stream-estate-budget'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STREAM_ESTATE_WEBHOOK_ENABLED_KEY = 'stream_estate_webhook_enabled'
const STREAM_ESTATE_IPS = new Set(['144.76.91.183', '178.238.226.136'])

type WebhookPayload = {
  event?: string
  adEvent?: Record<string, unknown>
  match?: Record<string, unknown>
  propertyDocument?: Record<string, unknown>
}

function checkSecret(req: NextRequest): boolean {
  const expected = process.env.STREAM_ESTATE_WEBHOOK_SECRET
  if (!expected) return true

  const url = new URL(req.url)
  const provided =
    req.headers.get('x-stream-estate-secret') ??
    req.headers.get('x-webhook-secret') ??
    url.searchParams.get('secret')

  return provided === expected
}

function logIpBestEffort(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for') ?? ''
  const ip = forwardedFor.split(',')[0]?.trim()
  if (ip && !STREAM_ESTATE_IPS.has(ip)) {
    console.warn(`[stream-estate-webhook] IP non reconnue: ${ip}`)
  }
}

function extractPropertyDocument(payload: WebhookPayload): Record<string, unknown> | null {
  if (payload.propertyDocument && typeof payload.propertyDocument === 'object') return payload.propertyDocument
  const match = payload.match
  if (!match || typeof match !== 'object') return null
  const fromMatch = match.propertyDocument
  if (fromMatch && typeof fromMatch === 'object') return fromMatch as Record<string, unknown>
  return null
}

function normalizeEventType(value: unknown): StreamEstateEventType | string {
  return typeof value === 'string' && value ? value : 'property.ad.create'
}

async function findZoneId(listing: { inseeCode?: string; zipcode?: string }, payload: WebhookPayload): Promise<string | null> {
  const searchRaw = payload.match?.search
  const searchId = typeof searchRaw === 'string' ? searchRaw.replace(/^\/searches\//, '') : null

  if (searchId) {
    const { data } = await supabaseAdmin
      .from('monitored_zones')
      .select('id')
      .eq('stream_estate_search_id', searchId)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  if (listing.inseeCode) {
    const { data } = await supabaseAdmin
      .from('monitored_zones')
      .select('id')
      .eq('insee_code', listing.inseeCode)
      .order('created_at', { ascending: true })
      .limit(1)
    if (data?.[0]?.id) return data[0].id as string
  }

  if (listing.zipcode) {
    const { data } = await supabaseAdmin
      .from('monitored_zones')
      .select('id')
      .eq('zipcode', listing.zipcode)
      .order('created_at', { ascending: true })
      .limit(1)
    if (data?.[0]?.id) return data[0].id as string
  }

  return null
}

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString()

  try {
    if (!checkSecret(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const enabled = await getSetting<boolean>(STREAM_ESTATE_WEBHOOK_ENABLED_KEY, false)
    if (!enabled) {
      return NextResponse.json({ error: 'stream_estate_webhook_disabled' }, { status: 403 })
    }

    logIpBestEffort(req)

    const payload = await req.json() as WebhookPayload
    const eventType = normalizeEventType(payload.event)
    const rawProperty = extractPropertyDocument(payload)

    if (!rawProperty) {
      return NextResponse.json({ error: 'propertyDocument manquant' }, { status: 400 })
    }

    const listing = normalizeListing(rawProperty)
    const fallbackZipcode = listing.zipcode || ''
    const budget = await getStreamEstateBudgetSnapshot()

    const upsert = await upsertStreamEstateListing({
      listing,
      fallbackZipcode,
      source: 'webhook',
      eventType,
    })

    const zoneId = await findZoneId(listing, payload)
    if (zoneId) {
      await supabaseAdmin
        .from('monitored_zones')
        .update({ last_reconciled_at: new Date().toISOString() } as never)
        .eq('id', zoneId)
    }

    await recordStreamEstateUsageEvent({
      syncRunId: null,
      zipcode: fallbackZipcode,
      endpoint: '/api/market/webhooks/stream-estate',
      page: 1,
      requestStatus: 'success',
      itemCount: 0,
      estimatedCostEur: budget.webhookEventCostEur,
      startedAt,
      finishedAt: new Date().toISOString(),
      source: 'webhook',
      eventType,
    })

    return NextResponse.json({
      success: true,
      event_type: eventType,
      property_id: upsert.propertyId,
      created: upsert.created,
      updated: upsert.updated,
      price_changed: upsert.priceChanged,
      expired: upsert.expired,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recordStreamEstateUsageEvent({
      syncRunId: null,
      zipcode: '',
      endpoint: '/api/market/webhooks/stream-estate',
      page: 1,
      requestStatus: 'error',
      itemCount: 0,
      estimatedCostEur: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      errorMessage: message,
      source: 'webhook',
      eventType: null,
    })
    console.error('[stream-estate-webhook]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

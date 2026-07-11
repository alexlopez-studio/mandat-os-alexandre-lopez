import { supabaseAdmin } from '@/lib/supabase'
import { getSetting } from '@/lib/settings'
import { createSavedSearch, deleteSavedSearch } from '@/lib/stream-estate'

const STREAM_ESTATE_WEBHOOK_ENABLED_KEY = 'stream_estate_webhook_enabled'

type ZoneForSearch = {
  id: string
  name: string
  zipcode: string
  insee_code?: string | null
  stream_estate_search_id?: string | null
}

function publicBaseUrl(): string | null {
  const raw =
    process.env.STREAM_ESTATE_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    null
  return raw ? raw.replace(/\/$/, '') : null
}

function webhookUrl(): string | null {
  const base = publicBaseUrl()
  if (!base) return null
  const url = new URL('/api/market/webhooks/stream-estate', base)
  if (process.env.STREAM_ESTATE_WEBHOOK_SECRET) {
    url.searchParams.set('secret', process.env.STREAM_ESTATE_WEBHOOK_SECRET)
  }
  return url.toString()
}

export async function ensureStreamEstateSavedSearchForZone(zone: ZoneForSearch): Promise<string | null> {
  if (zone.stream_estate_search_id) return zone.stream_estate_search_id

  const enabled = await getSetting<boolean>(STREAM_ESTATE_WEBHOOK_ENABLED_KEY, false)
  const endpoint = webhookUrl()
  if (!enabled || !endpoint) return null

  try {
    const search = await createSavedSearch({
      title: `Mandat OS — ${zone.name} ${zone.zipcode}`,
      zipcode: zone.zipcode,
      inseeCode: zone.insee_code ?? null,
      endpointRecipient: endpoint,
      eventEndpoint: endpoint,
      notificationEnabled: true,
    })

    const { error } = await supabaseAdmin
      .from('monitored_zones')
      .update({ stream_estate_search_id: search.id } as never)
      .eq('id', zone.id)

    if (error) {
      console.error(`[stream-estate-searches] stockage saved search ${zone.id}:`, error.message)
    }

    return search.id
  } catch (error) {
    console.error('[stream-estate-searches] création saved search:', error)
    return null
  }
}

export async function deleteStreamEstateSavedSearchForZone(searchId?: string | null): Promise<void> {
  if (!searchId) return
  try {
    await deleteSavedSearch(searchId)
  } catch (error) {
    console.error('[stream-estate-searches] suppression saved search:', error)
  }
}

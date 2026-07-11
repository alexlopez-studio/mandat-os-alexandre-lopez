import { supabaseAdmin } from '@/lib/supabase'
import type { Database, Json } from '@/types/supabase'

type ProspectRow = Database['public']['Tables']['prospects']['Row']

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

export function asStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => asText(item)).filter((item): item is string => Boolean(item))
    return items.length > 0 ? items : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const items = value.split(',').map((item) => item.trim()).filter(Boolean)
    return items.length > 0 ? items : null
  }
  return null
}

export function resolveCommune(data: Record<string, unknown>): string | null {
  return (
    asText(data.commune) ??
    asText(data.ville) ??
    asText(data.city) ??
    asText(data.property_city) ??
    null
  )
}

export function buildSellerPropertyPayload(data: Record<string, unknown>) {
  return {
    adresse: asText(data.adresse) ?? asText(data.address) ?? asText(data.property_address),
    lat: asNumber(data.lat),
    lon: asNumber(data.lng) ?? asNumber(data.lon),
    type_bien: asText(data.type_bien) ?? asText(data.property_type),
    sous_type: asText(data.sous_type),
    surface: asNumber(data.surface) ?? asNumber(data.property_surface),
    surface_terrain: asNumber(data.surface_terrain) ?? asNumber(data.property_land_surface),
    nb_pieces: asNumber(data.nb_pieces) ?? asNumber(data.property_rooms),
    etat: asText(data.etat),
    dpe: asText(data.dpe),
    annee_construction: asNumber(data.annee_construction),
    equipements: asStringArray(data.equipements),
    delai: asText(data.delai) ?? asText(data.selling_timeline),
    prix_estime: asNumber(data.prix_estime) ?? asNumber(data.estimated_price) ?? asNumber(data.estimated_price_min),
  }
}

export async function upsertCrmProspect(input: {
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}): Promise<ProspectRow> {
  const email = asText(input.email)
  const phone = asText(input.phone)
  const firstName = asText(input.firstName) ?? ''
  const lastName = asText(input.lastName) ?? ''

  if (email) {
    const { data, error } = await supabaseAdmin
      .from('prospects')
      .upsert({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        rgpd_consent_at: new Date().toISOString(),
      } as never, { onConflict: 'email', ignoreDuplicates: false })
      .select('*')
      .single()

    if (error) throw new Error(`Prospect email impossible: ${error.message}`)
    return data as ProspectRow
  }

  if (phone) {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('prospects')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)

    if (lookupError) throw new Error(`Recherche prospect téléphone impossible: ${lookupError.message}`)
    if (existing?.[0]) {
      const { data, error } = await supabaseAdmin
        .from('prospects')
        .update({
          first_name: firstName || existing[0].first_name,
          last_name: lastName || existing[0].last_name,
          phone,
        } as never)
        .eq('id', existing[0].id)
        .select('*')
        .single()
      if (error) throw new Error(`Mise à jour prospect téléphone impossible: ${error.message}`)
      return data as ProspectRow
    }
  }

  const { data, error } = await supabaseAdmin
    .from('prospects')
    .insert({
      email: null,
      first_name: firstName,
      last_name: lastName,
      phone,
      rgpd_consent_at: new Date().toISOString(),
    } as never)
    .select('*')
    .single()

  if (error) throw new Error(`Création prospect manuel impossible: ${error.message}`)
  return data as ProspectRow
}

export async function upsertSellerPropertyForLead(input: {
  leadId: string
  prospectId?: string | null
  data: Record<string, unknown>
}) {
  const sellerPayload = {
    lead_id: input.leadId,
    prospect_id: input.prospectId ?? null,
    ...buildSellerPropertyPayload(input.data),
    actif: true,
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('seller_properties')
    .select('id')
    .eq('lead_id', input.leadId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (lookupError) throw new Error(`Lecture bien vendeur impossible: ${lookupError.message}`)

  if (existing?.[0]) {
    const { data, error } = await supabaseAdmin
      .from('seller_properties')
      .update(sellerPayload as never)
      .eq('id', existing[0].id)
      .select('*')
      .single()
    if (error) throw new Error(`Mise à jour bien vendeur impossible: ${error.message}`)
    return data
  }

  const { data, error } = await supabaseAdmin
    .from('seller_properties')
    .insert(sellerPayload as never)
    .select('*')
    .single()

  if (error) throw new Error(`Création bien vendeur impossible: ${error.message}`)
  return data
}

export function cleanJson(value: Record<string, unknown>): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLead } from '@/lib/leads-repo'
import { NEW_CONTACT_STAGE, WATCH_LISTING_STAGE } from '@/lib/market/seller-opportunity'
import {
  asNumber,
  asRecord,
  asText,
  resolveCommune,
  upsertCrmProspect,
  upsertSellerPropertyForLead,
} from '@/lib/leads-crm'

const DEFAULT_STAGE = NEW_CONTACT_STAGE
const SELLER_OPPORTUNITY_FIELDS = [
  'seller_name',
  'seller_phone',
  'seller_email',
  'source_channel',
  'property_address',
  'property_city',
  'property_zipcode',
  'property_type',
  'property_surface',
  'property_land_surface',
  'property_rooms',
  'estimated_price_min',
  'estimated_price_max',
  'selling_timeline',
  'pre_estimation_done_at',
  'visit_at',
  'report_delivered_at',
  'follow_up_at',
] as const

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function buildSellerPayload(body: Record<string, unknown>) {
  const payload: Record<string, string | number | null> = {}
  for (const field of SELLER_OPPORTUNITY_FIELDS) {
    if (!(field in body)) continue
    if (
      field === 'property_surface' ||
      field === 'property_land_surface' ||
      field === 'property_rooms' ||
      field === 'estimated_price_min' ||
      field === 'estimated_price_max'
    ) {
      payload[field] = normalizeNumber(body[field])
    } else {
      payload[field] = normalizeText(body[field])
    }
  }
  return payload
}

async function getLeadSnapshot(leadId: string) {
  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .select('*, prospect:prospects!leads_prospect_id_fkey (*)')
    .eq('id', leadId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!lead) return null

  const { data: sellerProperties } = await supabaseAdmin
    .from('seller_properties')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)

  return {
    lead,
    prospect: lead.prospect as {
      first_name?: string | null
      last_name?: string | null
      email?: string | null
      phone?: string | null
    } | null,
    sellerProperty: sellerProperties?.[0] ?? null,
  }
}

async function createLeadFromOpportunity(body: Record<string, unknown>) {
  const leadInput = asRecord(body.lead)
  const sellerName = asText(leadInput.seller_name) ?? asText(body.seller_name) ?? asText(body.title)
  const firstName = asText(leadInput.first_name) ?? sellerName ?? ''
  const lastName = asText(leadInput.last_name) ?? ''
  const email = asText(leadInput.email) ?? asText(body.seller_email)
  const phone = asText(leadInput.phone) ?? asText(body.seller_phone)
  const commune = resolveCommune(leadInput) ?? asText(body.property_city)
  const sourceChannel = asText(leadInput.source_channel) ?? asText(body.source_channel) ?? 'prospection'
  const priority = asText(leadInput.priority) ?? asText(body.priority) ?? 'medium'
  const formData = {
    seller_name: sellerName,
    phone,
    email,
    source_channel: sourceChannel,
    commune,
    adresse: asText(leadInput.adresse) ?? asText(body.property_address),
    type_bien: asText(leadInput.type_bien) ?? asText(body.property_type),
    surface: asNumber(leadInput.surface) ?? asNumber(body.property_surface),
    surface_terrain: asNumber(leadInput.surface_terrain) ?? asNumber(body.property_land_surface),
    nb_pieces: asNumber(leadInput.nb_pieces) ?? asNumber(body.property_rooms),
    delai: asText(leadInput.delai) ?? asText(body.selling_timeline),
    prix_estime: asNumber(leadInput.prix_estime) ?? asNumber(body.estimated_price_min),
  }

  if (!sellerName && !email && !phone) {
    throw new Error('lead_contact_required')
  }

  const prospect = await upsertCrmProspect({ email, firstName, lastName, phone })
  const lead = await createLead({
    prospectId: prospect.id,
    tool: 'vendre',
    formData,
    results: {},
    commune,
    sourceChannel,
    priority,
    nextAction: asText(body.next_action) ?? 'Qualifier le projet vendeur',
    dueDate: asText(body.due_date),
    followUpAt: asText(body.follow_up_at),
  })
  await upsertSellerPropertyForLead({ leadId: lead.id, prospectId: prospect.id, data: formData })
  await supabaseAdmin.from('lead_events').insert({
    lead_id: lead.id,
    kind: 'system',
    payload: { text: 'Lead créé depuis une opportunité' },
    created_by: 'admin',
  } as never)
  return lead.id
}

async function getMarketPropertySnapshot(marketPropertyId: string | null) {
  if (!marketPropertyId) return null
  const { data, error } = await supabaseAdmin
    .from('market_properties')
    .select('id, title, city, zipcode, property_type, surface, land_surface, rooms, price, seller_type')
    .eq('id', marketPropertyId)
    .maybeSingle()

  if (error) throw error
  return data as {
    id: string
    title: string | null
    city: string | null
    zipcode: string | null
    property_type: string | null
    surface: number | null
    land_surface: number | null
    rooms: number | null
    price: number | null
    seller_type: string | null
  } | null
}

function titleFromLead(snapshot: Awaited<ReturnType<typeof getLeadSnapshot>>) {
  if (!snapshot) return 'Opportunité vendeur'
  const name = [snapshot.prospect?.first_name, snapshot.prospect?.last_name].filter(Boolean).join(' ').trim()
  const property = [snapshot.sellerProperty?.type_bien, snapshot.lead.commune].filter(Boolean).join(' ')
  if (name && property) return `${name} - ${property}`
  if (name) return `${name} - projet vendeur`
  if (property) return `Vendeur - ${property}`
  return 'Opportunité vendeur'
}

/**
 * GET /api/market/opportunities
 * Liste les opportunités.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const stage = searchParams.get('stage')
    const priority = searchParams.get('priority')
    const signalType = searchParams.get('signal_type')
    const sort = searchParams.get('sort') ?? 'created_at.desc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('opportunities')
      .select('*', { count: 'exact' })
      .eq('is_test', false)

    // Filtres
    if (stage) query = query.eq('stage', stage)
    if (priority) query = query.eq('priority', priority)
    if (signalType) query = query.eq('signal_type', signalType)

    // Tri
    const [sortField, sortDir] = sort.split('.')
    const validSortFields = ['stage', 'priority', 'due_date', 'created_at', 'updated_at']
    if (validSortFields.includes(sortField)) {
      query = query.order(sortField, { ascending: sortDir === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: opportunities, count, error } = await query

    if (error) {
      console.error('[API /market/opportunities] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Enrichissement : on attache le bien lié (titre/ville/prix) sans dépendre d'une
    // relation PostgREST — une seule requête groupée sur les market_property_id présents.
    const rows = opportunities ?? []
    const propertyIds = [...new Set(
      rows.map((o) => o.market_property_id).filter((id): id is string => Boolean(id)),
    )]

    const propertyMap: Record<string, { id: string; title: string | null; city: string | null; zipcode: string | null; price: number | null }> = {}
    if (propertyIds.length > 0) {
      const { data: properties } = await supabaseAdmin
        .from('market_properties')
        .select('id, title, city, zipcode, price')
        .in('id', propertyIds)
      for (const p of properties ?? []) {
        propertyMap[p.id as string] = {
          id: p.id as string,
          title: (p.title as string | null) ?? null,
          city: (p.city as string | null) ?? null,
          zipcode: (p.zipcode as string | null) ?? null,
          price: (p.price as number | null) ?? null,
        }
      }
    }

    const enriched = rows.map((o) => ({
      ...o,
      property: o.market_property_id ? propertyMap[o.market_property_id] ?? null : null,
    }))

    return NextResponse.json({
      opportunities: enriched,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (e) {
    console.error('[API /market/opportunities] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/opportunities
 * Crée une nouvelle opportunité.
 */
export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json())

    const marketPropertyId = typeof body.market_property_id === 'string' && body.market_property_id
      ? body.market_property_id
      : null
    let leadId = typeof body.lead_id === 'string' && body.lead_id
      ? body.lead_id
      : null

    if (!leadId && body.create_lead === true) {
      try {
        leadId = await createLeadFromOpportunity(body)
      } catch (error) {
        if (error instanceof Error && error.message === 'lead_contact_required') {
          return NextResponse.json({ error: 'Contact lead requis' }, { status: 400 })
        }
        console.error('[API /market/opportunities] create lead error:', error)
        return NextResponse.json({ error: 'Erreur création lead' }, { status: 500 })
      }
    }

    let marketProperty = null as Awaited<ReturnType<typeof getMarketPropertySnapshot>>

    if (marketPropertyId) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('opportunities')
        .select('*')
        .eq('market_property_id', marketPropertyId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingError) {
        console.error('[API /market/opportunities] existing lookup error:', existingError)
        return NextResponse.json({ error: 'Erreur lecture opportunité existante' }, { status: 500 })
      }

      if (existing?.[0]) {
        return NextResponse.json({ opportunity: existing[0], existing: true }, { status: 200 })
      }

      marketProperty = await getMarketPropertySnapshot(marketPropertyId)
    }

    if (leadId) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('opportunities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingError) {
        console.error('[API /market/opportunities] existing lead lookup error:', existingError)
        return NextResponse.json({ error: 'Erreur lecture opportunité existante' }, { status: 500 })
      }

      if (existing?.[0]) {
        return NextResponse.json({ opportunity: existing[0], existing: true }, { status: 200 })
      }
    }

    const leadSnapshot = leadId ? await getLeadSnapshot(leadId) : null
    if (leadId && !leadSnapshot) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }
    const title = asText(body.title) ?? marketProperty?.title ?? titleFromLead(leadSnapshot)
    const sellerName = [leadSnapshot?.prospect?.first_name, leadSnapshot?.prospect?.last_name].filter(Boolean).join(' ').trim()
    const requestedStage = normalizeText(body.stage)
    const agencyWatch = Boolean(marketProperty && marketProperty.seller_type === 'agency' && !leadId)
    const propertySource = marketProperty
      ? (marketProperty.seller_type === 'agency' ? 'annonce_agence' : 'annonce_particulier')
      : null

    const { data: opportunity, error } = await supabaseAdmin
      .from('opportunities')
      .insert({
        market_property_id: marketPropertyId,
        lead_id: leadId,
        title,
        description: normalizeText(body.description) ?? '',
        stage: agencyWatch && (!requestedStage || requestedStage === DEFAULT_STAGE)
          ? WATCH_LISTING_STAGE
          : requestedStage ?? DEFAULT_STAGE,
        priority: normalizeText(body.priority) ?? 'medium',
        signal_type: normalizeText(body.signal_type),
        next_action: normalizeText(body.next_action),
        due_date: normalizeText(body.due_date),
        note: normalizeText(body.note),
        created_from: normalizeText(body.created_from) ?? (leadId ? 'lead' : 'manual'),
        ...(leadSnapshot ? {
          seller_name: sellerName || null,
          seller_phone: leadSnapshot.prospect?.phone ?? null,
          seller_email: leadSnapshot.prospect?.email ?? null,
          source_channel: leadSnapshot.lead.source_channel ?? null,
          property_address: leadSnapshot.sellerProperty?.adresse ?? null,
          property_city: leadSnapshot.lead.commune ?? null,
          property_type: leadSnapshot.sellerProperty?.type_bien ?? null,
          property_surface: leadSnapshot.sellerProperty?.surface ?? null,
          property_land_surface: leadSnapshot.sellerProperty?.surface_terrain ?? null,
          property_rooms: leadSnapshot.sellerProperty?.nb_pieces ?? null,
          estimated_price_min: leadSnapshot.sellerProperty?.prix_estime ?? null,
          estimated_price_max: leadSnapshot.sellerProperty?.prix_estime ?? null,
          selling_timeline: leadSnapshot.sellerProperty?.delai ?? null,
        } : marketProperty ? {
          source_channel: propertySource,
          property_city: marketProperty.city,
          property_zipcode: marketProperty.zipcode,
          property_type: marketProperty.property_type,
          property_surface: marketProperty.surface,
          property_land_surface: marketProperty.land_surface,
          property_rooms: marketProperty.rooms,
          estimated_price_min: marketProperty.price,
          estimated_price_max: marketProperty.price,
        } : {}),
        ...buildSellerPayload(body),
      })
      .select()
      .single()

    if (error) {
      console.error('[API /market/opportunities] POST error:', error)
      return NextResponse.json({ error: 'Erreur création opportunité' }, { status: 500 })
    }

    return NextResponse.json({ opportunity }, { status: 201 })
  } catch (e) {
    console.error('[API /market/opportunities] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

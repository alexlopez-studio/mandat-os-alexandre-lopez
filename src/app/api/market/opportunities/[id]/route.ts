import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLead } from '@/lib/leads-repo'
import { propertyThumbnailUrl } from '@/lib/market/property-thumbnail'
import {
  ensureClientDossierForSignedOpportunity,
  LOST_STAGE,
  SIGNED_MANDATE_STAGE,
} from '@/lib/market/seller-opportunity'
import type { Database, Json } from '@/types/supabase'

type OpportunitiesUpdate = Database['public']['Tables']['opportunities']['Update']
type OpportunityEventInsert = Database['public']['Tables']['opportunity_events']['Insert']

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

function normalizeJsonObject(value: unknown): Json | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Json
}

async function enrichOpportunity(opportunity: Database['public']['Tables']['opportunities']['Row']) {
  const [propertyResponse, leadResponse] = await Promise.all([
    opportunity.market_property_id
      ? supabaseAdmin
        .from('market_properties')
        .select('id, external_id, title, description, price, surface, land_surface, rooms, bedrooms, price_per_m2, city, zipcode, property_type, status, source, url, seller_type, published_at, first_seen_at, last_seen_at, raw_json')
        .eq('id', opportunity.market_property_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    opportunity.lead_id
      ? supabaseAdmin
        .from('leads')
        .select('*, prospect:prospects!leads_prospect_id_fkey (*)')
        .eq('id', opportunity.lead_id)
        .is('deleted_at', null)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (propertyResponse.error) throw propertyResponse.error
  if (leadResponse.error) throw leadResponse.error

  let sellerProperty = null
  if (opportunity.lead_id) {
    const { data, error } = await supabaseAdmin
      .from('seller_properties')
      .select('*')
      .eq('lead_id', opportunity.lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    sellerProperty = data?.[0] ?? null
  }

  let events: Database['public']['Tables']['opportunity_events']['Row'][] = []
  const { data: eventRows, error: eventError } = await supabaseAdmin
    .from('opportunity_events')
    .select('*')
    .eq('opportunity_id', opportunity.id)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (eventError) {
    if (eventError.code !== 'PGRST205' && eventError.code !== '42P01') throw eventError
  } else {
    events = eventRows ?? []
  }

  const clientDossier = await loadClientDossierLink(opportunity)

  return {
    ...opportunity,
    client_dossier: clientDossier,
    property: propertyResponse.data
      ? {
        ...propertyResponse.data,
        thumbnail_url: propertyThumbnailUrl(propertyResponse.data.raw_json),
      }
      : null,
    lead: leadResponse.data
      ? {
        ...leadResponse.data,
        seller_property: sellerProperty,
      }
      : null,
    events,
  }
}

async function syncDossierFromOpportunity(
  opportunity: Database['public']['Tables']['opportunities']['Row'],
) {
  // Retrouve le dossier rattaché (par opportunity_id, repli lead_id).
  let dossier: { id: string; property_snapshot: Json; professional_opinion: Json } | null = null

  const byOpportunity = await supabaseAdmin
    .from('client_dossiers')
    .select('id, property_snapshot, professional_opinion')
    .eq('opportunity_id', opportunity.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (byOpportunity.error && byOpportunity.error.code !== 'PGRST116') throw byOpportunity.error
  dossier = byOpportunity.data ?? null

  if (!dossier && opportunity.lead_id) {
    const byLead = await supabaseAdmin
      .from('client_dossiers')
      .select('id, property_snapshot, professional_opinion')
      .eq('lead_id', opportunity.lead_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (byLead.error && byLead.error.code !== 'PGRST116') throw byLead.error
    dossier = byLead.data ?? null
  }

  if (!dossier) return

  // Fusion : l'opportunité écrase les clés partagées, on préserve les clés
  // propres au dossier client (ex. mandate_number saisi côté portail).
  const mergedSnapshot = { ...asObject(dossier.property_snapshot), ...asObject(opportunity.property_snapshot) }
  const mergedOpinion = { ...asObject(dossier.professional_opinion), ...asObject(opportunity.professional_opinion) }

  const { error } = await supabaseAdmin
    .from('client_dossiers')
    .update({ property_snapshot: mergedSnapshot as Json, professional_opinion: mergedOpinion as Json } as never)
    .eq('id', dossier.id)
  if (error) console.error('[API /market/opportunities/[id]] sync dossier:', error)
}

function asObject(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

async function loadClientDossierLink(
  opportunity: Database['public']['Tables']['opportunities']['Row'],
) {
  // Le dossier client peut être rattaché par opportunity_id (création directe)
  // ou, à défaut, par lead_id (rattachement au contact vendeur).
  let dossier: { id: string; public_token: string; status: string } | null = null

  const byOpportunity = await supabaseAdmin
    .from('client_dossiers')
    .select('id, public_token, status')
    .eq('opportunity_id', opportunity.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (byOpportunity.error && byOpportunity.error.code !== 'PGRST116') throw byOpportunity.error
  dossier = byOpportunity.data ?? null

  if (!dossier && opportunity.lead_id) {
    const byLead = await supabaseAdmin
      .from('client_dossiers')
      .select('id, public_token, status')
      .eq('lead_id', opportunity.lead_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (byLead.error && byLead.error.code !== 'PGRST116') throw byLead.error
    dossier = byLead.data ?? null
  }

  if (!dossier) return null

  const { data: docs, error: docsError } = await supabaseAdmin
    .from('client_documents')
    .select('status')
    .eq('dossier_id', dossier.id)
  if (docsError && docsError.code !== 'PGRST205' && docsError.code !== '42P01') throw docsError

  const rows = (docs ?? []) as { status: string }[]
  return {
    id: dossier.id,
    public_token: dossier.public_token,
    status: dossier.status,
    documents_total: rows.length,
    documents_validated: rows.filter((doc) => doc.status === 'validated').length,
    documents_missing: rows.filter((doc) => ['missing', 'requested', 'rejected'].includes(doc.status)).length,
  }
}

async function createOpportunityEvent(input: OpportunityEventInsert) {
  const { error } = await supabaseAdmin
    .from('opportunity_events')
    .insert(input)

  if (error && error.code !== 'PGRST205' && error.code !== '42P01') throw error
}

/**
 * « Nouveau projet pour ce contact » : crée un lead distinct rattaché au même
 * prospect que `sourceLeadId`, sans bien (nouveau projet). Chaque opportunité
 * garde ainsi son propre lead et son propre portail client.
 */
async function cloneLeadForNewProject(sourceLeadId: string): Promise<string> {
  const { data: source, error } = await supabaseAdmin
    .from('leads')
    .select('prospect_id, commune, source_channel, priority')
    .eq('id', sourceLeadId)
    .maybeSingle()
  if (error) throw error
  if (!source || !source.prospect_id) throw new Error('source_lead_not_found')

  const lead = await createLead({
    prospectId: source.prospect_id,
    tool: 'vendre',
    commune: source.commune ?? null,
    sourceChannel: source.source_channel ?? 'prospection',
    priority: source.priority ?? 'medium',
    nextAction: 'Qualifier le nouveau projet vendeur',
  })
  return lead.id
}

/**
 * GET /api/market/opportunities/[id]
 * Détail d'une opportunité.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data: opportunity, error } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Opportunité introuvable' }, { status: 404 })
      }
      console.error('[API /market/opportunities/[id]] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({ opportunity: await enrichOpportunity(opportunity) })
  } catch (e) {
    console.error('[API /market/opportunities/[id]] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/market/opportunities/[id]
 * Met à jour une opportunité (stage, priorité, notes, etc.).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Vérifier que l'opportunité existe
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Opportunité introuvable' }, { status: 404 })
    }

    // « Nouveau projet pour ce contact » : on crée un lead distinct (même
    // prospect) puis on le rattache comme n'importe quel lead_id ci-dessous.
    if (typeof body.clone_lead_from === 'string' && body.clone_lead_from) {
      try {
        body.lead_id = await cloneLeadForNewProject(body.clone_lead_from)
      } catch (cloneError) {
        console.error('[API /market/opportunities/[id]] clone lead error:', cloneError)
        const message = cloneError instanceof Error && cloneError.message === 'source_lead_not_found'
          ? 'Contact source introuvable'
          : 'Impossible de créer le nouveau projet pour ce contact'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    const updateData: OpportunitiesUpdate = {}
    if (body.market_property_id !== undefined) updateData.market_property_id = body.market_property_id || null
    if (body.lead_id !== undefined) updateData.lead_id = body.lead_id || null
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.stage !== undefined) updateData.stage = body.stage
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.signal_type !== undefined) updateData.signal_type = body.signal_type
    if (body.next_action !== undefined) updateData.next_action = body.next_action
    if (body.due_date !== undefined) updateData.due_date = body.due_date
    if (body.note !== undefined) updateData.note = body.note
    if (body.property_snapshot !== undefined) updateData.property_snapshot = normalizeJsonObject(body.property_snapshot) ?? {}
    if (body.professional_opinion !== undefined) updateData.professional_opinion = normalizeJsonObject(body.professional_opinion) ?? {}
    for (const field of SELLER_OPPORTUNITY_FIELDS) {
      if (!(field in body)) continue
      if (
        field === 'property_surface' ||
        field === 'property_land_surface' ||
        field === 'property_rooms' ||
        field === 'estimated_price_min' ||
        field === 'estimated_price_max'
      ) {
        updateData[field] = normalizeNumber(body[field]) as never
      } else {
        updateData[field] = normalizeText(body[field]) as never
      }
    }

    if (body.market_property_id !== undefined && body.market_property_id) {
      const { data: alreadyLinked, error: linkedError } = await supabaseAdmin
        .from('opportunities')
        .select('id, title, stage, priority, market_property_id')
        .eq('market_property_id', body.market_property_id)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (linkedError) {
        console.error('[API /market/opportunities/[id]] linked property lookup:', linkedError)
        return NextResponse.json({ error: 'Erreur vérification bien lié' }, { status: 500 })
      }

      if (alreadyLinked?.[0]) {
        return NextResponse.json(
          {
            error: 'Ce bien est déjà rattaché à une opportunité',
            existing_opportunity: alreadyLinked[0],
          },
          { status: 409 },
        )
      }
    }

    if (body.lead_id !== undefined && body.lead_id) {
      const { data: alreadyLinked, error: linkedError } = await supabaseAdmin
        .from('opportunities')
        .select('id, title, stage, priority, lead_id')
        .eq('lead_id', body.lead_id)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (linkedError) {
        console.error('[API /market/opportunities/[id]] linked lead lookup:', linkedError)
        return NextResponse.json({ error: 'Erreur vérification contact lié' }, { status: 500 })
      }

      if (alreadyLinked?.[0]) {
        return NextResponse.json(
          {
            error: 'Ce contact est déjà rattaché à une opportunité',
            existing_opportunity: alreadyLinked[0],
          },
          { status: 409 },
        )
      }
    }

    const { data: opportunity, error } = await supabaseAdmin
      .from('opportunities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /market/opportunities/[id]] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    // Garde le portail client à jour : toute modif du bien / de l'estimation
    // est répercutée sur le dossier rattaché (source de vérité = l'opportunité).
    if (body.property_snapshot !== undefined || body.professional_opinion !== undefined) {
      await syncDossierFromOpportunity(opportunity)
    }

    if (body.stage !== undefined && body.stage && body.stage !== existing.stage) {
      await createOpportunityEvent({
        opportunity_id: id,
        type: 'stage_change',
        title: 'Étape modifiée',
        content: `${existing.stage ?? '—'} → ${body.stage}`,
        metadata: { from: existing.stage, to: body.stage },
        created_by: 'admin',
      })

      if (body.stage === SIGNED_MANDATE_STAGE) {
        await ensureClientDossierForSignedOpportunity(opportunity)
      }

      if (body.stage === LOST_STAGE && !normalizeText(body.note) && !normalizeText(opportunity.note)) {
        await createOpportunityEvent({
          opportunity_id: id,
          type: 'task',
          title: 'Motif de perte à renseigner',
          content: 'Ajouter le motif de perte pour alimenter les indicateurs d’amélioration continue.',
          metadata: { quality_control: 'loss_reason_missing' },
          created_by: 'system',
        })
      }
    }

    return NextResponse.json({ opportunity: await enrichOpportunity(opportunity) })
  } catch (e) {
    console.error('[API /market/opportunities/[id]] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/market/opportunities/[id]
 * Supprime une opportunité.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Opportunité introuvable' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('opportunities')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API /market/opportunities/[id]] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API /market/opportunities/[id]] DELETE', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

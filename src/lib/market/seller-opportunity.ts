import { ensureClientDossierForLead } from '@/lib/client-portal'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

type Lead = Database['public']['Tables']['leads']['Row'] & {
  prospect?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

type SellerProperty = Database['public']['Tables']['seller_properties']['Row']
type Opportunity = Database['public']['Tables']['opportunities']['Row']

import {
  WATCH_LISTING_STAGE,
  NEW_CONTACT_STAGE,
  ESTIMATION_DELIVERED_STAGE,
  SIGNED_MANDATE_STAGE,
  LOST_STAGE,
  SELLER_STAGE_ORDER,
  isPortalEligibleStage,
} from '@/lib/market/seller-stages'

export {
  WATCH_LISTING_STAGE,
  NEW_CONTACT_STAGE,
  ESTIMATION_DELIVERED_STAGE,
  SIGNED_MANDATE_STAGE,
  LOST_STAGE,
  SELLER_STAGE_ORDER,
  isPortalEligibleStage,
}

function titleFromLead(lead: Lead, sellerProperty: SellerProperty | null) {
  const name = [lead.prospect?.first_name, lead.prospect?.last_name].filter(Boolean).join(' ').trim()
  const property = [sellerProperty?.type_bien, lead.commune].filter(Boolean).join(' ')
  if (name && property) return `${name} - ${property}`
  if (name) return `${name} - projet vendeur`
  if (property) return `Vendeur - ${property}`
  return 'Opportunité vendeur'
}

async function appendOpportunityEvent(opportunityId: string, input: {
  title: string
  content?: string
  metadata?: Record<string, unknown>
  type?: Database['public']['Enums']['opportunity_event_type']
}) {
  const { error } = await supabaseAdmin.from('opportunity_events').insert({
    opportunity_id: opportunityId,
    type: input.type ?? 'system',
    title: input.title,
    content: input.content ?? null,
    metadata: input.metadata ?? {},
    created_by: 'system',
  } as never)

  if (error && error.code !== 'PGRST205' && error.code !== '42P01') throw error
}

async function loadLeadSnapshot(leadId: string) {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads')
    .select('*, prospect:prospects!leads_prospect_id_fkey (first_name, last_name, email, phone)')
    .eq('id', leadId)
    .is('deleted_at', null)
    .maybeSingle()

  if (leadError) throw leadError
  if (!lead) return null

  const { data: sellerProperties, error: sellerError } = await supabaseAdmin
    .from('seller_properties')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (sellerError) throw sellerError

  return {
    lead: lead as Lead,
    sellerProperty: (sellerProperties?.[0] as SellerProperty | undefined) ?? null,
  }
}

async function findOpportunityForProspect(lead: Lead) {
  if (!lead.prospect_id) return null

  const { data: siblingLeads, error: siblingError } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('prospect_id', lead.prospect_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (siblingError) throw siblingError

  const leadIds = (siblingLeads ?? [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => Boolean(id))

  if (leadIds.length === 0) return null

  const { data: opportunities, error: opportunityError } = await supabaseAdmin
    .from('opportunities')
    .select('*')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: false })
    .limit(1)

  if (opportunityError) throw opportunityError
  return (opportunities?.[0] as Opportunity | undefined) ?? null
}

export async function ensureSellerOpportunityForLead(leadId: string) {
  const snapshot = await loadLeadSnapshot(leadId)
  if (!snapshot) return null

  const { lead, sellerProperty } = snapshot

  const { data: direct, error: directError } = await supabaseAdmin
    .from('opportunities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (directError) throw directError

  const directOpportunity = (direct?.[0] as Opportunity | undefined) ?? null
  if (directOpportunity) return { opportunity: directOpportunity, existing: true }

  const prospectOpportunity = await findOpportunityForProspect(lead)
  if (prospectOpportunity) {
    await appendOpportunityEvent(prospectOpportunity.id, {
      title: 'Nouvelle estimation rattachée',
      content: 'Une nouvelle demande vendeur du même prospect a été détectée sans créer de doublon.',
      metadata: {
        lead_id: leadId,
        prospect_id: lead.prospect_id,
        source_channel: lead.source_channel,
        quality_control: 'duplicate_search',
      },
    })
    return { opportunity: prospectOpportunity, existing: true }
  }

  const { data: opportunity, error } = await supabaseAdmin
    .from('opportunities')
    .insert({
      lead_id: leadId,
      title: titleFromLead(lead, sellerProperty),
      description: '',
      stage: NEW_CONTACT_STAGE,
      priority: lead.priority ?? 'medium',
      signal_type: 'manual',
      next_action: lead.next_action ?? 'Qualifier la demande d’estimation',
      due_date: lead.due_date ?? null,
      follow_up_at: lead.follow_up_at ?? null,
      created_from: 'lead',
      seller_name: [lead.prospect?.first_name, lead.prospect?.last_name].filter(Boolean).join(' ').trim() || null,
      seller_phone: lead.prospect?.phone ?? null,
      seller_email: lead.prospect?.email ?? null,
      source_channel: lead.source_channel ?? 'estimation_site',
      property_address: sellerProperty?.adresse ?? null,
      property_city: lead.commune ?? null,
      property_type: sellerProperty?.type_bien ?? null,
      property_surface: sellerProperty?.surface ?? null,
      property_land_surface: sellerProperty?.surface_terrain ?? null,
      property_rooms: sellerProperty?.nb_pieces ?? null,
      estimated_price_min: sellerProperty?.prix_estime ?? null,
      estimated_price_max: sellerProperty?.prix_estime ?? null,
      selling_timeline: sellerProperty?.delai ?? null,
    } as never)
    .select('*')
    .single()

  if (error) throw error

  await appendOpportunityEvent((opportunity as Opportunity).id, {
    title: 'Opportunité créée depuis le lead vendeur',
    metadata: {
      lead_id: leadId,
      source_channel: lead.source_channel,
      quality_control: 'automatic_opportunity_creation',
    },
  })

  return { opportunity: opportunity as Opportunity, existing: false }
}

export async function ensureClientDossierForSignedOpportunity(opportunity: Opportunity) {
  if (!opportunity.lead_id) {
    await appendOpportunityEvent(opportunity.id, {
      title: 'Dossier client à préparer',
      content: 'Mandat signé sans lead rattaché : rattacher ou créer un lead avec email avant invitation client.',
      metadata: { quality_control: 'client_dossier_missing_lead' },
      type: 'task',
    })
    return null
  }

  try {
    const result = await ensureClientDossierForLead(opportunity.lead_id)
    await appendOpportunityEvent(opportunity.id, {
      title: 'Dossier client préparé',
      content: 'Le passage en mandat signé a préparé ou rattaché le dossier client vendeur.',
      metadata: {
        dossier_id: result.dossier.id,
        lead_id: opportunity.lead_id,
        quality_control: 'client_dossier_created_on_signed_mandate',
      },
    })
    return result
  } catch (error) {
    await appendOpportunityEvent(opportunity.id, {
      title: 'Dossier client à compléter',
      content: error instanceof Error ? error.message : 'Préparation du dossier client impossible.',
      metadata: {
        lead_id: opportunity.lead_id,
        quality_control: 'client_dossier_creation_failed',
      },
      type: 'task',
    })
    return null
  }
}

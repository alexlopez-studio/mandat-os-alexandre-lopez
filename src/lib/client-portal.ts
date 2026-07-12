import type { SupabaseClient } from '@supabase/supabase-js'
import { projectClientDossierFromOpportunity } from '@/lib/client-dossier-projection'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, Json } from '@/types/supabase'

type ClientProfile = Database['public']['Tables']['client_profiles']['Row']
type ClientDossier = Database['public']['Tables']['client_dossiers']['Row']
type ClientDocument = Database['public']['Tables']['client_documents']['Row']
type ClientDossierEvent = Database['public']['Tables']['client_dossier_events']['Row']
type Lead = Database['public']['Tables']['leads']['Row']
type Prospect = Database['public']['Tables']['prospects']['Row']
type SellerProperty = Database['public']['Tables']['seller_properties']['Row']
type Opportunity = Database['public']['Tables']['opportunities']['Row']
type BuyerCriteria = Database['public']['Tables']['buyer_criteria']['Row']

export type ClientLead = Lead & {
  prospect?: Pick<Prospect, 'id' | 'email' | 'first_name' | 'last_name' | 'phone'> | null
}

export type ClientDocumentWithUrl = ClientDocument & {
  signed_url?: string | null
}

export type ClientPortalDossier = {
  profile: ClientProfile
  dossier: ClientDossier
  lead: ClientLead | null
  sellerProperty: SellerProperty | null
  opportunity: Opportunity | null
  documents: ClientDocumentWithUrl[]
  events: ClientDossierEvent[]
}

type LeadWithProspect = Lead & {
  prospect?: Pick<Prospect, 'id' | 'email' | 'first_name' | 'last_name' | 'phone'> | null
}

export async function ensureClientDossierForLead(leadId: string, opportunityId?: string) {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads')
    .select(`
      *,
      prospect:prospects!leads_prospect_id_fkey (
        id,
        email,
        first_name,
        last_name,
        phone
      )
    `)
    .eq('id', leadId)
    .is('deleted_at', null)
    .maybeSingle()

  if (leadError) throw new Error(`Lecture lead impossible: ${leadError.message}`)
  if (!lead) throw new Error('Lead introuvable')

  const leadRecord = lead as LeadWithProspect
  const prospect = leadRecord.prospect
  const email = prospect?.email?.trim().toLowerCase()
  if (!email) throw new Error('Ce lead ne contient pas d’email client')

  const opportunityQuery = supabaseAdmin
    .from('opportunities')
    .select('*')

  const [sellerResult, opportunityResult] = await Promise.all([
    supabaseAdmin
      .from('seller_properties')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    (opportunityId ? opportunityQuery.eq('id', opportunityId) : opportunityQuery.eq('lead_id', leadId))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (sellerResult.error) throw new Error(`Lecture bien vendeur impossible: ${sellerResult.error.message}`)
  if (opportunityResult.error) throw new Error(`Lecture opportunité impossible: ${opportunityResult.error.message}`)

  const sellerProperty = sellerResult.data as SellerProperty | null
  const opportunity = opportunityResult.data as Opportunity | null

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('client_profiles')
    .upsert({
      email,
      first_name: prospect?.first_name ?? '',
      last_name: prospect?.last_name ?? '',
      phone: prospect?.phone ?? null,
      is_active: true,
    } as never, { onConflict: 'email' })
    .select('*')
    .single()

  if (profileError) throw new Error(`Préparation profil client impossible: ${profileError.message}`)
  if (!profile) throw new Error('Profil client non retourné')

  const existing = await supabaseAdmin
    .from('client_dossiers')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle()

  if (existing.error) throw new Error(`Lecture dossier client impossible: ${existing.error.message}`)

  const payload = {
    client_profile_id: (profile as ClientProfile).id,
    client_type: 'seller',
    lead_id: leadId,
    seller_property_id: sellerProperty?.id ?? null,
    opportunity_id: opportunity?.id ?? null,
    status: 'active',
    title: buildDossierTitle(leadRecord, sellerProperty, opportunity),
    property_snapshot: buildPropertySnapshot(leadRecord, sellerProperty, opportunity) as Json,
    professional_opinion: buildProfessionalOpinion(opportunity) as Json,
    advisor_note: 'Je garde ce dossier à jour pour vous donner une lecture claire de la vente et des prochaines étapes.',
  }

  const dossierResult = existing.data
    ? await supabaseAdmin
        .from('client_dossiers')
        .update(payload as never)
        .eq('id', (existing.data as ClientDossier).id)
        .select('*')
        .single()
    : await supabaseAdmin
        .from('client_dossiers')
        .insert(payload as never)
        .select('*')
        .single()

  if (dossierResult.error) throw new Error(`Préparation dossier client impossible: ${dossierResult.error.message}`)
  if (!dossierResult.data) throw new Error('Dossier client non retourné')

  const dossier = dossierResult.data as ClientDossier

  return { profile: profile as ClientProfile, dossier }
}

export async function ensureClientDossierForBuyer(buyerLeadId: string) {
  const { data: buyer, error: buyerError } = await supabaseAdmin
    .from('buyer_criteria')
    .select('*')
    .eq('lead_id', buyerLeadId)
    .maybeSingle()

  if (buyerError) throw new Error(`Lecture acquéreur impossible: ${buyerError.message}`)
  if (!buyer) throw new Error('Acquéreur introuvable')

  const buyerRecord = buyer as BuyerCriteria
  const prospect = await loadProspectForBuyer(buyerRecord)
  const email = prospect?.email?.trim().toLowerCase()
  if (!email) throw new Error('Cet acquéreur ne contient pas d’email client')

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('client_profiles')
    .upsert({
      email,
      first_name: prospect?.first_name ?? '',
      last_name: prospect?.last_name ?? '',
      phone: prospect?.phone ?? null,
      is_active: true,
    } as never, { onConflict: 'email' })
    .select('*')
    .single()

  if (profileError) throw new Error(`Préparation profil client acquéreur impossible: ${profileError.message}`)
  if (!profile) throw new Error('Profil client acquéreur non retourné')

  const existing = await supabaseAdmin
    .from('client_dossiers')
    .select('*')
    .eq('buyer_lead_id', buyerLeadId)
    .maybeSingle()

  if (existing.error) throw new Error(`Lecture dossier client acquéreur impossible: ${existing.error.message}`)

  const payload = {
    client_profile_id: (profile as ClientProfile).id,
    client_type: 'buyer',
    buyer_lead_id: buyerLeadId,
    status: 'active',
    title: buildBuyerDossierTitle(buyerRecord, prospect),
    property_snapshot: buildBuyerSnapshot(buyerRecord) as Json,
    professional_opinion: {} as Json,
    advisor_note: 'Je garde ce dossier à jour pour vous donner une lecture claire de la recherche et des biens proposés.',
  }

  const dossierResult = existing.data
    ? await supabaseAdmin
        .from('client_dossiers')
        .update(payload as never)
        .eq('id', (existing.data as ClientDossier).id)
        .select('*')
        .single()
    : await supabaseAdmin
        .from('client_dossiers')
        .insert(payload as never)
        .select('*')
        .single()

  if (dossierResult.error) throw new Error(`Préparation dossier client acquéreur impossible: ${dossierResult.error.message}`)
  if (!dossierResult.data) throw new Error('Dossier client acquéreur non retourné')

  const dossier = dossierResult.data as ClientDossier

  return { profile: profile as ClientProfile, dossier }
}

export async function getCurrentClientDossier(
  supabase: SupabaseClient<Database>,
): Promise<ClientPortalDossier | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) return null

  const profile = await findClientProfile(supabase, user.id, user.email)
  if (!profile) return null

  const { data: dossiers, error: dossierError } = await supabase
    .from('client_dossiers')
    .select('*')
    .eq('client_profile_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (dossierError) throw new Error(`Lecture dossier client impossible: ${dossierError.message}`)
  const dossier = (dossiers?.[0] as ClientDossier | undefined) ?? null
  if (!dossier) return null

  const [lead, sellerProperty, opportunity, documents, events] = await Promise.all([
    loadLead(supabase, dossier.lead_id),
    loadSellerProperty(supabase, dossier),
    loadOpportunity(supabase, dossier),
    loadDocuments(supabase, dossier.id),
    loadEvents(supabase, dossier.id),
  ])

  return {
    profile,
    dossier: projectClientDossierFromOpportunity(dossier, opportunity),
    lead,
    sellerProperty,
    opportunity,
    documents,
    events,
  }
}

async function findClientProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string,
) {
  const byUser = await supabase
    .from('client_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (byUser.error) throw new Error(`Lecture profil client impossible: ${byUser.error.message}`)
  if (byUser.data) return byUser.data as ClientProfile

  const byEmail = await supabase
    .from('client_profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (byEmail.error) throw new Error(`Lecture profil client impossible: ${byEmail.error.message}`)
  return (byEmail.data as ClientProfile | null) ?? null
}

async function loadLead(supabase: SupabaseClient<Database>, leadId: string | null) {
  if (!leadId) return null
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      prospect:prospects!leads_prospect_id_fkey (
        id,
        email,
        first_name,
        last_name,
        phone
      )
    `)
    .eq('id', leadId)
    .maybeSingle()

  if (error) throw new Error(`Lecture lead client impossible: ${error.message}`)
  return (data as ClientLead | null) ?? null
}

async function loadSellerProperty(
  supabase: SupabaseClient<Database>,
  dossier: ClientDossier,
) {
  if (dossier.seller_property_id) {
    const { data, error } = await supabase
      .from('seller_properties')
      .select('*')
      .eq('id', dossier.seller_property_id)
      .maybeSingle()

    if (error) throw new Error(`Lecture bien client impossible: ${error.message}`)
    return (data as SellerProperty | null) ?? null
  }

  if (!dossier.lead_id) return null
  const { data, error } = await supabase
    .from('seller_properties')
    .select('*')
    .eq('lead_id', dossier.lead_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Lecture bien client impossible: ${error.message}`)
  return (data as SellerProperty | null) ?? null
}

async function loadOpportunity(
  supabase: SupabaseClient<Database>,
  dossier: ClientDossier,
) {
  if (dossier.opportunity_id) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', dossier.opportunity_id)
      .maybeSingle()

    if (error) throw new Error(`Lecture opportunité client impossible: ${error.message}`)
    return (data as Opportunity | null) ?? null
  }

  if (!dossier.lead_id) return null
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('lead_id', dossier.lead_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Lecture opportunité client impossible: ${error.message}`)
  return (data as Opportunity | null) ?? null
}

async function loadDocuments(supabase: SupabaseClient<Database>, dossierId: string) {
  const { data, error } = await supabase
    .from('client_documents')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Lecture documents client impossible: ${error.message}`)

  const documents = (data ?? []) as ClientDocument[]
  return Promise.all(
    documents.map(async (document) => {
      if (!document.storage_path) return { ...document, signed_url: null }
      const signed = await supabase
        .storage
        .from('client-documents')
        .createSignedUrl(document.storage_path, 60 * 15)

      return {
        ...document,
        signed_url: signed.data?.signedUrl ?? null,
      }
    }),
  )
}

async function loadEvents(supabase: SupabaseClient<Database>, dossierId: string) {
  const { data, error } = await supabase
    .from('client_dossier_events')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Lecture jalons client impossible: ${error.message}`)
  return (data ?? []) as ClientDossierEvent[]
}

function buildDossierTitle(
  lead: LeadWithProspect,
  sellerProperty: SellerProperty | null,
  opportunity: Opportunity | null,
) {
  if (opportunity?.title) return opportunity.title
  const city = lead.commune ?? sellerProperty?.adresse ?? null
  if (city) return `Projet de vente - ${city}`
  return 'Projet de vente'
}

function buildPropertySnapshot(
  lead: LeadWithProspect,
  sellerProperty: SellerProperty | null,
  opportunity: Opportunity | null,
) {
  const formData = isRecord(lead.form_data) ? lead.form_data : {}
  const opportunitySnapshot = isRecord(opportunity?.property_snapshot ?? null) ? opportunity?.property_snapshot as Record<string, Json | undefined> : {}
  return {
    ...opportunitySnapshot,
    adresse: text(opportunitySnapshot.adresse) ?? sellerProperty?.adresse ?? text(formData.adresse) ?? opportunity?.property_address ?? null,
    commune: text(opportunitySnapshot.commune) ?? lead.commune ?? opportunity?.property_city ?? null,
    type_bien: text(opportunitySnapshot.type_bien) ?? sellerProperty?.type_bien ?? text(formData.type_bien) ?? opportunity?.property_type ?? null,
    surface: numberValue(opportunitySnapshot.surface) ?? sellerProperty?.surface ?? numberValue(formData.surface) ?? opportunity?.property_surface ?? null,
    surface_terrain: numberValue(opportunitySnapshot.surface_terrain) ?? sellerProperty?.surface_terrain ?? numberValue(formData.surface_terrain) ?? opportunity?.property_land_surface ?? null,
    nb_pieces: numberValue(opportunitySnapshot.nb_pieces) ?? sellerProperty?.nb_pieces ?? numberValue(formData.nb_pieces) ?? opportunity?.property_rooms ?? null,
    prix_estime: numberValue(opportunitySnapshot.prix_estime) ?? sellerProperty?.prix_estime ?? numberValue(formData.prix_estime) ?? null,
  }
}

function buildProfessionalOpinion(opportunity: Opportunity | null) {
  return isRecord(opportunity?.professional_opinion ?? null)
    ? opportunity?.professional_opinion ?? {}
    : {}
}

async function loadProspectForBuyer(buyer: BuyerCriteria) {
  const prospectId = text(buyer.prospect_id)
  if (prospectId) {
    const { data, error } = await supabaseAdmin
      .from('prospects')
      .select('id, email, first_name, last_name, phone')
      .eq('id', prospectId)
      .maybeSingle()

    if (error) throw new Error(`Lecture prospect acquéreur impossible: ${error.message}`)
    if (data) return data as Pick<Prospect, 'id' | 'email' | 'first_name' | 'last_name' | 'phone'>
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select(`
      prospect:prospects!leads_prospect_id_fkey (
        id,
        email,
        first_name,
        last_name,
        phone
      )
    `)
    .eq('id', buyer.lead_id)
    .maybeSingle()

  if (error) throw new Error(`Lecture lead acquéreur impossible: ${error.message}`)
  const record = data as { prospect?: Pick<Prospect, 'id' | 'email' | 'first_name' | 'last_name' | 'phone'> | null } | null
  return record?.prospect ?? null
}

function buildBuyerDossierTitle(
  buyer: BuyerCriteria,
  prospect: Pick<Prospect, 'first_name' | 'last_name'> | null,
) {
  const name = [prospect?.first_name, prospect?.last_name].filter(Boolean).join(' ').trim()
  const place = buyer.communes?.slice(0, 2).join(', ')
  if (name && place) return `Recherche acquéreur - ${name} - ${place}`
  if (name) return `Recherche acquéreur - ${name}`
  if (place) return `Recherche acquéreur - ${place}`
  return 'Recherche acquéreur'
}

function buildBuyerSnapshot(buyer: BuyerCriteria) {
  return {
    type_projet: 'achat',
    type_bien: buyer.type_bien,
    communes: buyer.communes,
    budget_max: buyer.budget_max,
    surface_min: buyer.surface_min,
    pieces_min: buyer.pieces_min,
    criteres: buyer.criteres,
    stage: buyer.stage,
    next_action: buyer.next_action,
    due_date: buyer.due_date,
  }
}

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

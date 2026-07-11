import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { projectClientDossierFromOpportunity } from '@/lib/client-dossier-projection'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

type ClientProfile = Database['public']['Tables']['client_profiles']['Row']
type ClientDossier = Database['public']['Tables']['client_dossiers']['Row']
type ClientDocument = Database['public']['Tables']['client_documents']['Row']
type ClientDossierEvent = Database['public']['Tables']['client_dossier_events']['Row']
type Lead = Database['public']['Tables']['leads']['Row']
type Prospect = Database['public']['Tables']['prospects']['Row']
type SellerProperty = Database['public']['Tables']['seller_properties']['Row']
type Opportunity = Database['public']['Tables']['opportunities']['Row']

export type AdminClientDossier = ClientDossier & {
  client_profile: ClientProfile
}

export type AdminClientDocument = ClientDocument & {
  signed_url: string | null
}

export type AdminClientDetail = {
  dossier: AdminClientDossier
  lead: (Lead & { prospect?: Pick<Prospect, 'id' | 'email' | 'first_name' | 'last_name' | 'phone'> | null }) | null
  seller_property: SellerProperty | null
  opportunity: Opportunity | null
  documents: AdminClientDocument[]
  events: ClientDossierEvent[]
}

export async function rejectIfNoAdmin() {
  if (process.env.NODE_ENV !== 'production') return null
  const admin = await getCurrentAdmin()
  if (admin) return null
  return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 401 })
}

export async function loadAdminClientDossier(id: string): Promise<AdminClientDetail | null> {
  const { data: dossier, error } = await supabaseAdmin
    .from('client_dossiers')
    .select('*, client_profile:client_profiles(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!dossier) return null

  const record = dossier as AdminClientDossier
  const [lead, sellerProperty, opportunity, documents, events] = await Promise.all([
    loadLead(record.lead_id),
    loadSellerProperty(record),
    loadOpportunity(record),
    loadDocuments(record.id),
    loadEvents(record.id),
  ])

  return {
    dossier: projectClientDossierFromOpportunity(record, opportunity),
    lead,
    seller_property: sellerProperty,
    opportunity,
    documents,
    events,
  }
}

export async function loadDocuments(dossierId: string): Promise<AdminClientDocument[]> {
  const { data, error } = await supabaseAdmin
    .from('client_documents')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return Promise.all(
    ((data ?? []) as ClientDocument[]).map(async (document) => {
      if (!document.storage_path) return { ...document, signed_url: null }
      const signed = await supabaseAdmin
        .storage
        .from('client-documents')
        .createSignedUrl(document.storage_path, 60 * 15)
      return { ...document, signed_url: signed.data?.signedUrl ?? null }
    }),
  )
}

export async function assertDossierExists(dossierId: string) {
  const { data, error } = await supabaseAdmin
    .from('client_dossiers')
    .select('id')
    .eq('id', dossierId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

async function loadLead(leadId: string | null) {
  if (!leadId) return null
  const { data, error } = await supabaseAdmin
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

  if (error) throw new Error(error.message)
  return data as AdminClientDetail['lead']
}

async function loadSellerProperty(dossier: ClientDossier) {
  if (dossier.seller_property_id) {
    const { data, error } = await supabaseAdmin
      .from('seller_properties')
      .select('*')
      .eq('id', dossier.seller_property_id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data as SellerProperty | null
  }

  if (!dossier.lead_id) return null
  const { data, error } = await supabaseAdmin
    .from('seller_properties')
    .select('*')
    .eq('lead_id', dossier.lead_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as SellerProperty | null
}

async function loadOpportunity(dossier: ClientDossier) {
  if (dossier.opportunity_id) {
    const { data, error } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', dossier.opportunity_id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data as Opportunity | null
  }

  if (!dossier.lead_id) return null
  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .select('*')
    .eq('lead_id', dossier.lead_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Opportunity | null
}

async function loadEvents(dossierId: string) {
  const { data, error } = await supabaseAdmin
    .from('client_dossier_events')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ClientDossierEvent[]
}

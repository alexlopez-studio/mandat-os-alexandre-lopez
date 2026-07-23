import { createClient } from '@supabase/supabase-js'
import { loadAdminClientDossier } from '@/lib/market/client-admin'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, Json } from '@/types/supabase'

type ClientProfile = Database['public']['Tables']['client_profiles']['Row']
type ClientDossier = Database['public']['Tables']['client_dossiers']['Row']
type ClientDocument = Database['public']['Tables']['client_documents']['Row']
type ClientDossierEvent = Database['public']['Tables']['client_dossier_events']['Row']

export type ClientPortalPayload = {
  readOnly: true
  source: 'mandat-os'
  generated_at: string
  estimation: {
    status: 'empty' | 'draft' | 'published'
    published_at: string | null
  }
  property_context: {
    type: string | null
    commune: string | null
  }
  sales_follow_up: {
    status: 'teaser' | 'active'
  }
  mandate_stage: string | null
  profile: Pick<ClientProfile, 'id' | 'email' | 'first_name' | 'last_name' | 'phone'>
  dossier: Pick<
    ClientDossier,
    'id' | 'public_token' | 'status' | 'title' | 'client_type' | 'property_snapshot' | 'professional_opinion' | 'advisor_note' | 'created_at' | 'updated_at'
  > & { mandate_signed_at: string | null }
  documents: Array<Pick<ClientDocument, 'id' | 'label' | 'category' | 'status' | 'file_name' | 'file_size' | 'mime_type' | 'uploaded_at' | 'validated_at'> & {
    signed_url: string | null
  }>
  events: Array<Pick<ClientDossierEvent, 'id' | 'type' | 'title' | 'description' | 'status' | 'event_date' | 'payload' | 'created_at' | 'updated_at'>>
}

export async function loadClientPortalPayloadByDossierId(dossierId: string): Promise<ClientPortalPayload | null> {
  const detail = await loadAdminClientDossier(dossierId)
  if (!detail || detail.dossier.status !== 'active') return null
  return toPayload(detail)
}

export async function loadClientPortalPayloadForBearerToken(
  authorization: string | null,
  requestedDossierId?: string | null,
): Promise<ClientPortalPayload | null> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  )

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  const user = userResult?.user
  if (userError || !user?.email) return null

  const profile = await findClientProfile(user.id, user.email)
  if (!profile) return null

  let query = supabaseAdmin
    .from('client_dossiers')
    .select('id')
    .eq('client_profile_id', profile.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (requestedDossierId) {
    query = isUuid(requestedDossierId)
      ? query.eq('id', requestedDossierId)
      : query.eq('public_token', requestedDossierId)
  }

  const { data: dossier, error } = await query.maybeSingle()
  if (error || !dossier?.id) return null

  return loadClientPortalPayloadByDossierId(dossier.id)
}

async function findClientProfile(userId: string, email: string) {
  const byUser = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (byUser.error) throw byUser.error
  if (byUser.data) return byUser.data as ClientProfile

  const byEmail = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (byEmail.error) throw byEmail.error
  return (byEmail.data as ClientProfile | null) ?? null
}

function toPayload(detail: Awaited<ReturnType<typeof loadAdminClientDossier>>): ClientPortalPayload {
  if (!detail) throw new Error('Dossier introuvable')

  const profile = detail.dossier.client_profile
  const professionalOpinion = asRecord(detail.dossier.professional_opinion)
  const propertySnapshot = asRecord(detail.dossier.property_snapshot)
  const estimation = estimationState(professionalOpinion)
  return {
    readOnly: true,
    source: 'mandat-os',
    generated_at: new Date().toISOString(),
    estimation,
    property_context: {
      type: textValue(
        detail.seller_property?.type_bien,
        detail.opportunity?.property_type,
        propertySnapshot.type_bien,
        propertySnapshot.property_type,
        propertySnapshot.type,
      ),
      commune: textValue(
        detail.lead?.commune,
        detail.opportunity?.property_city,
        propertySnapshot.commune,
        propertySnapshot.city,
        propertySnapshot.ville,
      ),
    },
    sales_follow_up: {
      status: isSalesFollowUpActive(detail.opportunity?.stage) ? 'active' : 'teaser',
    },
    mandate_stage: detail.opportunity?.stage ?? null,
    profile: {
      id: profile.id,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: profile.phone,
    },
    dossier: {
      id: detail.dossier.id,
      public_token: detail.dossier.public_token,
      status: detail.dossier.status,
      title: detail.dossier.title,
      client_type: detail.dossier.client_type,
      property_snapshot: sanitizeJson(detail.dossier.property_snapshot),
      professional_opinion: estimation.status === 'published' ? sanitizeJson(detail.dossier.professional_opinion) : {},
      advisor_note: detail.dossier.advisor_note,
      created_at: detail.dossier.created_at,
      updated_at: detail.dossier.updated_at,
      mandate_signed_at: (detail.dossier as any).mandate_signed_at ?? null,
    },
    documents: detail.documents.map((document) => ({
      id: document.id,
      label: document.label,
      category: document.category,
      status: document.status,
      file_name: document.file_name,
      file_size: document.file_size,
      mime_type: document.mime_type,
      uploaded_at: document.uploaded_at,
      validated_at: document.validated_at,
      signed_url: document.signed_url,
    })),
    events: detail.events
      .filter((event) => event.visible_to_client)
      .map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        status: event.status,
        event_date: event.event_date,
        payload: sanitizeJson(event.payload),
        created_at: event.created_at,
        updated_at: event.updated_at,
      })),
  }
}

function isSalesFollowUpActive(stage: string | null | undefined) {
  return stage === 'Mandat signé' || stage === 'Vendu'
}

function textValue(...values: Array<Json | string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function sanitizeJson(value: Json): Json {
  return value ?? {}
}

function asRecord(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, Json | undefined>
  return {}
}

function estimationState(opinion: Record<string, Json | undefined>): ClientPortalPayload['estimation'] {
  const published = opinion.client_portal_published === true
  const publishedAt = typeof opinion.client_portal_published_at === 'string' ? opinion.client_portal_published_at : null
  if (published) return { status: 'published', published_at: publishedAt }

  const draftKeys = Object.keys(opinion).filter((key) => !key.startsWith('client_portal_'))
  return {
    status: draftKeys.length > 0 ? 'draft' : 'empty',
    published_at: null,
  }
}

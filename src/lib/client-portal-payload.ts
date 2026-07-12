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
  profile: Pick<ClientProfile, 'id' | 'email' | 'first_name' | 'last_name' | 'phone'>
  dossier: Pick<
    ClientDossier,
    'id' | 'status' | 'title' | 'client_type' | 'property_snapshot' | 'professional_opinion' | 'advisor_note' | 'created_at' | 'updated_at'
  >
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

  if (requestedDossierId) query = query.eq('id', requestedDossierId)

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
  return {
    readOnly: true,
    source: 'mandat-os',
    generated_at: new Date().toISOString(),
    profile: {
      id: profile.id,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: profile.phone,
    },
    dossier: {
      id: detail.dossier.id,
      status: detail.dossier.status,
      title: detail.dossier.title,
      client_type: detail.dossier.client_type,
      property_snapshot: sanitizeJson(detail.dossier.property_snapshot),
      professional_opinion: sanitizeJson(detail.dossier.professional_opinion),
      advisor_note: detail.dossier.advisor_note,
      created_at: detail.dossier.created_at,
      updated_at: detail.dossier.updated_at,
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

function sanitizeJson(value: Json): Json {
  return value ?? {}
}

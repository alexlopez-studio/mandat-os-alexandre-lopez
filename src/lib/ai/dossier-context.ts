import { adminDb } from '@/lib/ai/db'
import type { Json } from '@/types/supabase'

export type AiDossierContext = {
  dossier: {
    id: string
    title: string
    status: string
    client_type: string
    property_snapshot: Json
    advisor_note: string | null
  }
  client: {
    email: string
    first_name: string
    last_name: string
    phone: string | null
  } | null
  documents: Array<{
    id: string
    label: string
    category: string
    status: string
    notes: string | null
  }>
  events: Array<{
    id: string
    type: string
    title: string
    description: string | null
    status: string
    event_date: string | null
  }>
}

export async function loadAiDossierContext(dossierId: string): Promise<AiDossierContext | null> {
  const { data: dossier, error } = await adminDb()
    .from('client_dossiers')
    .select('id, title, status, client_type, property_snapshot, advisor_note, client_profile:client_profiles(email, first_name, last_name, phone)')
    .eq('id', dossierId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!dossier) return null

  const [{ data: documents, error: documentsError }, { data: events, error: eventsError }] = await Promise.all([
    adminDb()
      .from('client_documents')
      .select('id, label, category, status, notes')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: true }),
    adminDb()
      .from('client_dossier_events')
      .select('id, type, title, description, status, event_date')
      .eq('dossier_id', dossierId)
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (documentsError) throw new Error(documentsError.message)
  if (eventsError) throw new Error(eventsError.message)

  return {
    dossier: {
      id: dossier.id,
      title: dossier.title,
      status: dossier.status,
      client_type: dossier.client_type,
      property_snapshot: dossier.property_snapshot,
      advisor_note: dossier.advisor_note,
    },
    client: dossier.client_profile ?? null,
    documents: documents ?? [],
    events: events ?? [],
  }
}

export async function listDossierCandidates() {
  const { data, error } = await adminDb()
    .from('client_dossiers')
    .select('id, title, status, client_type, property_snapshot, client_profile:client_profiles(email, first_name, last_name, phone)')
    .in('status', ['active', 'draft'])
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return data ?? []
}

export function renderDossierContext(context: AiDossierContext | null) {
  if (!context) return 'Aucun dossier client sélectionné.'

  const missingDocuments = context.documents.filter((document) => ['missing', 'requested', 'rejected'].includes(document.status))
  const recentEvents = context.events.slice(0, 8)

  return [
    `Dossier: ${context.dossier.title} (${context.dossier.status}, ${context.dossier.client_type})`,
    context.client ? `Client: ${[context.client.first_name, context.client.last_name].filter(Boolean).join(' ') || context.client.email} — ${context.client.email}` : 'Client: non renseigné',
    `Bien / snapshot: ${JSON.stringify(context.dossier.property_snapshot).slice(0, 1600)}`,
    `Documents à traiter: ${missingDocuments.map((document) => `${document.label} [${document.status}]`).join('; ') || 'aucun'}`,
    `Derniers jalons: ${recentEvents.map((event) => `${event.title} [${event.type}/${event.status}]`).join('; ') || 'aucun'}`,
    context.dossier.advisor_note ? `Note conseiller: ${context.dossier.advisor_note}` : '',
  ].filter(Boolean).join('\n')
}

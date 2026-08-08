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

export async function loadAiDossierContext(id: string): Promise<AiDossierContext | null> {
  // 1. Check client_dossiers
  const { data: dossier } = await adminDb()
    .from('client_dossiers')
    .select('id, title, status, client_type, property_snapshot, advisor_note, client_profile:client_profiles(email, first_name, last_name, phone)')
    .eq('id', id)
    .maybeSingle()

  if (dossier) {
    const [{ data: documents }, { data: events }] = await Promise.all([
      adminDb()
        .from('client_documents')
        .select('id, label, category, status, notes')
        .eq('dossier_id', id)
        .order('created_at', { ascending: true }),
      adminDb()
        .from('client_dossier_events')
        .select('id, type, title, description, status, event_date')
        .eq('dossier_id', id)
        .order('event_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20),
    ])

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

  // 2. Check opportunities (Projet Vente)
  const { data: opp } = await adminDb()
    .from('opportunities')
    .select('id, title, stage, property_city, property_type, type_bien, estimated_price_min, estimated_price_max, notes')
    .eq('id', id)
    .maybeSingle()

  if (opp) {
    const { data: links } = await adminDb()
      .from('project_contacts')
      .select('contact:contacts(first_name, last_name, email, phone)')
      .eq('opportunity_id', id)

    const contactsList = (links ?? []).map((l: any) => l.contact).filter(Boolean)
    const primaryContact = contactsList[0] ?? null

    return {
      dossier: {
        id: opp.id,
        title: opp.title || 'Projet Vente',
        status: opp.stage || 'Actif',
        client_type: 'vendeur',
        property_snapshot: {
          city: opp.property_city,
          type: opp.property_type || opp.type_bien,
          price_range: [opp.estimated_price_min, opp.estimated_price_max],
        },
        advisor_note: opp.notes || null,
      },
      client: primaryContact ? {
        first_name: primaryContact.first_name || '',
        last_name: primaryContact.last_name || '',
        email: primaryContact.email || '',
        phone: primaryContact.phone || null,
      } : null,
      documents: [],
      events: [],
    }
  }

  // 3. Check buyer_criteria (Projet Achat)
  const { data: bc } = await adminDb()
    .from('buyer_criteria')
    .select('id, lead_id, type_bien, communes, budget_max, stage, active, notes')
    .eq('id', id)
    .maybeSingle()

  if (bc) {
    const { data: links } = await adminDb()
      .from('project_contacts')
      .select('contact:contacts(first_name, last_name, email, phone)')
      .eq('buyer_criteria_id', id)

    const contactsList = (links ?? []).map((l: any) => l.contact).filter(Boolean)
    const primaryContact = contactsList[0] ?? null

    return {
      dossier: {
        id: bc.id,
        title: `Recherche ${bc.type_bien || 'bien'}`,
        status: bc.stage || (bc.active ? 'Actif' : 'Inactif'),
        client_type: 'acquereur',
        property_snapshot: {
          communes: bc.communes,
          type: bc.type_bien,
          budget_max: bc.budget_max,
        },
        advisor_note: bc.notes || null,
      },
      client: primaryContact ? {
        first_name: primaryContact.first_name || '',
        last_name: primaryContact.last_name || '',
        email: primaryContact.email || '',
        phone: primaryContact.phone || null,
      } : null,
      documents: [],
      events: [],
    }
  }

  return null
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

import { ensureClientDossierForLead } from '@/lib/client-portal'
import { upsertCrmProspect } from '@/lib/leads-crm'
import { createLead } from '@/lib/leads-repo'
import { ESTIMATION_DELIVERED_STAGE, SIGNED_MANDATE_STAGE } from '@/lib/market/seller-stages'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

export type DemoScenario = 'estimation_draft' | 'estimation_published' | 'mandate_signed'

export const DEMO_SCENARIOS: DemoScenario[] = ['estimation_draft', 'estimation_published', 'mandate_signed']

export const DEMO_SCENARIO_LABELS: Record<DemoScenario, string> = {
  estimation_draft: 'Estimation en préparation',
  estimation_published: 'Estimation réalisée et publiée',
  mandate_signed: 'Mandat de vente signé et vente en cours',
}

const DEMO_PROSPECT_EMAIL = 'demo.vendeur@mandat-os.internal'
const DEMO_BUYER_NAME = 'M. et Mme Martin'

const DEMO_STAGE_BY_SCENARIO: Record<DemoScenario, string> = {
  estimation_draft: ESTIMATION_DELIVERED_STAGE,
  estimation_published: 'Décision vendeur',
  mandate_signed: SIGNED_MANDATE_STAGE,
}

const DEMO_PROPERTY_SNAPSHOT = {
  adresse: '12 chemin des Oliviers',
  commune: 'Cotignac',
  type_bien: 'Maison',
  surface: 145,
  surface_terrain: 820,
  nb_pieces: 6,
  prix_estime: 495000,
}

const DEMO_OPINION_BASE = {
  price: 495000,
  price_low: 470000,
  price_high: 520000,
  summary: 'Maison provençale rénovée avec piscine, quartier calme proche du centre du village.',
}

function buildOpinion(scenario: DemoScenario): Json {
  if (scenario === 'estimation_draft') {
    return { ...DEMO_OPINION_BASE }
  }

  return {
    ...DEMO_OPINION_BASE,
    client_portal_published: true,
    client_portal_published_at: new Date().toISOString(),
  }
}

/** Idempotent : retrouve (ou crée) l'unique lead/opportunité/dossier de démo. */
export async function ensureDemoClientDossier() {
  const existingLead = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('is_test', true)
    .limit(1)
    .maybeSingle()

  if (existingLead.error) throw new Error(`Lecture lead démo impossible: ${existingLead.error.message}`)

  let leadId = existingLead.data?.id ?? null

  if (!leadId) {
    const prospect = await upsertCrmProspect({
      email: DEMO_PROSPECT_EMAIL,
      firstName: 'Jean',
      lastName: 'Dupont (démo)',
      phone: '0600000000',
    })

    const lead = await createLead({
      prospectId: prospect.id,
      tool: 'vendre',
      formData: {
        seller_name: 'Jean Dupont (démo)',
        email: DEMO_PROSPECT_EMAIL,
        commune: DEMO_PROPERTY_SNAPSHOT.commune,
        adresse: DEMO_PROPERTY_SNAPSHOT.adresse,
        type_bien: DEMO_PROPERTY_SNAPSHOT.type_bien,
      },
      commune: DEMO_PROPERTY_SNAPSHOT.commune,
      sourceChannel: 'demo',
      priority: 'medium',
    })

    const { error: leadUpdateError } = await supabaseAdmin
      .from('leads')
      .update({ is_test: true } as never)
      .eq('id', lead.id)
    if (leadUpdateError) throw new Error(`Marquage lead démo impossible: ${leadUpdateError.message}`)

    leadId = lead.id
  }

  const existingOpportunity = await supabaseAdmin
    .from('opportunities')
    .select('id')
    .eq('lead_id', leadId)
    .eq('is_test', true)
    .limit(1)
    .maybeSingle()

  if (existingOpportunity.error) throw new Error(`Lecture opportunité démo impossible: ${existingOpportunity.error.message}`)

  let opportunityId = existingOpportunity.data?.id ?? null

  if (!opportunityId) {
    const { data: opportunity, error } = await supabaseAdmin
      .from('opportunities')
      .insert({
        lead_id: leadId,
        title: 'Maison provençale - Cotignac (démo)',
        stage: ESTIMATION_DELIVERED_STAGE,
        property_snapshot: DEMO_PROPERTY_SNAPSHOT as Json,
        created_from: 'demo',
        is_test: true,
      } as never)
      .select('id')
      .single()

    if (error) throw new Error(`Création opportunité démo impossible: ${error.message}`)
    opportunityId = (opportunity as { id: string }).id
  }

  const { dossier } = await ensureClientDossierForLead(leadId, opportunityId)

  if (!dossier.is_test) {
    const { error } = await supabaseAdmin
      .from('client_dossiers')
      .update({ is_test: true } as never)
      .eq('id', dossier.id)
    if (error) throw new Error(`Marquage dossier démo impossible: ${error.message}`)
  }

  return { dossierId: dossier.id, opportunityId, leadId }
}

export async function applyDemoScenario(scenario: DemoScenario) {
  const { dossierId, opportunityId } = await ensureDemoClientDossier()
  const opinion = buildOpinion(scenario)
  const stage = DEMO_STAGE_BY_SCENARIO[scenario]
  const mandateSignedAt = scenario === 'mandate_signed' ? new Date().toISOString() : null

  const [opportunityUpdate, dossierUpdate] = await Promise.all([
    supabaseAdmin
      .from('opportunities')
      .update({ stage, professional_opinion: opinion } as never)
      .eq('id', opportunityId),
    supabaseAdmin
      .from('client_dossiers')
      .update({ professional_opinion: opinion, mandate_signed_at: mandateSignedAt } as never)
      .eq('id', dossierId),
  ])

  if (opportunityUpdate.error) throw new Error(`Mise à jour opportunité démo impossible: ${opportunityUpdate.error.message}`)
  if (dossierUpdate.error) throw new Error(`Mise à jour dossier démo impossible: ${dossierUpdate.error.message}`)

  await syncDemoEvents(dossierId, scenario)

  return { dossierId, opportunityId, scenario }
}

async function syncDemoEvents(dossierId: string, scenario: DemoScenario) {
  if (scenario !== 'mandate_signed') {
    const { error } = await supabaseAdmin
      .from('client_dossier_events')
      .update({ visible_to_client: false } as never)
      .eq('dossier_id', dossierId)
      .eq('is_test', true)
    if (error) throw new Error(`Masquage événements démo impossible: ${error.message}`)
    return
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('client_dossier_events')
    .select('id')
    .eq('dossier_id', dossierId)
    .eq('is_test', true)

  if (existingError) throw new Error(`Lecture événements démo impossible: ${existingError.message}`)

  if (existing && existing.length > 0) {
    const { error } = await supabaseAdmin
      .from('client_dossier_events')
      .update({ visible_to_client: true } as never)
      .eq('dossier_id', dossierId)
      .eq('is_test', true)
    if (error) throw new Error(`Réaffichage événements démo impossible: ${error.message}`)
    return
  }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('client_dossier_events').insert([
    {
      dossier_id: dossierId,
      type: 'visit',
      title: `Visite avec ${DEMO_BUYER_NAME}`,
      status: 'done',
      event_date: now,
      payload: {
        buyerName: DEMO_BUYER_NAME,
        rating: 4,
        interestLevel: 'Élevé',
        solvencyStatus: 'Validée',
      } as Json,
      visible_to_client: true,
      is_test: true,
      created_by: 'demo',
    },
    {
      dossier_id: dossierId,
      type: 'offer',
      title: `Offre de ${DEMO_BUYER_NAME}`,
      status: 'todo',
      event_date: now,
      payload: {
        buyerName: DEMO_BUYER_NAME,
        price: 480000,
        financingType: 'Emprunt bancaire',
        solvencyCertificate: true,
      } as Json,
      visible_to_client: true,
      is_test: true,
      created_by: 'demo',
    },
  ] as never)

  if (error) throw new Error(`Création événements démo impossible: ${error.message}`)
}

export function scenarioFromState(stage: string | null | undefined, opinion: Record<string, Json | undefined>): DemoScenario {
  if (stage === SIGNED_MANDATE_STAGE) return 'mandate_signed'
  if (opinion.client_portal_published === true) return 'estimation_published'
  return 'estimation_draft'
}

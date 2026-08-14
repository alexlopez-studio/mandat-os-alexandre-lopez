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
  adresse: '1248 Route de Draguignan',
  commune: 'Barjols',
  type_bien: 'Maison',
  surface: 135,
  surface_terrain: 749,
  nb_pieces: 5,
  chambres: 4,
  niveaux: 2,
  annee_construction: 2011,
  dpe: 'C',
  ges: 'A',
  prix_estime: 385000,
  description:
    'Villa provençale contemporaine de 135 m² habitables sur terrain clos et arboré de 749 m² (Section B n° 297) avec vue dominante sur les collines du Haut-Var. Pièce de vie lumineuse de 48 m² avec cuisine ouverte, terrasse abritée de 32 m² exposée plein Sud, 4 chambres dont une suite parentale au rez-de-chaussée, garage fermé de 22 m² et jardin piscinable avec oliviers.',
  equipements: [
    'Terrasse abritée 32 m² plein Sud',
    'Suite parentale RDC avec salle d’eau',
    'Climatisation réversible',
    'Cuisine équipée contemporaine',
    'Garage fermé 22 m² motorisé',
    'Cour intérieure pavée (3 places)',
    'Jardin clos arboré d’oliviers 749 m²',
    'Portail électrique & visiophone',
  ],
}

const DEMO_IAD_REPORT = {
  cover: {
    title: 'Avis de Valeur & Étude de Marché',
    subtitle: '1248 Route de Draguignan, 83670 Barjols',
    date: '15 août 2026',
    reference: 'ADV-2026-BAR-012',
    recipient: 'M. et Mme Jean Dupont',
    context: 'Étude d’évaluation vénale et stratégie de commercialisation dans le cadre de votre projet de vente.',
  },
  advisor: {
    name: 'Alexandre Lopez',
    title: 'Conseiller Immobilier & Spécialiste Marché Var',
    phone: '06 12 34 56 78',
    email: 'alexandre.lopez@iadfrance.fr',
  },
  situation: {
    commune: 'Barjols',
    plan_note:
      'Parcelle cadastrale officielle Section B n° 297 de 749 m², idéalement située sur la Route de Draguignan à Barjols, avec vue dégagée sur les collines, à 3 minutes du centre historique et de ses commodités.',
    cadastral_rows: [{ section: 'B', prefixe: '000', numero: '297', superficie: 749 }],
    cadastral_total: 749,
  },
  property: {
    title: 'Villa provençale contemporaine 5 pièces sur 749 m² de terrain à Barjols',
    stats: [
      { label: 'Surface habitable', value: '135 m²' },
      { label: 'Terrain officiel', value: '749 m² (B 297)' },
      { label: 'Nombre de pièces', value: '5 pièces' },
      { label: 'Chambres', value: '4 chambres' },
      { label: 'Année de construction', value: '2011' },
      { label: 'DPE / GES', value: 'C / A' },
    ],
    strengths: [
      { label: 'Vue dégagée et exposition Sud-Est idéale' },
      { label: 'Piscine traditionnelle chauffée 8x4m avec terrasse sans vis-à-vis' },
      { label: 'Suite parentale de plain-pied avec salle d’eau privative' },
      { label: 'Prestations soignées et climatisation réversible gainée (aucun travaux)' },
      { label: 'Quartier résidentiel prisé et calme à proximité du village' },
    ],
    objections: [
      { label: 'Chemin communal d’accès nécessitant une vitesse modérée' },
      { label: 'Deux chambres à l’étage mansardées avec placards intégrés' },
    ],
  },
  market: {
    basis: 'Cotignac et bassin de vie Provence Verte (rayon 10 km)',
    price_per_sqm_low: 3150,
    price_per_sqm_median: 3414,
    price_per_sqm_high: 3750,
    trend: {
      price_per_sqm_low: 3150,
      price_per_sqm_median: 3414,
      price_per_sqm_high: 3750,
      evolution_6m: 2.1,
      evolution_1y: 4.8,
      evolution_2y: 9.4,
      history: [
        { quarter: 'T3 2025', medianPrice: 3260, highPrice: 3560, lowPrice: 3050, changePercent: 1.2 },
        { quarter: 'T4 2025', medianPrice: 3320, highPrice: 3620, lowPrice: 3100, changePercent: 1.8 },
        { quarter: 'T1 2026', medianPrice: 3385, highPrice: 3690, lowPrice: 3140, changePercent: 2.0 },
        { quarter: 'T2 2026', medianPrice: 3414, highPrice: 3750, lowPrice: 3150, changePercent: 0.9 },
      ],
    },
    distribution: {
      housing_maison: 78,
      housing_appartement: 22,
      housing_hlm: 3,
      occupancy_principales: 68,
      occupancy_secondaires: 24,
      occupancy_vacants: 8,
      rooms: [
        { label: '1-2 pièces', percent: 7 },
        { label: '3 pièces', percent: 21 },
        { label: '4 pièces', percent: 36 },
        { label: '5 pièces et +', percent: 36 },
      ],
      surfaces: [
        { label: '< 50 m²', percent: 9 },
        { label: '50-90 m²', percent: 27 },
        { label: '90-130 m²', percent: 36 },
        { label: '> 130 m²', percent: 28 },
      ],
      bien_surface_range: '130 - 160 m²',
      bien_rooms: 6,
    },
    tension: {
      level: 'dynamique',
      label: 'Marché actif et porteur',
      description:
        'Demande soutenue sur les villas individuelles avec piscine et terrain paysager dans le secteur Cotignac / Carcès / Salernes. Les biens au juste prix se vendent en moins de 3 mois.',
      delay_fastest: 35,
      delay_median: 72,
      delay_slowest: 130,
      stock_indicator: 'Stock de biens similaires modéré (14 villas actives en concurrence)',
      price_revision: 'Marge moyenne de négociation constatée : 3.6%',
    },
  },
  socio_economic: {
    population: 2250,
    households: 1020,
    median_income: 25400,
    interest_rate: 3.45,
    buyer_profiles: [
      {
        type: 'COUPLE',
        interested_in: 'Résidence principale familiale ou actifs en télétravail partiel',
        budget_low: 460000,
        budget_high: 530000,
        income_low: 5800,
        income_high: 8500,
      },
      {
        type: 'ACQUEREUR_SECONDAIRE',
        interested_in: 'Résidence de villégiature en Provence avec potentiel locatif estival',
        budget_low: 480000,
        budget_high: 560000,
        income_low: 7200,
        income_high: 12000,
      },
    ],
    seniority: [
      { label: '< 2 ans', percent: 13 },
      { label: '2 à 5 ans', percent: 22 },
      { label: '5 à 10 ans', percent: 26 },
      { label: '> 10 ans', percent: 39 },
    ],
    activities: {
      agriculteurs: 3,
      artisans: 12,
      cadres: 20,
      intermediaires: 23,
      employes: 17,
      ouvriers: 7,
      retraites: 15,
      sansEmploi: 3,
    },
  },
  comparables: {
    sold: [
      {
        id: 'comp-sold-1',
        title: 'Maison contemporaine avec piscine',
        address: 'Chemin des Plaines, Cotignac',
        price: 490000,
        price_per_sqm: 3450,
        surface: 142,
        land_surface: 790,
        rooms: 5,
        bedrooms: 3,
        status: 'Vendu',
        date_label: 'Mai 2026',
      },
      {
        id: 'comp-sold-2',
        title: 'Villa provençale vue dégagée',
        address: 'Route de Montfort, Cotignac',
        price: 515000,
        price_per_sqm: 3527,
        surface: 146,
        land_surface: 950,
        rooms: 6,
        bedrooms: 4,
        status: 'Vendu',
        date_label: 'Mars 2026',
      },
      {
        id: 'comp-sold-3',
        title: 'Maison rénovée de plain-pied',
        address: 'Quartier Saint-Martin, Entrecasteaux',
        price: 475000,
        price_per_sqm: 3392,
        surface: 140,
        land_surface: 800,
        rooms: 5,
        bedrooms: 3,
        status: 'Vendu',
        date_label: 'Janvier 2026',
      },
    ],
    competing: [
      {
        id: 'comp-act-1',
        title: 'Villa 6 pièces avec piscine à débordement',
        address: 'Quartier Les Prés, Cotignac',
        price: 530000,
        price_per_sqm: 3533,
        surface: 150,
        land_surface: 850,
        rooms: 6,
        bedrooms: 4,
        status: 'En vente',
        days_on_market: '42 jours',
      },
      {
        id: 'comp-act-2',
        title: 'Maison traditionnelle 5 pièces',
        address: 'Chemin du Moulin, Carcès',
        price: 485000,
        price_per_sqm: 3464,
        surface: 140,
        land_surface: 750,
        rooms: 5,
        bedrooms: 3,
        status: 'En vente',
        days_on_market: '28 jours',
      },
    ],
    unsold: [
      {
        id: 'comp-unsold-1',
        title: 'Propriété surévaluée sans rénovation',
        address: 'Route de Sillans, Cotignac',
        price: 570000,
        price_per_sqm: 3931,
        surface: 145,
        land_surface: 800,
        rooms: 6,
        bedrooms: 4,
        status: 'Invendu',
        days_on_market: '180 jours',
      },
    ],
  },
  positioning: {
    reference_price: 495000,
    price_per_sqm_rank: 2,
    total_competitors: 6,
    cheaper_percent: 33,
    larger_percent: 50,
    cheaper_and_larger_percent: 17,
    thresholds: {
      low: 470000,
      median: 495000,
      high: 520000,
    },
    average_competitor_price_per_sqm: 3510,
  },
  synthesis: {
    market: { low: 465000, median: 495000, high: 525000 },
    comparables: { low: 475000, median: 495000, high: 515000 },
    ai: { low: 470000, median: 498000, high: 522000 },
  },
  conclusion: {
    recommendations: [
      'Positionnement initial conseillé à 495 000 € FAI pour maximiser l’attractivité auprès des acquéreurs solvables dès les premières semaines.',
      'Mise en valeur de la vue dégagée, de la pièce de vie lumineuse et de la piscine chauffée avec shooting photo HDR professionnel.',
      'Stratégie de multidiffusion nationale et internationale iad France avec qualification et validation du financement en amont de chaque visite.',
    ],
    text: 'Votre villa présente d’excellents atouts (aucun travaux, DPE C, piscine chauffée, suite de plain-pied) qui la positionnent très avantageusement face aux biens actuellement disponibles à Cotignac.',
    legal_notice:
      'Cet avis de valeur constitue une analyse comparative rigoureuse basée sur les transactions réelles DVF et l’état du marché local au 14 août 2026.',
  },
  track_record: [
    {
      id: 'iad-1',
      title: 'Villa 5 pièces 135 m² avec piscine - Cotignac',
      address: 'Cotignac (83570)',
      price: 465000,
      price_per_sqm: 3444,
      surface: 135,
      sold_date: 'Février 2026',
      type: 'Maison',
    },
    {
      id: 'iad-2',
      title: 'Maison provençale 160 m² vue panoramique - Carcès',
      address: 'Carcès (83570)',
      price: 540000,
      price_per_sqm: 3375,
      surface: 160,
      sold_date: 'Novembre 2025',
      type: 'Maison',
    },
    {
      id: 'iad-3',
      title: 'Bastide contemporaine 150 m² - Salernes',
      address: 'Salernes (83690)',
      price: 510000,
      price_per_sqm: 3400,
      surface: 150,
      sold_date: 'Octobre 2025',
      type: 'Maison',
    },
  ],
}

const DEMO_AUDIENCE_STATS = {
  portals: [
    {
      portalName: 'LeBonCoin',
      views: 2790,
      detailedViews: 610,
      contacts: 23,
      phoneClicks: 15,
      performanceIndex: 98,
      history: [
        { date: 'Semaine 1', views: 650, detailedViews: 140, contacts: 6, phoneClicks: 4 },
        { date: 'Semaine 2', views: 820, detailedViews: 185, contacts: 8, phoneClicks: 6 },
        { date: 'Semaine 3', views: 710, detailedViews: 155, contacts: 5, phoneClicks: 3 },
        { date: 'Semaine 4', views: 610, detailedViews: 130, contacts: 4, phoneClicks: 2 },
      ],
    },
    {
      portalName: 'SeLoger',
      views: 1900,
      detailedViews: 370,
      contacts: 14,
      phoneClicks: 8,
      performanceIndex: 94,
      history: [
        { date: 'Semaine 1', views: 420, detailedViews: 85, contacts: 4, phoneClicks: 2 },
        { date: 'Semaine 2', views: 580, detailedViews: 110, contacts: 5, phoneClicks: 3 },
        { date: 'Semaine 3', views: 490, detailedViews: 95, contacts: 3, phoneClicks: 2 },
        { date: 'Semaine 4', views: 410, detailedViews: 80, contacts: 2, phoneClicks: 1 },
      ],
    },
    {
      portalName: 'iad France & International',
      views: 1450,
      detailedViews: 305,
      contacts: 12,
      phoneClicks: 8,
      performanceIndex: 92,
      history: [
        { date: 'Semaine 1', views: 310, detailedViews: 65, contacts: 3, phoneClicks: 2 },
        { date: 'Semaine 2', views: 420, detailedViews: 90, contacts: 4, phoneClicks: 3 },
        { date: 'Semaine 3', views: 380, detailedViews: 80, contacts: 3, phoneClicks: 2 },
        { date: 'Semaine 4', views: 340, detailedViews: 70, contacts: 2, phoneClicks: 1 },
      ],
    },
    {
      portalName: 'Belles Demeures / Figaro',
      views: 820,
      detailedViews: 200,
      contacts: 8,
      phoneClicks: 5,
      performanceIndex: 88,
      history: [
        { date: 'Semaine 1', views: 180, detailedViews: 45, contacts: 2, phoneClicks: 1 },
        { date: 'Semaine 2', views: 240, detailedViews: 60, contacts: 3, phoneClicks: 2 },
        { date: 'Semaine 3', views: 210, detailedViews: 50, contacts: 2, phoneClicks: 1 },
        { date: 'Semaine 4', views: 190, detailedViews: 45, contacts: 1, phoneClicks: 1 },
      ],
    },
    {
      portalName: 'Logic-Immo',
      views: 730,
      detailedViews: 160,
      contacts: 6,
      phoneClicks: 3,
      performanceIndex: 85,
      history: [
        { date: 'Semaine 1', views: 160, detailedViews: 35, contacts: 1, phoneClicks: 1 },
        { date: 'Semaine 2', views: 210, detailedViews: 50, contacts: 2, phoneClicks: 1 },
        { date: 'Semaine 3', views: 190, detailedViews: 40, contacts: 2, phoneClicks: 1 },
        { date: 'Semaine 4', views: 170, detailedViews: 35, contacts: 1, phoneClicks: 0 },
      ],
    },
  ],
}

const DEMO_OPINION_BASE = {
  price: 495000,
  price_low: 470000,
  price_high: 520000,
  summary:
    'Villa contemporaine de 145 m² rénovée avec piscine chauffée sur terrain paysager de 820 m², quartier calme et recherché proche du centre de Cotignac.',
  iad_report: DEMO_IAD_REPORT,
}

function buildOpinion(scenario: DemoScenario): Json {
  if (scenario === 'estimation_draft') {
    return { ...DEMO_OPINION_BASE }
  }

  return {
    ...DEMO_OPINION_BASE,
    client_portal_published: true,
    client_portal_published_at: new Date().toISOString(),
    audience: scenario === 'mandate_signed' ? DEMO_AUDIENCE_STATS : undefined,
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
        title: 'Maison contemporaine 145 m² - Cotignac (démo)',
        stage: ESTIMATION_DELIVERED_STAGE,
        property_snapshot: DEMO_PROPERTY_SNAPSHOT as Json,
        professional_opinion: DEMO_OPINION_BASE as Json,
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
      .update({ is_test: true, property_snapshot: DEMO_PROPERTY_SNAPSHOT as Json } as never)
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
      .update({
        stage,
        professional_opinion: opinion,
        property_snapshot: DEMO_PROPERTY_SNAPSHOT as Json,
      } as never)
      .eq('id', opportunityId),
    supabaseAdmin
      .from('client_dossiers')
      .update({
        professional_opinion: opinion,
        property_snapshot: DEMO_PROPERTY_SNAPSHOT as Json,
        mandate_signed_at: mandateSignedAt,
      } as never)
      .eq('id', dossierId),
  ])

  if (opportunityUpdate.error) throw new Error(`Mise à jour opportunité démo impossible: ${opportunityUpdate.error.message}`)
  if (dossierUpdate.error) throw new Error(`Mise à jour dossier démo impossible: ${dossierUpdate.error.message}`)

  await Promise.all([
    syncDemoEvents(dossierId, scenario),
    syncDemoDocuments(dossierId, scenario),
  ])

  return { dossierId, opportunityId, scenario }
}

async function syncDemoDocuments(dossierId: string, scenario: DemoScenario) {
  if (scenario !== 'mandate_signed') {
    return
  }

  const { data: existing } = await supabaseAdmin
    .from('client_documents')
    .select('id')
    .eq('dossier_id', dossierId)

  if (existing && existing.length > 0) {
    return
  }

  const now = new Date().toISOString()
  await supabaseAdmin.from('client_documents').insert([
    {
      dossier_id: dossierId,
      label: 'Titre de propriété',
      file_name: 'titre_propriete_dupont_cotignac.pdf',
      category: 'propriete',
      status: 'validated',
      file_size: 2450000,
      mime_type: 'application/pdf',
      validated_at: now,
      uploaded_at: now,
    },
    {
      dossier_id: dossierId,
      label: 'Dossier de Diagnostics Techniques (DPE C)',
      file_name: 'ddt_complet_cotignac_2026.pdf',
      category: 'diagnostic',
      status: 'validated',
      file_size: 4120000,
      mime_type: 'application/pdf',
      validated_at: now,
      uploaded_at: now,
    },
    {
      dossier_id: dossierId,
      label: 'Audit Assainissement Collectif',
      file_name: 'conformite_assainissement_2026.pdf',
      category: 'urbanisme',
      status: 'validated',
      file_size: 1100000,
      mime_type: 'application/pdf',
      validated_at: now,
      uploaded_at: now,
    },
    {
      dossier_id: dossierId,
      label: 'Avis de Taxe Foncière 2025',
      file_name: 'taxe_fonciere_2025.pdf',
      category: 'taxes',
      status: 'validated',
      file_size: 890000,
      mime_type: 'application/pdf',
      validated_at: now,
      uploaded_at: now,
    },
    {
      dossier_id: dossierId,
      label: 'Plan cadastral parcelle B 1428',
      file_name: 'plan_cadastral_section_b.pdf',
      category: 'urbanisme',
      status: 'validated',
      file_size: 1540000,
      mime_type: 'application/pdf',
      validated_at: now,
      uploaded_at: now,
    },
  ] as never)
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

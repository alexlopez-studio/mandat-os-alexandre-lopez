import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

import { ADVISOR } from './advisor'
import { geocodeAddress } from './geocode'
import {
  adjustPricePerM2,
  buildDistribution,
  computeTension,
  detectSegments,
  haversineKm,
  matchSegment,
  median,
  percentChange,
} from './market-analysis'
import type {
  AvisDeValeur,
  AvisFlag,
  ComparableProperty,
  CompetitionListing,
  EnergyData,
  MarketData,
  MarketYearData,
  PatrimonialData,
  ProfessionalOpinion,
  PropertyData,
  Rating,
  RoomSurface,
  ValuationData,
  ValuationReference,
} from './types'

/** Honoraires iad par défaut, en pourcentage du prix FAI. */
const DEFAULT_FEE_PERCENT = 4.5

/** Palette des surfaces par pièce — dégradé iad, du plus foncé au plus clair. */
const ROOM_COLORS = ['#006390', '#008EC3', '#00A1D8', '#00b4ec', '#25CFFF', '#95EBFF']

/**
 * Construit l'avis de valeur complet d'une opportunité.
 *
 * Point d'entrée unique du rapport : tout ce que les pages affichent sort d'ici.
 * La fonction ne lance jamais d'exception sur données manquantes — elle remplit
 * `meta.warnings` et laisse les trous visibles. Un blanc assumé vaut mieux
 * qu'un chiffre inventé.
 */
export async function buildAvisDeValeur(opportunityId: string): Promise<AvisDeValeur | null> {
  const warnings: string[] = []

  const { data: opportunity, error } = await supabaseAdmin
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .maybeSingle()

  if (error) throw error
  if (!opportunity) return null

  const snapshot = asRecord(opportunity.property_snapshot)
  const opinionRaw = asRecord(opportunity.professional_opinion)

  const sellerProperty = opportunity.lead_id ? await loadSellerProperty(opportunity.lead_id) : null

  const property = buildProperty(opportunity, sellerProperty, snapshot, warnings)
  // On résout sur le bien reconstruit, pas sur l'opportunité brute : la commune
  // vit souvent dans le snapshot quand les colonnes dédiées sont vides.
  const commune = await resolveCommune(property.postalCode, property.city)
  if (!commune) {
    warnings.push(
      `Commune absente de l'observatoire DVF (${property.city}). ` +
        'Les pages marché et comparables resteront vides tant que la commune ne sera pas importée.',
    )
  }

  const dvfType = property.propertyType.toLowerCase().includes('appartement') ? 'Appartement' : 'Maison'

  // La DVF est géolocalisée ; sans point d'origine le plan de situation reste
  // vide alors que toute l'information est là. On géocode donc l'adresse en
  // dernier recours.
  if (property.lat === null && property.lon === null && property.address) {
    const located = await geocodeAddress(property.address, property.city, property.postalCode)
    if (located) {
      property.lat = located.lat
      property.lon = located.lon
    }
  }

  const landBand = landSurfaceBand(property.landSurface)

  const [yearSeries, comparableRows, distributionRows] = await Promise.all([
    commune ? loadYearSeries(commune.insee_code, dvfType) : Promise.resolve([]),
    commune && property.livingSurface
      ? loadComparables(commune.insee_code, property.livingSurface, dvfType, landBand)
      : Promise.resolve([]),
    commune ? loadDistribution(commune.insee_code, dvfType) : Promise.resolve([]),
  ])

  if (commune && property.livingSurface === null) {
    warnings.push('Surface habitable inconnue : la sélection des comparables n\'a pas pu être lancée.')
  }
  if (commune && comparableRows.length === 0 && property.livingSurface) {
    warnings.push(
      `Aucune vente DVF comparable sur les 4 dernières années avec les filtres retenus ` +
        `(surface ±22 %, terrain entre ${landBand.min} et ${landBand.max} m²). ` +
        'Élargir la tolérance ou la période avant de conclure.',
    )
  }
  if (commune && commune.housing_stock_houses === null) {
    warnings.push(
      `Parc de logements non renseigné pour ${commune.name} : la rotation du parc ne peut pas être calculée. ` +
        'Renseigner dvf_communes.housing_stock_houses (source INSEE) pour disposer de l\'indicateur de tension.',
    )
  }

  const comparables = buildComparables(comparableRows, yearSeries, property)
  const distributionPrices = distributionRows.map((row) => Number(row.prix_m2)).filter(Number.isFinite)

  // La segmentation se fait sur le segment comparable, pas sur la commune entière.
  // Segmenter tout le parc reviendrait à opposer des studios de village à des mas
  // sur plusieurs hectares : la rupture détectée n'aurait aucun sens pour ce bien.
  const segmentSample = distributionRows
    .filter((row) => withinBand(Number(row.surface), property.livingSurface, 0.35))
    .filter((row) => Number(row.terrain) >= landBand.min && Number(row.terrain) <= landBand.max)
    .map((row) => Number(row.prix_m2))
    .filter(Number.isFinite)

  const segments = detectSegments(segmentSample.length >= 8 ? segmentSample : comparables.map((c) => c.pricePerM2))

  const competition = commune
    ? await loadCompetition(commune.insee_code, opportunity.property_city, dvfType)
    : []

  const market = buildMarket({
    commune,
    cityName: opportunity.property_city ?? sellerProperty?.adresse ?? 'Commune',
    yearSeries,
    distributionPrices,
    segments,
    salesDelay: readSalesDelay(snapshot),
  })

  const valuation = buildValuation({
    opportunity,
    sellerProperty,
    snapshot,
    opinion: opinionRaw,
    property,
    comparables,
    competition,
    market,
  })

  market.matchedSegmentLabel = matchSegment(segments, valuation.retainedPricePerM2)

  if (valuation.retainedPrice === null) {
    warnings.push('Aucun prix retenu : renseigner la fourchette dans l\'avis professionnel avant remise.')
  }
  if (valuation.outstandingLoan === null) {
    warnings.push(
      'Capital restant dû non renseigné : il est laissé en blanc dans le rapport, avec renvoi au relevé annuel de prêt.',
    )
  }

  return {
    meta: {
      opportunityId: opportunity.id,
      generatedAt: new Date().toISOString(),
      visitedAt: opportunity.visit_at,
      version: numberValue(opinionRaw.version) ?? 1,
      flags: readFlags(opinionRaw.flags),
      warnings,
    },
    seller: {
      name: opportunity.seller_name,
      civility: textValue(opinionRaw.civility),
    },
    advisor: ADVISOR,
    property,
    market,
    comparables,
    competition,
    valuation,
    patrimonial: buildPatrimonial(snapshot, opinionRaw),
    opinion: buildOpinion(opinionRaw, valuation),
    energy: buildEnergy(property, snapshot),
  }
}

// ─── Chargements ──────────────────────────────────────────────────────────

type SellerPropertyRow = {
  adresse: string | null
  lat: number | null
  lon: number | null
  type_bien: string | null
  sous_type: string | null
  surface: number | null
  surface_terrain: number | null
  nb_pieces: number | null
  etat: string | null
  dpe: string | null
  annee_construction: number | null
  equipements: string[] | null
  prix_estime: number | null
}

async function loadSellerProperty(leadId: string): Promise<SellerPropertyRow | null> {
  const { data } = await supabaseAdmin
    .from('seller_properties')
    .select(
      'adresse, lat, lon, type_bien, sous_type, surface, surface_terrain, nb_pieces, etat, dpe, annee_construction, equipements, prix_estime',
    )
    .eq('lead_id', leadId)
    .eq('actif', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

type CommuneRow = {
  insee_code: string
  name: string
  housing_stock_houses: number | null
  housing_stock_flats: number | null
}

async function resolveCommune(zipcode: string | null, city: string | null): Promise<CommuneRow | null> {
  const columns = 'insee_code, name, housing_stock_houses, housing_stock_flats'

  if (zipcode) {
    const { data } = await supabaseAdmin
      .from('dvf_communes')
      .select(columns)
      .eq('zipcode', zipcode)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (data) return data as CommuneRow
  }

  if (city) {
    const { data } = await supabaseAdmin
      .from('dvf_communes')
      .select(columns)
      .ilike('name', city)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (data) return data as CommuneRow
  }

  return null
}

async function loadYearSeries(insee: string, propertyType: string): Promise<MarketYearData[]> {
  const { data, error } = await supabaseAdmin.rpc('dvf_serie_annuelle', {
    p_insee: insee,
    p_type: propertyType,
    p_years: 5,
  })
  if (error || !data) return []

  const rows = data
    .map((row) => ({
      year: Number(row.annee),
      salesCount: Number(row.ventes),
      medianPrice: row.prix_median === null ? null : Number(row.prix_median),
      medianPricePerM2: row.m2_median === null ? null : Number(row.m2_median),
      pricePerM2Change: null as number | null,
    }))
    .sort((a, b) => b.year - a.year)

  // La série est descendante : l'année précédente est l'entrée suivante.
  return rows.map((row, index) => ({
    ...row,
    pricePerM2Change: percentChange(row.medianPricePerM2, rows[index + 1]?.medianPricePerM2 ?? null),
  }))
}

type ComparableRow = {
  mutation_id: string
  mutation_date: string | null
  adresse: string | null
  surface: number
  pieces: number | null
  terrain: number | null
  prix: number
  prix_m2: number
  lat: number | null
  lon: number | null
}

async function loadComparables(
  insee: string,
  surface: number,
  propertyType: string,
  landBand: { min: number; max: number },
): Promise<ComparableRow[]> {
  const { data, error } = await supabaseAdmin.rpc('dvf_comparables', {
    p_insee: insee,
    p_surface: surface,
    p_type: propertyType,
    p_tolerance: 0.22,
    p_min_terrain: landBand.min,
    p_max_terrain: landBand.max,
    p_limit: 10,
  })
  if (error || !data) return []
  return data as ComparableRow[]
}

/**
 * Bande d'emprise foncière acceptable pour un comparable.
 *
 * Encadrement asymétrique et large : le terrain pèse sur le prix, mais moins
 * proportionnellement que la surface bâtie. Sans terrain connu, on retombe sur
 * le plafond du bâti de village, faute de mieux — et le rapport le dit.
 */
function landSurfaceBand(landSurface: number | null): { min: number; max: number } {
  if (landSurface === null || landSurface <= 0) return { min: 0, max: 350 }
  return { min: Math.round(landSurface * 0.4), max: Math.round(landSurface * 2.2) }
}

function withinBand(value: number, reference: number | null, tolerance: number): boolean {
  if (reference === null || !Number.isFinite(value)) return false
  return value >= reference * (1 - tolerance) && value <= reference * (1 + tolerance)
}

async function loadDistribution(insee: string, propertyType: string) {
  const { data, error } = await supabaseAdmin.rpc('dvf_distribution_m2', {
    p_insee: insee,
    p_type: propertyType,
  })
  if (error || !data) return []
  return data
}

async function loadCompetition(
  insee: string,
  city: string | null,
  propertyType: string,
): Promise<CompetitionListing[]> {
  let query = supabaseAdmin
    .from('market_properties')
    .select('id, title, city, surface, price, price_per_m2, published_at, first_seen_at, url, property_type')
    .eq('status', 'active')
    .order('price_per_m2', { ascending: true })
    .limit(12)

  query = insee ? query.eq('insee_code', insee) : query
  const { data } = await query

  const rows = data ?? []
  const fallback = rows.length === 0 && city
    ? (await supabaseAdmin
        .from('market_properties')
        .select('id, title, city, surface, price, price_per_m2, published_at, first_seen_at, url, property_type')
        .eq('status', 'active')
        .ilike('city', city)
        .limit(12)).data ?? []
    : []

  const now = Date.now()
  return [...rows, ...fallback]
    .filter((row) => !row.property_type || row.property_type.toLowerCase().includes(propertyType.toLowerCase()))
    .map((row) => {
      const since = row.published_at ?? row.first_seen_at
      return {
        id: row.id,
        title: row.title,
        city: row.city,
        surface: row.surface,
        price: row.price,
        pricePerM2: row.price_per_m2 ?? (row.price && row.surface ? Math.round(row.price / row.surface) : null),
        daysOnMarket: since ? Math.round((now - new Date(since).getTime()) / 86_400_000) : null,
        url: row.url,
      }
    })
}

// ─── Assemblage ───────────────────────────────────────────────────────────

type OpportunityRow = {
  id: string
  lead_id: string | null
  seller_name: string | null
  property_city: string | null
  property_zipcode: string | null
  property_type: string | null
  property_surface: number | null
  property_land_surface: number | null
  property_rooms: number | null
  estimated_price_min: number | null
  estimated_price_max: number | null
  visit_at: string | null
  property_snapshot: Json
  professional_opinion: Json
}

function buildProperty(
  opportunity: OpportunityRow,
  sellerProperty: SellerPropertyRow | null,
  snapshot: Record<string, Json | undefined>,
  warnings: string[],
): PropertyData {
  const livingSurface = sellerProperty?.surface ?? opportunity.property_surface ?? numberValue(snapshot.surface)
  if (livingSurface === null) warnings.push('Surface habitable manquante.')

  const equipment = sellerProperty?.equipements ?? stringList(snapshot.equipements)

  return {
    address: sellerProperty?.adresse ?? textValue(snapshot.adresse),
    city: opportunity.property_city ?? textValue(snapshot.commune) ?? 'Commune à confirmer',
    postalCode: opportunity.property_zipcode,
    lat: sellerProperty?.lat ?? numberValue(snapshot.lat),
    lon: sellerProperty?.lon ?? numberValue(snapshot.lon),
    propertyType: sellerProperty?.type_bien ?? opportunity.property_type ?? 'Maison',
    propertySubType: sellerProperty?.sous_type ?? textValue(snapshot.sous_type),
    livingSurface,
    landSurface:
      sellerProperty?.surface_terrain ?? opportunity.property_land_surface ?? numberValue(snapshot.surface_terrain),
    roomsCount: sellerProperty?.nb_pieces ?? opportunity.property_rooms ?? numberValue(snapshot.nb_pieces),
    bedroomsCount: numberValue(snapshot.bedrooms) ?? numberValue(snapshot.chambres),
    terraceSurface: numberValue(snapshot.terrace_m2),
    parkingCount: textValue(snapshot.parking),
    constructionYear: sellerProperty?.annee_construction ?? numberValue(snapshot.annee_construction),
    condition: sellerProperty?.etat ?? textValue(snapshot.etat),
    dpeRating: asRating(sellerProperty?.dpe ?? textValue(snapshot.dpe)),
    gesRating: asRating(textValue(snapshot.ges)),
    equipment,
    roomSurfaces: buildRoomSurfaces(snapshot.rooms),
    imageUrl: textValue(snapshot.hero_image_url) ?? textValue(snapshot.image_url),
  }
}

function buildRoomSurfaces(value: Json | undefined): RoomSurface[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry, index) => {
      const room = asRecord(entry)
      const name = textValue(room.name) ?? textValue(room.nom)
      const surface = numberValue(room.surface)
      if (!name || surface === null) return null
      return { name, surface, color: ROOM_COLORS[index % ROOM_COLORS.length] }
    })
    .filter((room): room is RoomSurface => room !== null)
}

function buildComparables(
  rows: ComparableRow[],
  yearSeries: MarketYearData[],
  property: PropertyData,
): ComparableProperty[] {
  const origin = property.lat !== null && property.lon !== null ? { lat: property.lat, lon: property.lon } : null

  return rows.map((row) => {
    const saleYear = row.mutation_date ? new Date(row.mutation_date).getFullYear() : null
    return {
      id: row.mutation_id,
      address: row.adresse,
      saleDate: row.mutation_date ?? '',
      surface: Number(row.surface),
      landSurface: row.terrain === null ? null : Number(row.terrain),
      roomsCount: row.pieces,
      price: Number(row.prix),
      pricePerM2: Number(row.prix_m2),
      lat: row.lat,
      lon: row.lon,
      distanceKm:
        origin && row.lat !== null && row.lon !== null
          ? haversineKm(origin, { lat: row.lat, lon: row.lon })
          : null,
      adjustedPricePerM2: saleYear ? adjustPricePerM2(Number(row.prix_m2), saleYear, yearSeries) : null,
    }
  })
}

function buildMarket(input: {
  commune: CommuneRow | null
  cityName: string
  yearSeries: MarketYearData[]
  distributionPrices: number[]
  segments: MarketData['segments']
  salesDelay: MarketData['salesDelay']
}): MarketData {
  const { commune, cityName, yearSeries, distributionPrices, segments, salesDelay } = input

  return {
    inseeCode: commune?.insee_code ?? null,
    cityName: commune?.name ?? cityName,
    yearSeries,
    totalSales5y: yearSeries.reduce((total, entry) => total + entry.salesCount, 0),
    medianPricePerM2: median(distributionPrices),
    distribution: buildDistribution(distributionPrices),
    segments,
    matchedSegmentLabel: null,
    tension: computeTension(yearSeries, commune?.housing_stock_houses ?? null),
    salesDelay,
  }
}

/** Le délai de vente n'existe pas dans la DVF : il n'apparaît que s'il a été saisi avec sa source. */
function readSalesDelay(snapshot: Record<string, Json | undefined>): MarketData['salesDelay'] {
  const raw = asRecord(snapshot.sales_delay)
  const fastQuartile = numberValue(raw.fast_quartile)
  const medianDelay = numberValue(raw.median)
  const slowQuartile = numberValue(raw.slow_quartile)
  const source = textValue(raw.source)
  if (medianDelay === null || !source) return null
  return {
    value: {
      fastQuartile: fastQuartile ?? medianDelay,
      median: medianDelay,
      slowQuartile: slowQuartile ?? medianDelay,
    },
    source,
  }
}

function buildValuation(input: {
  opportunity: OpportunityRow
  sellerProperty: SellerPropertyRow | null
  snapshot: Record<string, Json | undefined>
  opinion: Record<string, Json | undefined>
  property: PropertyData
  comparables: ComparableProperty[]
  competition: CompetitionListing[]
  market: MarketData
}): ValuationData {
  const { opportunity, sellerProperty, snapshot, opinion, property, comparables, competition, market } = input

  const retainedPrice =
    numberValue(opinion.retained_price) ??
    numberValue(opinion.price) ??
    numberValue(opinion.price_suggested) ??
    midpoint(opportunity.estimated_price_min, opportunity.estimated_price_max)

  const priceRange =
    readRange(opinion.price_range) ??
    pair(numberValue(opinion.price_low), numberValue(opinion.price_high)) ??
    pair(opportunity.estimated_price_min, opportunity.estimated_price_max)

  const retainedPricePerM2 =
    retainedPrice !== null && property.livingSurface ? Math.round(retainedPrice / property.livingSurface) : null

  // Les trois références du rapport, côte à côte et jamais fusionnées :
  // ce que l'algorithme calcule, ce que les vendeurs demandent, ce qui a été payé.
  const dvfMedian = median(
    comparables.map((comparable) => comparable.adjustedPricePerM2 ?? comparable.pricePerM2),
  )
  const listingsMedian = median(
    competition.map((listing) => listing.pricePerM2).filter((value): value is number => value !== null),
  )
  const enginePricePerM2 =
    sellerProperty?.prix_estime && property.livingSurface
      ? Math.round(sellerProperty.prix_estime / property.livingSurface)
      : null

  const references: ValuationReference[] = [
    {
      id: 'dvf',
      label: 'Ventes réellement signées (DVF)',
      shortLabel: 'Prix payés',
      pricePerM2: dvfMedian,
      price: dvfMedian && property.livingSurface ? Math.round(dvfMedian * property.livingSurface) : null,
      description:
        comparables.length > 0
          ? `Médiane de ${plural(comparables.length, 'vente comparable enregistrée', 'ventes comparables enregistrées')} à la DGFiP, réactualisée de la dérive du marché.`
          : 'Aucune vente comparable retenue : la référence opposable ne peut pas être établie en l’état.',
      isOpposable: true,
    },
    {
      id: 'listings',
      label: 'Biens actuellement en vente',
      shortLabel: 'Prix demandés',
      pricePerM2: listingsMedian,
      price: listingsMedian && property.livingSurface ? Math.round(listingsMedian * property.livingSurface) : null,
      description:
        competition.length > 0
          ? `Médiane de ${plural(competition.length, 'annonce concurrente relevée', 'annonces concurrentes relevées')} sur la commune. Ce sont des demandes, pas des transactions.`
          : 'Aucune annonce concurrente relevée sur la commune au moment de l’édition.',
      isOpposable: false,
    },
    {
      id: 'engine',
      label: 'Moteur d’estimation automatisé',
      shortLabel: 'Algorithme',
      pricePerM2: enginePricePerM2,
      price: sellerProperty?.prix_estime ?? null,
      description:
        enginePricePerM2 !== null
          ? 'Sortie brute du calcul automatique, avant analyse du bien et de son segment de marché.'
          : 'Aucune sortie de moteur d’estimation enregistrée pour ce bien.',
      isOpposable: false,
    },
  ]

  const feePercent = numberValue(opinion.fee_percent) ?? numberValue(snapshot.fee_percent) ?? DEFAULT_FEE_PERCENT
  const feeAmount = retainedPrice !== null ? Math.round((retainedPrice * feePercent) / 100) : null
  const outstandingLoan = numberValue(snapshot.outstanding_loan) ?? numberValue(opinion.outstanding_loan)

  return {
    retainedPrice,
    priceRange,
    retainedPricePerM2,
    references,
    feePercent,
    feeAmount,
    netProceeds: retainedPrice !== null && feeAmount !== null ? retainedPrice - feeAmount : null,
    outstandingLoan,
    strategy: {
      fastPrice: priceRange?.[0] ?? null,
      targetPrice: retainedPrice,
      highTestPrice: priceRange?.[1] ?? null,
    },
  }
}

function buildPatrimonial(
  snapshot: Record<string, Json | undefined>,
  opinion: Record<string, Json | undefined>,
): PatrimonialData {
  const status = textValue(snapshot.residence_status) ?? textValue(opinion.residence_status)
  const residenceStatus: PatrimonialData['residenceStatus'] =
    status === 'principale' || status === 'secondaire' || status === 'locative' ? status : 'inconnu'

  const capitalGainNote =
    residenceStatus === 'principale'
      ? 'Le bien étant votre résidence principale au jour de la vente, la plus-value est totalement exonérée, sans condition de durée de détention.'
      : residenceStatus === 'inconnu'
        ? 'Le régime de plus-value dépend de l’occupation du bien au jour de la vente. Résidence principale : exonération totale. Résidence secondaire : 19 % d’impôt sur le revenu et 17,2 % de prélèvements sociaux, après abattements pour durée de détention, avec surtaxe au-delà de certains seuils.'
        : 'Le bien n’étant pas votre résidence principale, la plus-value relève du régime de droit commun : 19 % d’impôt sur le revenu et 17,2 % de prélèvements sociaux, après abattements pour durée de détention, avec surtaxe au-delà de certains seuils.'

  return {
    residenceStatus,
    capitalGainNote,
    scenarios: [
      {
        title: 'Le produit de la vente sert d’apport',
        points: [
          'Le net vendeur devient un apport immédiatement mobilisable sur le prochain achat.',
          'Il se compare à un montant d’acquisition, pas à un revenu : les deux ne se ramènent pas à un chiffre unique.',
          'Le calendrier de vente conditionne directement la capacité de négociation à l’achat.',
        ],
      },
      {
        title: 'Le produit de la vente est placé',
        points: [
          'Le capital dégagé génère un revenu dont le rendement dépend du support retenu.',
          'La comparaison avec la conservation du bien doit intégrer charges, fiscalité et travaux à venir.',
          'Aucun rendement n’est projeté ici : l’arbitrage relève de votre conseil financier.',
        ],
      },
    ],
    vigilance: [
      'L’exonération de plus-value est liée à l’occupation effective du bien. Un déménagement suivi d’une mise en location la fait perdre.',
      'En cas de départ à l’étranger, un dispositif non-résident peut prendre le relais, sous conditions.',
      'Le capital restant dû sur votre prêt n’est pas connu du conseiller : il figure sur votre relevé annuel de prêt.',
    ],
  }
}

/**
 * Les trois champs éditoriaux.
 *
 * Lecture au format cible en priorité, puis repli sur `iad_report`, la structure
 * qu'alimentent le skill d'import et l'écran d'avis professionnel existants. Les
 * deux formats cohabiteront tant que les rapports déjà remis restent consultables.
 */
function buildOpinion(opinion: Record<string, Json | undefined>, valuation: ValuationData): ProfessionalOpinion {
  const report = asRecord(opinion.iad_report)
  const reportProperty = asRecord(report.property)
  const reportConclusion = asRecord(report.conclusion)

  return {
    presentation: textValue(opinion.presentation) ?? textValue(reportProperty.title) ?? textValue(opinion.summary) ?? '',
    strengths:
      stringList(opinion.strengths).length > 0 ? stringList(opinion.strengths) : stringList(reportProperty.strengths),
    objections:
      readObjections(opinion.objections).length > 0
        ? readObjections(opinion.objections)
        : readObjections(reportProperty.objections),
    conclusion: textValue(opinion.conclusion) ?? textValue(reportConclusion.text) ?? '',
    retainedPrice: valuation.retainedPrice,
    priceRange: valuation.priceRange,
    updatedAt: textValue(opinion.updated_at),
    updatedBy: textValue(opinion.updated_by),
  }
}

function readObjections(value: Json | undefined): ProfessionalOpinion['objections'] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const record = asRecord(entry)
      const objection = textValue(record.objection)
      const response = textValue(record.response) ?? textValue(record.reponse)
      return objection && response ? { objection, response } : null
    })
    .filter((entry): entry is { objection: string; response: string } => entry !== null)
}

function buildEnergy(property: PropertyData, snapshot: Record<string, Json | undefined>): EnergyData {
  const diagnosticDate = textValue(snapshot.dpe_date)
  return {
    dpeRating: property.dpeRating,
    dpeValue: numberValue(snapshot.dpe_value),
    gesRating: property.gesRating,
    gesValue: numberValue(snapshot.ges_value),
    diagnosticDate,
    // Jamais de classement projeté : la méthode de calcul laisse une marge
    // d'appréciation d'un diagnostiqueur à l'autre, et une promesse de saut de
    // classe est invérifiable.
    note: textValue(snapshot.dpe_note),
  }
}

// ─── Utilitaires ──────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {}
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => textValue(entry)).filter((entry): entry is string => entry !== null)
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

function asRating(value: string | null): Rating | null {
  if (!value) return null
  const upper = value.trim().toUpperCase()
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(upper) ? (upper as Rating) : null
}

function midpoint(min: number | null, max: number | null): number | null {
  if (min === null && max === null) return null
  if (min === null) return max
  if (max === null) return min
  return Math.round((min + max) / 2)
}

const KNOWN_FLAGS: AvisFlag[] = ['hesite_location', 'depart_sans_rachat', 'investisseur', 'succession']

/** Les drapeaux inconnus sont ignorés : une faute de frappe ne doit pas activer une page. */
function readFlags(value: Json | undefined): AvisFlag[] {
  return stringList(value).filter((flag): flag is AvisFlag => (KNOWN_FLAGS as string[]).includes(flag))
}

function plural(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

function pair(low: number | null, high: number | null): [number, number] | null {
  return low !== null && high !== null ? [low, high] : null
}

function readRange(value: Json | undefined): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const low = numberValue(value[0])
  const high = numberValue(value[1])
  return low !== null && high !== null ? [low, high] : null
}

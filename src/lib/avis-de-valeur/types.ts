/**
 * Type racine de l'avis de valeur.
 *
 * Un seul objet, construit côté serveur par `buildAvisDeValeur()`, passé aux
 * composants de page. Aucune page du rapport n'importe de données : tout ce qui
 * s'affiche transite par ici, ce qui rend le document auditable et testable.
 */

export type Rating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

/** Valeur dont on connaît la provenance — chaque chiffre du rapport doit pouvoir se justifier. */
export type SourcedValue<T> = {
  value: T
  /** Ce qui permet de défendre le chiffre devant le vendeur. */
  source: string
}

export interface AdvisorData {
  name: string
  title: string
  phone: string
  email: string
  sector: string
  rsac: string
  miniSite: string
  instagram: string
  digitalCard: string
  photoUrl: string | null
}

export interface RoomSurface {
  name: string
  surface: number
  color: string
}

export interface PropertyData {
  address: string | null
  city: string
  postalCode: string | null
  lat: number | null
  lon: number | null
  propertyType: string
  propertySubType: string | null
  livingSurface: number | null
  landSurface: number | null
  roomsCount: number | null
  bedroomsCount: number | null
  terraceSurface: number | null
  parkingCount: string | null
  constructionYear: number | null
  condition: string | null
  dpeRating: Rating | null
  gesRating: Rating | null
  equipment: string[]
  roomSurfaces: RoomSurface[]
  imageUrl: string | null
}

export interface MarketYearData {
  year: number
  salesCount: number
  medianPrice: number | null
  medianPricePerM2: number | null
  /** Variation du prix médian au m² par rapport à l'année précédente, en %. */
  pricePerM2Change: number | null
}

export interface PriceDistributionBin {
  rangeLabel: string
  lowerBound: number
  upperBound: number
  count: number
  percentage: number
}

/**
 * Bloc de marché issu de la segmentation.
 *
 * Sur les petites surfaces le marché est presque toujours bimodal : appliquer
 * une médiane communale globale place le bien là où, précisément, rien ne se
 * vend. On identifie donc les blocs avant de médianiser.
 */
export interface MarketSegment {
  label: string
  description: string
  lowPricePerM2: number
  highPricePerM2: number
  medianPricePerM2: number
  count: number
}

export interface MarketTension {
  /** Part du parc de maisons vendue chaque année, en %. */
  rotationByYear: Array<{ year: number; rotation: number | null }>
  housingStock: number | null
  volumeChange1y: number | null
  pricePerM2Change1y: number | null
  /** Lecture commerciale de la rotation, calculée puis figée dans le rapport. */
  reading: string | null
}

export interface MarketData {
  inseeCode: string | null
  cityName: string
  yearSeries: MarketYearData[]
  totalSales5y: number
  medianPricePerM2: number | null
  distribution: PriceDistributionBin[]
  segments: MarketSegment[]
  /** Le bloc auquel appartient le bien estimé, s'il a pu être déterminé. */
  matchedSegmentLabel: string | null
  tension: MarketTension
  /**
   * Absent de la DVF : saisi à la main, avec sa source. Ne jamais présenter
   * un délai de vente comme dérivé des données DVF.
   */
  salesDelay: SourcedValue<{ fastQuartile: number; median: number; slowQuartile: number }> | null
}

export interface ComparableProperty {
  id: string
  address: string | null
  saleDate: string
  surface: number
  landSurface: number | null
  roomsCount: number | null
  price: number
  pricePerM2: number
  lat: number | null
  lon: number | null
  distanceKm: number | null
  /** Correction appliquée pour ramener une vente ancienne au marché d'aujourd'hui. */
  adjustedPricePerM2: number | null
}

/** Bien actuellement en vente : prix demandé, jamais mélangé aux prix payés. */
export interface CompetitionListing {
  id: string
  title: string | null
  city: string | null
  surface: number | null
  price: number | null
  pricePerM2: number | null
  /** Nombre de jours depuis la mise en ligne — un invendu de longue date est un signal, pas un comparable. */
  daysOnMarket: number | null
  url: string | null
}

export interface ValuationReference {
  id: 'dvf' | 'listings' | 'engine'
  label: string
  shortLabel: string
  pricePerM2: number | null
  price: number | null
  description: string
  /** Seule la DVF est opposable ; les deux autres servent à situer l'écart. */
  isOpposable: boolean
}

export interface ValuationData {
  retainedPrice: number | null
  priceRange: [number, number] | null
  retainedPricePerM2: number | null
  references: ValuationReference[]
  feePercent: number
  feeAmount: number | null
  netProceeds: number | null
  /** Jamais deviné : le capital restant dû figure sur le relevé annuel de prêt du vendeur. */
  outstandingLoan: number | null
  strategy: {
    fastPrice: number | null
    targetPrice: number | null
    highTestPrice: number | null
  }
}

export interface PatrimonialData {
  /** L'exonération est liée à l'occupation effective au jour de la vente. */
  residenceStatus: 'principale' | 'secondaire' | 'locative' | 'inconnu'
  capitalGainNote: string
  scenarios: Array<{ title: string; points: string[] }>
  vigilance: string[]
}

export interface ProfessionalOpinion {
  presentation: string
  strengths: string[]
  objections: Array<{ objection: string; response: string }>
  conclusion: string
  retainedPrice: number | null
  priceRange: [number, number] | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface EnergyData {
  dpeRating: Rating | null
  dpeValue: number | null
  gesRating: Rating | null
  gesValue: number | null
  diagnosticDate: string | null
  /** Constat, jamais projection : un classement projeté est une promesse invérifiable. */
  note: string | null
}

/**
 * Drapeaux de situation du vendeur.
 *
 * Ils commandent l'activation des pages optionnelles. La détection automatique
 * propose, le conseiller décide : ils sont surchargeables à la main dans
 * `opportunities.professional_opinion->'flags'`.
 */
export type AvisFlag = 'hesite_location' | 'depart_sans_rachat' | 'investisseur' | 'succession'

export interface AvisDeValeurMeta {
  opportunityId: string
  generatedAt: string
  visitedAt: string | null
  version: number
  flags: AvisFlag[]
  /** Renseigné quand des données obligatoires manquent — le rapport reste lisible, les trous sont nommés. */
  warnings: string[]
}

export interface AvisDeValeur {
  meta: AvisDeValeurMeta
  seller: { name: string | null; civility: string | null }
  advisor: AdvisorData
  property: PropertyData
  market: MarketData
  comparables: ComparableProperty[]
  competition: CompetitionListing[]
  valuation: ValuationData
  patrimonial: PatrimonialData
  opinion: ProfessionalOpinion
  energy: EnergyData
}

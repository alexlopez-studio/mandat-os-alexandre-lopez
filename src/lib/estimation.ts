import { fetchDvfMutations, median, type DvfMutation } from './dvf'

const COEF_ETAT: Record<string, number> = {
  neuf: 1.2, tres_bon_etat: 1.08, bon_etat: 1.0, rafraichir: 0.93, travaux: 0.82,
}
const COEF_DPE: Record<string, number> = {
  A: 1.06, B: 1.04, C: 1.02, D: 1.0, E: 0.98, F: 0.95, G: 0.9, NC: 1.0,
}
const ETAT_LABEL: Record<string, string> = {
  neuf: 'Neuf / récent', tres_bon_etat: 'Très bon état', bon_etat: 'Bon état',
  rafraichir: 'À rafraîchir', travaux: 'Travaux importants',
}
const EQUIPEMENT_COEF: Record<string, number> = {
  Piscine: 1.06, 'Vue exceptionnelle': 1.07, Jardin: 1.03, Garage: 1.02,
  Terrasse: 1.01, Balcon: 1.01, Cave: 1.005, Stationnement: 1.02, Cheminée: 1.005,
}
const EQUIPEMENT_LABEL: Record<string, string> = {
  Piscine: 'Piscine exploitable',
  Jardin: 'Jardin privatif exploitable',
  Garage: 'Garage fermé',
  Terrasse: 'Terrasse utilisable',
  Balcon: 'Balcon utilisable',
  Cave: 'Cave / stockage',
  Stationnement: 'Stationnement privatif',
  Cheminée: 'Cheminée fonctionnelle ou décorative',
  'Vue exceptionnelle': 'Vue remarquable déclarée (panorama dégagé, rareté à confirmer sur place)',
}

type ComparableStat = {
  prixM2: number
  count: number
  score: number
}

function coefEquipementsTotal(equipements: string[]): number {
  let c = 1.0
  for (const eq of equipements) {
    const v = EQUIPEMENT_COEF[eq]
    if (v) c *= v
  }
  return c
}

function coefDelai(delai: string): number {
  switch (delai) {
    case 'immediat': return 0.97
    case '1_3_mois': return 0.99
    case '6_mois': return 1.01
    default: return 1.0
  }
}

function coefAnneeConstruction(annee?: number): number {
  if (!annee || !Number.isFinite(annee)) return 1.0
  if (annee >= 2013) return 1.035
  if (annee >= 2006) return 1.02
  if (annee >= 1975) return 1.0
  if (annee >= 1948) return 0.98
  return 0.965
}

function constructionLabel(annee?: number): string | null {
  if (!annee || !Number.isFinite(annee)) return null
  if (annee >= 2013) return 'construction récente (' + annee + ')'
  if (annee >= 2006) return 'construction après 2006 (' + annee + ')'
  if (annee >= 1975) return 'construction après 1975 (' + annee + ')'
  if (annee >= 1948) return 'construction ancienne (' + annee + ')'
  return 'bâti ancien (' + annee + ')'
}

type MaisonProfile = {
  key: 'maison_village' | 'maison_compacte' | 'mitoyenne' | null
  label: string | null
  coef: number
}

function normalizeKey(value?: string): string {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_')
}

function resolveMaisonProfile(
  typeBien: string,
  sousType?: string,
  surfaceTerrain?: number | null,
  cadastreSurface?: number | null,
): MaisonProfile {
  if (typeBien !== 'maison') return { key: null, label: null, coef: 1.0 }

  const normalizedSousType = normalizeKey(sousType)
  const terrainRef = [cadastreSurface, surfaceTerrain]
    .find((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)

  if (['maison_village', 'maison_de_village', 'village'].includes(normalizedSousType)) {
    return { key: 'maison_village', label: 'Maison de village', coef: 0.56 }
  }

  if (terrainRef && terrainRef <= 120) {
    return {
      key: 'maison_village',
      label: 'Maison de village probable · parcelle très compacte (' + Math.round(terrainRef) + ' m²)',
      coef: 0.56,
    }
  }

  if (terrainRef && terrainRef <= 250) {
    return {
      key: 'maison_compacte',
      label: 'Maison de bourg / parcelle compacte (' + Math.round(terrainRef) + ' m²)',
      coef: 0.74,
    }
  }

  if (normalizedSousType === 'mitoyenne') {
    return { key: 'mitoyenne', label: 'Maison mitoyenne', coef: 0.88 }
  }

  return { key: null, label: null, coef: 1.0 }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function removeOutliers(items: Array<{ prixM2: number; weight: number }>) {
  if (items.length < 6) return items
  const prices = items.map((item) => item.prixM2).sort((a, b) => a - b)
  const q1 = percentile(prices, 0.25)
  const q3 = percentile(prices, 0.75)
  const iqr = q3 - q1
  if (iqr <= 0) return items
  const min = q1 - iqr * 1.35
  const max = q3 + iqr * 1.35
  const filtered = items.filter((item) => item.prixM2 >= min && item.prixM2 <= max)
  return filtered.length >= 2 ? filtered : items
}

function weightedMedian(items: Array<{ prixM2: number; weight: number }>): number {
  if (items.length === 0) return 0
  const sorted = [...items].sort((a, b) => a.prixM2 - b.prixM2)
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0)
  let acc = 0
  for (const item of sorted) {
    acc += item.weight
    if (acc >= totalWeight / 2) return item.prixM2
  }
  return sorted[sorted.length - 1].prixM2
}

function monthsSince(date: string): number | null {
  const t = new Date(date).getTime()
  if (!Number.isFinite(t)) return null
  const diff = Date.now() - t
  if (diff < 0) return 0
  return diff / (1000 * 60 * 60 * 24 * 30.44)
}

function scoreComparable(m: DvfMutation, surface: number, rayon: number): number {
  const surfaceDelta = Math.abs(m.surface_reelle_bati - surface) / Math.max(surface, 1)
  const surfaceScore = Math.max(0.15, 1 - Math.min(surfaceDelta, 0.75) / 0.75)

  const distance = typeof m.distance_m === 'number' ? m.distance_m : rayon * 0.55
  const distanceScore = Math.max(0.25, 1 - Math.min(distance, rayon) / Math.max(rayon, 1))

  const ageMonths = monthsSince(m.date_mutation)
  const recencyScore = ageMonths == null ? 0.75 : Math.max(0.45, 1 - Math.min(ageMonths, 36) / 36 * 0.55)

  return Math.max(0.1, surfaceScore * 0.6 + distanceScore * 0.25 + recencyScore * 0.15)
}

function computeComparableStat(mutations: DvfMutation[], surface: number, rayon: number): ComparableStat {
  const raw = mutations
    .filter((m) => m.surface_reelle_bati >= surface * 0.65 && m.surface_reelle_bati <= surface * 1.45 && m.valeur_fonciere > 0)
    .map((m) => ({
      prixM2: m.valeur_fonciere / m.surface_reelle_bati,
      weight: scoreComparable(m, surface, rayon),
    }))
    .filter((item) => item.prixM2 > 500 && item.prixM2 < 20000)

  const comparables = removeOutliers(raw)
  if (comparables.length === 0) return { prixM2: 0, count: 0, score: 0 }

  const plainMedian = median(comparables.map((item) => item.prixM2))
  const weighted = weightedMedian(comparables)
  const blended = plainMedian * 0.65 + weighted * 0.35
  const conservativePrice = Math.min(blended, plainMedian * 1.06)
  const score = Math.round((comparables.reduce((sum, item) => sum + item.weight, 0) / comparables.length) * 100)
  return {
    prixM2: conservativePrice,
    count: comparables.length,
    score,
  }
}

export interface EstimationInput {
  lat: number; lng: number; surface: number
  type_bien?: string; sous_type?: string; etat?: string; dpe?: string
  equipements?: string[]; delai?: string
  surface_terrain?: number | null
  cadastre_surface?: number | null
  annee_construction?: number
  dpe_verifie?: boolean
  numero_dpe?: string
}

export interface AjustementBreakdown {
  key: string
  label: string
  pct: number
  montant_eur: number
  sign: 'positive' | 'negative' | 'neutral'
}

export interface StrategiePrix {
  probabilite_vente_rapide_pct: number
  delai_estime: string
  frequence_visites: string
  negociation: string
}

export interface EstimationOutput {
  fourchette_basse: number
  fourchette_haute: number
  valeur_mediane: number
  prix_m2_median: number
  prix_m2_brut_dvf: number
  nb_transactions: number
  rayon_km: number
  source: 'dvf' | 'fallback'
  confiance: number
  score_comparables: number
  generated_at: string
  prix_de_base: number
  ajustements: AjustementBreakdown[]
  total_ajustement_pct: number
  total_ajustement_eur: number
  prix_calcule: number
  strategie: StrategiePrix
  points_forts: string[]
}

export async function calculerEstimation(input: EstimationInput): Promise<EstimationOutput> {
  const {
    lat, lng, surface, type_bien = 'maison', sous_type, etat = 'bon_etat',
    dpe = 'D', equipements = [], delai = '3_6_mois', surface_terrain, cadastre_surface,
    annee_construction, dpe_verifie = false, numero_dpe,
  } = input

  let mutations = await fetchDvfMutations(lat, lng, type_bien, 1500)
  let rayon = 1500
  if (mutations.length < 5) {
    mutations = await fetchDvfMutations(lat, lng, type_bien, 5000)
    rayon = 5000
  }

  const BASE_M2: Record<string, number> = { maison: 3200, appartement: 2800, terrain: 120, autre: 2500 }

  if (mutations.length < 3) {
    return build(surface, BASE_M2[type_bien] ?? 2800, type_bien, sous_type, etat, dpe, equipements, delai, 0, 'fallback', rayon, 0, surface_terrain, cadastre_surface, annee_construction, dpe_verifie, numero_dpe)
  }

  const comparableStat = computeComparableStat(mutations, surface, rayon)

  if (comparableStat.count < 2) {
    return build(surface, BASE_M2[type_bien] ?? 2800, type_bien, sous_type, etat, dpe, equipements, delai, 0, 'fallback', rayon, 0, surface_terrain, cadastre_surface, annee_construction, dpe_verifie, numero_dpe)
  }
  return build(surface, comparableStat.prixM2, type_bien, sous_type, etat, dpe, equipements, delai, comparableStat.count, 'dvf', rayon, comparableStat.score, surface_terrain, cadastre_surface, annee_construction, dpe_verifie, numero_dpe)
}

function computeAjustements(
  prixDeBase: number, typeBien: string, sousType: string | undefined, etat: string, dpe: string,
  equipements: string[], delai: string, surfaceTerrain?: number | null, cadastreSurface?: number | null,
  anneeConstruction?: number,
): AjustementBreakdown[] {
  const list: AjustementBreakdown[] = []
  const profile = resolveMaisonProfile(typeBien, sousType, surfaceTerrain, cadastreSurface)
  if (profile.key && profile.label && profile.coef !== 1.0) {
    const pct = profile.coef - 1
    list.push({
      key: profile.key,
      label: 'Typologie du bien (' + profile.label + ')',
      pct: Math.round(pct * 1000) / 10,
      montant_eur: Math.round(prixDeBase * pct),
      sign: pct > 0 ? 'positive' : 'negative',
    })
  }
  const ce = COEF_ETAT[etat] ?? 1.0
  if (ce !== 1.0) {
    const pct = ce - 1
    list.push({
      key: 'etat',
      label: 'État déclaré (' + (ETAT_LABEL[etat] ?? etat) + ')',
      pct: Math.round(pct * 1000) / 10,
      montant_eur: Math.round(prixDeBase * pct),
      sign: pct > 0 ? 'positive' : 'negative',
    })
  }
  const ca = coefAnneeConstruction(anneeConstruction)
  const caLabel = constructionLabel(anneeConstruction)
  if (ca !== 1.0 && caLabel) {
    const pct = ca - 1
    list.push({
      key: 'annee_construction',
      label: 'Âge du bâti (' + caLabel + ')',
      pct: Math.round(pct * 1000) / 10,
      montant_eur: Math.round(prixDeBase * pct),
      sign: pct > 0 ? 'positive' : 'negative',
    })
  }
  const cd = COEF_DPE[dpe] ?? 1.0
  if (cd !== 1.0 && dpe !== 'NC') {
    const pct = cd - 1
    list.push({
      key: 'dpe',
      label: 'Performance énergétique (DPE ' + dpe + ')',
      pct: Math.round(pct * 1000) / 10,
      montant_eur: Math.round(prixDeBase * pct),
      sign: pct > 0 ? 'positive' : 'negative',
    })
  }
  for (const eq of equipements ?? []) {
    const c = EQUIPEMENT_COEF[eq]
    if (c && c !== 1.0) {
      const pct = c - 1
      list.push({
        key: 'eq:' + eq,
        label: EQUIPEMENT_LABEL[eq] ?? eq,
        pct: Math.round(pct * 1000) / 10,
        montant_eur: Math.round(prixDeBase * pct),
        sign: pct > 0 ? 'positive' : 'negative',
      })
    }
  }
  const cdel = coefDelai(delai)
  if (cdel !== 1.0) {
    const pct = cdel - 1
    list.push({
      key: 'delai',
      label: 'Délai souhaité',
      pct: Math.round(pct * 1000) / 10,
      montant_eur: Math.round(prixDeBase * pct),
      sign: pct > 0 ? 'positive' : 'negative',
    })
  }
  return list
}

function computeStrategie(confiance: number, delai: string): StrategiePrix {
  let p = 50
  if (confiance >= 65) p = 60
  if (confiance >= 75) p = 70
  if (confiance >= 85) p = 80
  if (delai === 'immediat') p = Math.min(95, p + 12)
  else if (delai === '1_3_mois') p = Math.min(95, p + 5)
  else if (delai === '6_mois' || delai === 'pas_decide') p = Math.max(30, p - 10)
  let delai_estime = '2-3 mois'
  if (p >= 75) delai_estime = '1-2 mois'
  else if (p < 50) delai_estime = '3-6 mois'
  let frequence_visites = 'Régulières'
  if (p >= 75) frequence_visites = 'Soutenues'
  else if (p < 50) frequence_visites = 'Espacées'
  let negociation = 'Légère'
  if (p >= 75) negociation = 'Minimale'
  else if (p < 50) negociation = 'Importante'
  return { probabilite_vente_rapide_pct: p, delai_estime, frequence_visites, negociation }
}

function computePointsForts(equipements: string[], dpe: string, anneeConstruction?: number, dpeVerifie?: boolean, numeroDpe?: string): string[] {
  const arr: string[] = []
  const eq = equipements ?? []
  if (eq.includes('Balcon')) arr.push('Balcon disponible')
  if (eq.includes('Stationnement') || eq.includes('Garage')) arr.push('Stationnement inclus')
  if (eq.includes('Piscine')) arr.push('Piscine')
  if (eq.includes('Jardin')) arr.push('Jardin')
  if (eq.includes('Terrasse')) arr.push('Terrasse')
  if (eq.includes('Vue exceptionnelle')) arr.push('Vue remarquable à confirmer : panorama dégagé / absence de vis-à-vis direct')
  if (eq.includes('Cave')) arr.push('Cave')
  if (dpeVerifie) arr.push('DPE vérifié dans la base ADEME' + (numeroDpe ? ' (' + numeroDpe + ')' : ''))
  if (anneeConstruction && Number.isFinite(anneeConstruction)) arr.push('Année de construction documentée : ' + anneeConstruction)
  if (['A', 'B', 'C'].includes(dpe)) arr.push('Bonne performance énergétique')
  return arr
}

function computeConfidence(source: 'dvf' | 'fallback', nbTx: number, comparableScore: number): number {
  if (source === 'fallback') return 40

  let confiance = 55
  if (nbTx >= 20) confiance = 82
  else if (nbTx >= 10) confiance = 74
  else if (nbTx >= 5) confiance = 64

  if (comparableScore >= 82) confiance += 6
  else if (comparableScore >= 70) confiance += 3
  else if (comparableScore > 0 && comparableScore < 52) confiance -= 8

  return Math.max(35, Math.min(90, confiance))
}

function build(
  surface: number, prixM2Brut: number, typeBien: string, sousType: string | undefined,
  etat: string, dpe: string, equipements: string[], delai: string, nbTx: number,
  source: 'dvf' | 'fallback', rayon: number, comparableScore: number, surfaceTerrain?: number | null,
  cadastreSurface?: number | null, anneeConstruction?: number,
  dpeVerifie?: boolean, numeroDpe?: string,
): EstimationOutput {
  const profile = resolveMaisonProfile(typeBien, sousType, surfaceTerrain, cadastreSurface)
  const coef = profile.coef * (COEF_ETAT[etat] ?? 1.0) * coefAnneeConstruction(anneeConstruction) * (COEF_DPE[dpe] ?? 1.0) * coefEquipementsTotal(equipements) * coefDelai(delai)
  const prixM2 = prixM2Brut * coef
  const med = Math.round((prixM2 * surface) / 1000) * 1000
  let confiance = computeConfidence(source, nbTx, comparableScore)
  if (dpeVerifie) confiance = Math.min(95, confiance + 5)
  if (anneeConstruction && Number.isFinite(anneeConstruction)) confiance = Math.min(95, confiance + 3)
  if (profile.key && cadastreSurface && cadastreSurface > 0) confiance = Math.min(95, confiance + 4)
  const prix_de_base = Math.round(prixM2Brut * surface)
  const ajustements = computeAjustements(prix_de_base, typeBien, sousType, etat, dpe, equipements, delai, surfaceTerrain, cadastreSurface, anneeConstruction)
  const total_ajustement_eur = ajustements.reduce(function (s, a) { return s + a.montant_eur }, 0)
  const total_ajustement_pct = prix_de_base > 0
    ? Math.round((total_ajustement_eur / prix_de_base) * 1000) / 10
    : 0
  const prix_calcule = prix_de_base + total_ajustement_eur
  const strategie = computeStrategie(confiance, delai)
  const points_forts = computePointsForts(equipements, dpe, anneeConstruction, dpeVerifie, numeroDpe)
  return {
    fourchette_basse: Math.round((med * 0.93) / 1000) * 1000,
    fourchette_haute: Math.round((med * 1.07) / 1000) * 1000,
    valeur_mediane: med,
    prix_m2_median: Math.round(prixM2),
    prix_m2_brut_dvf: Math.round(prixM2Brut),
    nb_transactions: nbTx,
    rayon_km: rayon / 1000,
    source, confiance,
    score_comparables: comparableScore,
    generated_at: new Date().toISOString(),
    prix_de_base,
    ajustements,
    total_ajustement_pct,
    total_ajustement_eur,
    prix_calcule,
    strategie,
    points_forts,
  }
}

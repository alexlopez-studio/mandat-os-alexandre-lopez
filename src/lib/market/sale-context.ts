/**
 * Contexte de vente — les faits bruts qui decrivent un bien et sa vente.
 *
 * Module pur (aucune dependance serveur), donc importable des deux cotes : le
 * panneau de saisie calcule la liste des pieces dans le navigateur, la route
 * API la recalcule cote serveur, sans divergence possible.
 *
 * Principe directeur : on ne stocke QUE des faits, jamais leurs consequences.
 * Pas de `besoin_amiante: true` en base — c'est `deriveSaleFlags` qui le
 * deduit. Le jour ou un seuil legal change, on recalcule sans data migration.
 */

/** Version du format, pour faire evoluer la forme sans casser l'existant. */
export const SALE_CONTEXT_VERSION = 1

export const PROPERTY_TYPE_KEYS = ['maison', 'appartement', 'terrain', 'immeuble', 'autre'] as const
export type PropertyTypeKey = (typeof PROPERTY_TYPE_KEYS)[number]

export const SALE_SITUATIONS = [
  'succession',
  'indivision',
  'divorce',
  'sci',
  'vefa',
  'viager',
  'loue',
  'protection_juridique',
  'non_resident_fiscal',
  'residence_secondaire',
] as const
export type SaleSituation = (typeof SALE_SITUATIONS)[number]

export const EQUIPEMENTS = ['piscine', 'veranda', 'cheminee', 'panneaux_solaires'] as const
export type Equipement = (typeof EQUIPEMENTS)[number]

export const ZONES_RISQUE = ['termites', 'merule', 'bruit_aerien', 'argile', 'lotissement'] as const
export type ZoneRisque = (typeof ZONES_RISQUE)[number]

export const REGIMES = ['copropriete', 'monopropriete', 'inconnu'] as const
export type Regime = (typeof REGIMES)[number]

/**
 * Periode du PERMIS DE CONSTRUIRE, et non annee d'achevement : les seuils
 * amiante (1er juillet 1997) et plomb (1er janvier 1949) portent legalement sur
 * la date du permis. Nommer la bonne question evite l'erreur la plus courante.
 */
export const PERMIS_PERIODES = ['avant_1949', 'de_1949_a_1997', 'apres_1997', 'inconnu'] as const
export type PermisPeriode = (typeof PERMIS_PERIODES)[number]

export const DPE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'vierge', 'inconnu'] as const
export type DpeClasse = (typeof DPE_CLASSES)[number]

/**
 * Tri-etat plutot qu'une annee d'installation : un conseiller ne connait jamais
 * l'annee exacte, et c'est le diagnostic lui-meme qui l'etablit.
 * `plus_15_ans_ou_inconnu` fusionne les deux cas qui produisent la meme
 * consequence — le diagnostic est du.
 */
export const ETATS_ELECTRICITE = ['moins_15_ans', 'plus_15_ans_ou_inconnu', 'sans_objet'] as const
export type EtatElectricite = (typeof ETATS_ELECTRICITE)[number]

export const ETATS_GAZ = ['absent', 'moins_15_ans', 'plus_15_ans_ou_inconnu'] as const
export type EtatGaz = (typeof ETATS_GAZ)[number]

export const ASSAINISSEMENTS = ['collectif', 'non_collectif', 'inconnu'] as const
export type Assainissement = (typeof ASSAINISSEMENTS)[number]

export type SaleContext = {
  version: typeof SALE_CONTEXT_VERSION

  /** Axe 1 — pre-rempli depuis `projects.property_type`, confirmable ici. */
  property_type: PropertyTypeKey | null

  /** Axe 2 — le levier le plus discriminant du referentiel. */
  regime: Regime

  /** Axe 3 — cumulables : une succession peut aussi etre une indivision. */
  situations: SaleSituation[]

  /** Axe 4 — caracteristiques techniques. */
  permis_periode: PermisPeriode
  dpe_classe: DpeClasse
  electricite: EtatElectricite
  gaz: EtatGaz
  assainissement: Assainissement
  /** Travaux soumis a garantie decennale, acheves il y a moins de 10 ans. */
  travaux_recents: boolean
  equipements: Equipement[]
  zones: ZoneRisque[]

  /** Tracabilite — le contexte engage le conseiller qui l'a saisi. */
  updated_at: string | null
  updated_by: string | null
  note: string | null
}

/**
 * Contexte neutre. Les valeurs `inconnu` ne sont pas neutres pour autant : le
 * moteur les traite par prudence (un permis de periode inconnue appelle plomb
 * ET amiante). Sur-inclure coute un diagnostic, sous-inclure coute une vente.
 */
export const EMPTY_SALE_CONTEXT: SaleContext = {
  version: SALE_CONTEXT_VERSION,
  property_type: null,
  regime: 'inconnu',
  situations: [],
  permis_periode: 'inconnu',
  dpe_classe: 'inconnu',
  electricite: 'plus_15_ans_ou_inconnu',
  gaz: 'absent',
  assainissement: 'inconnu',
  travaux_recents: false,
  equipements: [],
  zones: [],
  updated_at: null,
  updated_by: null,
  note: null,
}

/** Vrai si le contexte n'a jamais ete renseigne (jsonb `{}` en base). */
export function isSaleContextEmpty(context: SaleContext): boolean {
  return context.updated_at === null && context.property_type === null && context.regime === 'inconnu'
}

export type ParseResult =
  | { ok: true; value: SaleContext }
  | { ok: false; error: string }

/**
 * Valide et normalise un contexte venant du reseau ou de la base.
 *
 * Il REJETTE les valeurs inconnues au lieu de les ignorer : le jsonb ne doit
 * jamais contenir ce que le moteur ne sait pas interpreter, sinon on retrouve
 * six mois plus tard du bruit indebuggable en base. Un champ absent, en
 * revanche, prend sa valeur par defaut — c'est ce qui rend un `{}` lisible.
 */
export function parseSaleContext(raw: unknown): ParseResult {
  if (raw === null || raw === undefined) return { ok: true, value: { ...EMPTY_SALE_CONTEXT } }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Contexte de vente invalide' }
  }

  const record = raw as Record<string, unknown>
  const value: SaleContext = { ...EMPTY_SALE_CONTEXT }

  // property_type accepte null explicite comme « pas encore qualifie ».
  if (record.property_type !== undefined && record.property_type !== null) {
    const parsed = pickOne(record.property_type, PROPERTY_TYPE_KEYS, 'type de bien')
    if (!parsed.ok) return parsed
    value.property_type = parsed.value
  }

  const scalars = [
    ['regime', REGIMES, 'régime'],
    ['permis_periode', PERMIS_PERIODES, 'période du permis'],
    ['dpe_classe', DPE_CLASSES, 'classe DPE'],
    ['electricite', ETATS_ELECTRICITE, 'état de l’électricité'],
    ['gaz', ETATS_GAZ, 'état du gaz'],
    ['assainissement', ASSAINISSEMENTS, 'assainissement'],
  ] as const

  for (const [field, allowed, label] of scalars) {
    if (record[field] === undefined) continue
    const parsed = pickOne(record[field], allowed, label)
    if (!parsed.ok) return parsed
    // Le tuple garantit l'accord entre le champ et son domaine.
    ;(value as Record<string, unknown>)[field] = parsed.value
  }

  const lists = [
    ['situations', SALE_SITUATIONS, 'situation de vente'],
    ['equipements', EQUIPEMENTS, 'équipement'],
    ['zones', ZONES_RISQUE, 'zone de risque'],
  ] as const

  for (const [field, allowed, label] of lists) {
    if (record[field] === undefined) continue
    const parsed = pickMany(record[field], allowed, label)
    if (!parsed.ok) return parsed
    ;(value as Record<string, unknown>)[field] = parsed.value
  }

  if (record.travaux_recents !== undefined) {
    if (typeof record.travaux_recents !== 'boolean') {
      return { ok: false, error: 'Le champ « travaux récents » doit être un booléen' }
    }
    value.travaux_recents = record.travaux_recents
  }

  if (typeof record.note === 'string' && record.note.trim()) value.note = record.note.trim()

  // `updated_at` / `updated_by` sont poses par le serveur, jamais repris du
  // client : c'est une trace, pas une donnee de formulaire.
  return { ok: true, value }
}

function pickOne<T extends readonly string[]>(
  raw: unknown,
  allowed: T,
  label: string
): { ok: true; value: T[number] } | { ok: false; error: string } {
  if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as T[number] }
  }
  return { ok: false, error: `Valeur inconnue pour « ${label} » : ${String(raw)}` }
}

function pickMany<T extends readonly string[]>(
  raw: unknown,
  allowed: T,
  label: string
): { ok: true; value: T[number][] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: `Le champ « ${label} » doit être une liste` }

  const seen = new Set<string>()
  for (const entry of raw) {
    if (typeof entry !== 'string' || !(allowed as readonly string[]).includes(entry)) {
      return { ok: false, error: `Valeur inconnue pour « ${label} » : ${String(entry)}` }
    }
    seen.add(entry)
  }

  // Ordre de declaration plutot qu'ordre de saisie : une liste qui danse d'un
  // affichage a l'autre est illisible.
  return { ok: true, value: allowed.filter((entry) => seen.has(entry)) as T[number][] }
}

/**
 * Aligne un `projects.property_type` libre (texte non contraint en base) sur
 * les cles du referentiel. Tolerant sur la casse et les accents, car la colonne
 * a ete alimentee par plusieurs sources (Stream Estate, import, saisie libre).
 */
export function normalizePropertyType(raw: unknown): PropertyTypeKey | null {
  if (typeof raw !== 'string') return null
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!slug) return null
  if (slug.startsWith('maison') || slug.includes('villa')) return 'maison'
  if (slug.startsWith('appartement') || slug === 'appart') return 'appartement'
  if (slug.startsWith('terrain')) return 'terrain'
  if (slug.startsWith('immeuble')) return 'immeuble'
  return (PROPERTY_TYPE_KEYS as readonly string[]).includes(slug) ? (slug as PropertyTypeKey) : 'autre'
}

import { Home, Search, type LucideIcon } from 'lucide-react'

/**
 * Modele "Projet" unifie (migration 036) : un projet est soit une vente, soit un achat.
 * Les libelles d'etapes different selon le sens, mais le pipeline est commun.
 */
export const PROJECT_KINDS = ['vente', 'achat'] as const

export type ProjectKind = (typeof PROJECT_KINDS)[number]

type ProjectKindMeta = {
  label: string
  /** Libelle long, utilise dans les filtres. */
  pluralLabel: string
  icon: LucideIcon
  /** Tone du composant `StatusPill` du design system. */
  tone: 'brand' | 'success'
}

export const PROJECT_KIND_META: Record<ProjectKind, ProjectKindMeta> = {
  vente: { label: 'Vente', pluralLabel: 'Ventes', icon: Home, tone: 'brand' },
  achat: { label: 'Achat', pluralLabel: 'Acquéreurs', icon: Search, tone: 'success' },
}

export function isProjectKind(value: unknown): value is ProjectKind {
  return typeof value === 'string' && (PROJECT_KINDS as readonly string[]).includes(value)
}

/** Ligne renvoyee par `GET /api/market/projects`. */
export type ProjectRow = {
  id: string
  kind: ProjectKind
  title: string
  stage: string
  priority: string
  next_action: string | null
  due_date: string | null
  property_city: string | null
  property_type: string | null
  budget_max: number | null
  estimated_price_min: number | null
  estimated_price_max: number | null
  seller_name: string | null
  communes: string[] | null
  lead_id: string | null
  active: boolean | null
  created_at: string
  updated_at: string
  contacts: Array<{
    id: string
    name: string
    last_name: string | null
    email: string | null
    phone: string | null
    role: string | null
  }>
  contact_name: string | null
  contact_id: string | null
  /** Titre normalise, calcule par `buildProjectTitle`. */
  display_title: string | null
}

/** Donnees minimales necessaires pour composer le titre normalise d'un projet. */
export type ProjectTitleParts = {
  /**
   * Noms de famille des contacts rattaches, dans l'ordre du projet.
   * Plusieurs entrees pour un couple non marie : "DUPONT / MARTIN".
   */
  contactLastNames?: Array<string | null | undefined>
  /** Repli quand aucun contact n'est rattache : on n'en garde que le dernier mot. */
  contactName?: string | null
  propertyType?: string | null
}

/** Au-dela, le titre devient illisible en tableau : on resume. */
const MAX_LAST_NAMES = 2

function titleCase(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed[0].toUpperCase() + trimmed.slice(1)
}

/** Ne garde que le patronyme : "Monsieur Jean Dupont" -> "DUPONT". */
function toSurname(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return (trimmed.split(/\s+/).pop() as string).toUpperCase()
}

/**
 * Nomenclature imposee des projets, vente comme achat :
 *
 *   "NOM - Type de bien"
 *   "NOM / AUTRENOM - Type de bien"   (co-vendeurs ou co-acquereurs)
 *
 * Seul le nom de famille apparait, en majuscules. La commune n'y figure pas :
 * elle a sa propre colonne dans le tableau. Les segments manquants sont omis.
 */
export function buildProjectTitle(parts: ProjectTitleParts): string | null {
  const surnames: string[] = []
  for (const raw of parts.contactLastNames ?? []) {
    const surname = raw?.trim() ? raw.trim().toUpperCase() : null
    if (surname && !surnames.includes(surname)) surnames.push(surname)
  }

  // Repli pour les projets encore sans fiche contact rattachee.
  if (surnames.length === 0) {
    const fallback = toSurname(parts.contactName)
    if (fallback) surnames.push(fallback)
  }

  let client: string | null = null
  if (surnames.length > 0) {
    const shown = surnames.slice(0, MAX_LAST_NAMES).join(' / ')
    const extra = surnames.length - MAX_LAST_NAMES
    client = extra > 0 ? `${shown} +${extra}` : shown
  }

  const propertyType = parts.propertyType?.trim() ? titleCase(parts.propertyType) : null

  const segments = [client, propertyType].filter(Boolean)
  return segments.length > 0 ? segments.join(' - ') : null
}

/**
 * Les deux sens d'un projet n'ont pas la meme page de detail :
 * la vente vit sous `/app/opportunities/[id]`, l'achat sous `/app/acheteurs/[lead_id]`.
 */
export function projectDetailHref(project: Pick<ProjectRow, 'id' | 'kind' | 'lead_id'>): string | null {
  if (project.kind === 'vente') return `/app/opportunities/${project.id}`
  const buyerId = project.lead_id || project.id
  return buyerId ? `/app/acheteurs/${buyerId}` : null
}

export type MacroStageId =
  | 'nouveau'
  | 'qualification'
  | 'action'
  | 'negociation'
  | 'mandat'
  | 'pause'
  | 'conclu'
  | 'perdu'

export type MacroStage = {
  id: MacroStageId
  label: string
  /** Pastille de couleur du kanban (legende des etapes). */
  color: string
  /** Tone du composant `StatusPill` du design system. */
  tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
}

export const MACRO_STAGES: MacroStage[] = [
  { id: 'nouveau', label: 'Nouveau', color: 'bg-foreground/40', tone: 'neutral' },
  { id: 'qualification', label: 'Qualification', color: 'bg-blue-500', tone: 'brand' },
  { id: 'action', label: 'Action', color: 'bg-amber-500', tone: 'warning' },
  { id: 'negociation', label: 'Négociation', color: 'bg-purple-500', tone: 'warning' },
  { id: 'mandat', label: 'Mandat / Offre', color: 'bg-emerald-600', tone: 'success' },
  { id: 'pause', label: 'Suivi / Pause', color: 'bg-foreground/20', tone: 'neutral' },
  { id: 'conclu', label: 'Conclu', color: 'bg-teal-600', tone: 'success' },
  { id: 'perdu', label: 'Perdu / Écarté', color: 'bg-red-600', tone: 'danger' },
]

export const STAGE_MAPPING: Record<MacroStageId, Record<ProjectKind, string>> = {
  nouveau: { vente: 'Nouveau contact', achat: 'Nouveau contact' },
  qualification: { vente: 'Pré-estimation', achat: 'Recherche qualifiée' },
  action: { vente: "Visite d'estimation", achat: 'Matching à faire' },
  negociation: { vente: "Remise de l'estimation", achat: 'Visites' },
  mandat: { vente: 'Mandat signé', achat: 'Mandat de recherche signé' },
  pause: { vente: 'Suivi moyen terme', achat: 'Pause / Perdu' },
  conclu: { vente: 'Vendu', achat: 'Achat conclu' },
  perdu: { vente: 'Perdu / Écarté', achat: 'Pause / Perdu' },
}

export function getMacroStage(dbStage: string, kind: ProjectKind): MacroStageId {
  if (kind === 'vente') {
    if (dbStage === 'Veille annonce') return 'nouveau'
    if (dbStage === 'Décision vendeur') return 'negociation'
  } else {
    if (dbStage === 'Biens proposés') return 'action'
    if (dbStage === 'Offre en cours') return 'negociation'
  }
  for (const [macro, mapping] of Object.entries(STAGE_MAPPING)) {
    if (mapping[kind] === dbStage) return macro as MacroStageId
  }
  return 'nouveau'
}

export function getMacroStageMeta(dbStage: string, kind: ProjectKind): MacroStage {
  const id = getMacroStage(dbStage, kind)
  return MACRO_STAGES.find((stage) => stage.id === id) ?? MACRO_STAGES[0]
}

/** Etapes qui sortent un projet du pipeline actif (mises en pause, perdues ou conclues). */
const INACTIVE_MACRO_STAGES: MacroStageId[] = ['pause', 'conclu', 'perdu']

export function isProjectActive(dbStage: string, kind: ProjectKind, active: boolean | null): boolean {
  if (active === false) return false
  return !INACTIVE_MACRO_STAGES.includes(getMacroStage(dbStage, kind))
}

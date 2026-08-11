import { Handshake, Home, Search, Users, type LucideIcon } from 'lucide-react'

/**
 * Typologies d'un contact de l'annuaire.
 * Un contact peut en cumuler plusieurs (un vendeur peut aussi etre acquereur).
 * `vendeur` et `acquereur` sont aussi deduits automatiquement des projets rattaches
 * (voir la vue SQL `contacts_directory`).
 */
export const CONTACT_TYPES = ['vendeur', 'acquereur', 'partenaire', 'reseau'] as const

export type ContactType = (typeof CONTACT_TYPES)[number]

type ContactTypeMeta = {
  label: string
  icon: LucideIcon
  /** Tone du composant `StatusPill` du design system. */
  tone: 'brand' | 'success' | 'warning' | 'neutral'
}

export const CONTACT_TYPE_META: Record<ContactType, ContactTypeMeta> = {
  vendeur: { label: 'Vendeur', icon: Home, tone: 'brand' },
  acquereur: { label: 'Acquéreur', icon: Search, tone: 'success' },
  partenaire: { label: 'Partenaire pro', icon: Handshake, tone: 'warning' },
  reseau: { label: 'Réseau', icon: Users, tone: 'neutral' },
}

export function isContactType(value: unknown): value is ContactType {
  return typeof value === 'string' && (CONTACT_TYPES as readonly string[]).includes(value)
}

/** Filtre et ordonne une liste brute de typologies selon l'ordre canonique. */
export function normalizeContactTypes(values: unknown): ContactType[] {
  if (!Array.isArray(values)) return []
  const set = new Set(values.filter(isContactType))
  return CONTACT_TYPES.filter((type) => set.has(type))
}

/**
 * Statuts de qualification (Cycle de vie) des contacts.
 */
export const CONTACT_STATUSES = ['prospect', 'qualified', 'client', 'inactive', 'archived'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export type ContactStatusMeta = {
  label: string
  tone: 'brand' | 'success' | 'warning' | 'neutral'
  className: string
}

export const CONTACT_STATUS_META: Record<ContactStatus, ContactStatusMeta> = {
  prospect: { label: 'Prospect brut', tone: 'neutral', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  qualified: { label: 'Qualifié', tone: 'brand', className: 'bg-primary/10 text-primary border-primary/20' },
  client: { label: 'Client actif', tone: 'success', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  inactive: { label: 'Inactif', tone: 'warning', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  archived: { label: 'Archivé', tone: 'neutral', className: 'bg-muted text-muted-foreground border-border' },
}

export function isContactStatus(value: unknown): value is ContactStatus {
  return typeof value === 'string' && (CONTACT_STATUSES as readonly string[]).includes(value)
}

export function getContactStatus(contact: {
  status?: string | null
  source?: string | null
  projects_count?: number | null
  types?: string[] | null
  all_types?: string[] | null
}): ContactStatus {
  if (contact.status && isContactStatus(contact.status)) {
    return contact.status
  }
  const types = contact.types || contact.all_types || []
  if (types.includes('archived')) return 'archived'
  if (types.includes('inactive')) return 'inactive'
  if (types.includes('prospect')) return 'prospect'
  if (types.includes('qualified')) return 'qualified'
  if (types.includes('client')) return 'client'

  if ((contact.projects_count ?? 0) > 0) return 'client'

  if (
    contact.source &&
    (contact.source.toLowerCase().includes('playiad') ||
      contact.source.toLowerCase().includes('email') ||
      contact.source.toLowerCase().includes('seloger'))
  ) {
    return 'prospect'
  }

  return 'qualified'
}


/**
 * Types TypeScript partagés — single-tenant
 */

export type LeadType = 'vendre' | 'acheter' | 'audit'
export type TypeBien = 'appartement' | 'maison' | 'terrain' | 'autre'
export type EtatGeneral = 'a_renover' | 'bon_etat' | 'tres_bon_etat' | 'neuf'
export type DPE = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'NC'
export type DelaiVente = 'urgent' | '3_6_mois' | '6_mois_plus'

export interface Lead {
  id: string
  type: LeadType
  prenom: string | null
  nom: string | null
  email: string
  telephone: string | null
  form_data: Record<string, unknown> | null
  results: EstimationResult | AuditResult | null
  token: string
  attio_record_id: string | null
  opt_in: boolean
  opt_in_date: string | null
  created_at: string
  updated_at: string
}

export interface EstimationResult {
  fourchette_basse: number
  fourchette_haute: number
  valeur_mediane: number
  prix_m2_median: number
  prix_m2_brut_dvf?: number
  nb_transactions: number
  rayon_km: number
  source: 'dvf' | 'fallback'
  confiance: number
  generated_at: string
}

export interface AuditResult {
  score_global: number
  score_structure: number
  score_energie: number
  score_confort: number
  points_forts: string[]
  points_attention: string[]
  recommandations: string[]
  budget_travaux_estime?: { min: number; max: number }
  generated_at: string
}

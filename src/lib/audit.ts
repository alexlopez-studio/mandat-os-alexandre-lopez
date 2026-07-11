const SCORE_ETAT: Record<string, number> = { bon: 25, moyen: 15, mauvais: 5, nc: 15 }
const SCORE_ISO: Record<string, number> = { bonne: 25, partielle: 15, absente: 5, nc: 15 }
const SCORE_DPE: Record<string, number> = { A: 100, B: 85, C: 70, D: 55, E: 40, F: 25, G: 10, NC: 50 }

export interface AuditInput {
  etat_toiture?: string; etat_facade?: string; etat_menuiseries?: string
  etat_plomberie?: string; etat_electricite?: string; humidite?: boolean
  isolation_murs?: string; isolation_combles?: string; isolation_fenetres?: string
  type_chauffage?: string; age_chauffage?: number; dpe?: string; objectif?: string
}

export interface AuditOutput {
  score_global: number; score_structure: number; score_energie: number; score_confort: number
  points_forts: string[]; points_attention: string[]; recommandations: string[]
  budget_travaux_estime?: { min: number; max: number }; generated_at: string
}

export function calculerAudit(input: AuditInput): AuditOutput {
  let sS = 0
  sS += SCORE_ETAT[input.etat_toiture ?? 'nc'] ?? 15
  sS += SCORE_ETAT[input.etat_facade ?? 'nc'] ?? 15
  sS += SCORE_ETAT[input.etat_menuiseries ?? 'nc'] ?? 15
  sS += SCORE_ETAT[input.etat_plomberie ?? 'nc'] ?? 15
  sS += SCORE_ETAT[input.etat_electricite ?? 'nc'] ?? 15
  if (input.humidite) sS -= 15
  const score_structure = Math.max(0, Math.min(100, Math.round((sS / 125) * 100)))

  let sE = 0
  sE += SCORE_ISO[input.isolation_murs ?? 'nc'] ?? 15
  sE += SCORE_ISO[input.isolation_combles ?? 'nc'] ?? 15
  sE += input.isolation_fenetres === 'double_vitrage' ? 25 : input.isolation_fenetres === 'simple_vitrage' ? 5 : 15
  sE += Math.round((SCORE_DPE[input.dpe ?? 'NC'] ?? 50) * 0.35)
  const score_energie = Math.max(0, Math.min(100, Math.round((sE / 80) * 100)))

  let score_confort = 60
  if (input.age_chauffage && input.age_chauffage > 15) score_confort -= 15
  if (input.type_chauffage === 'pac') score_confort += 20
  if (input.type_chauffage === 'fioul') score_confort -= 10
  score_confort = Math.max(0, Math.min(100, score_confort))

  const score_global = Math.round(score_structure * 0.5 + score_energie * 0.35 + score_confort * 0.15)

  const points_forts: string[] = []
  const points_attention: string[] = []
  const recommandations: string[] = []
  let bMin = 0, bMax = 0

  if (input.etat_toiture === 'bon') points_forts.push('Toiture en bon état')
  if (input.etat_toiture === 'mauvais') { points_attention.push('Toiture à rénover'); recommandations.push('Prévoir une toiture neuve (15 000–35 000 €)'); bMin += 15000; bMax += 35000 }
  if (input.isolation_murs === 'bonne') points_forts.push('Isolation des murs performante')
  if (input.isolation_murs === 'absente') { points_attention.push('Absence d\'isolation des murs'); recommandations.push('Isolation thermique (5 000–20 000 €)'); bMin += 5000; bMax += 20000 }
  if (input.dpe === 'A' || input.dpe === 'B') points_forts.push(`DPE ${input.dpe} — excellent bilan énergétique`)
  if (input.dpe === 'F' || input.dpe === 'G') { points_attention.push(`DPE ${input.dpe} — passoire thermique`); recommandations.push('Rénovation énergétique complète recommandée') }
  if (input.humidite) { points_attention.push('Humidité détectée'); recommandations.push('Traitement humidité prioritaire (1 000–10 000 €)'); bMin += 1000; bMax += 10000 }
  if (input.etat_plomberie === 'mauvais') { points_attention.push('Plomberie vétuste'); recommandations.push('Remise à niveau plomberie (3 000–15 000 €)'); bMin += 3000; bMax += 15000 }
  if (input.etat_electricite === 'mauvais') { points_attention.push('Installation électrique à mettre aux normes'); recommandations.push('Mise aux normes électriques (3 000–12 000 €)'); bMin += 3000; bMax += 12000 }

  return {
    score_global, score_structure, score_energie, score_confort,
    points_forts, points_attention, recommandations,
    ...(bMin > 0 ? { budget_travaux_estime: { min: bMin, max: bMax } } : {}),
    generated_at: new Date().toISOString(),
  }
}

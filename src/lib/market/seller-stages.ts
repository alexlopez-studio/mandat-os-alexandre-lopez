/**
 * Stades du pipeline vendeur — module pur (aucune dépendance serveur), donc
 * importable côté client ET serveur.
 */

export const WATCH_LISTING_STAGE = 'Veille annonce'
export const NEW_CONTACT_STAGE = 'Nouveau contact'
export const ESTIMATION_VISIT_STAGE = "Visite d'estimation"
export const ESTIMATION_DELIVERED_STAGE = "Remise de l'estimation"
export const SIGNED_MANDATE_STAGE = 'Mandat signé'
export const MARKETING_VISITS_STAGE = 'Commercialisation & Visites'
export const PROMISE_SIGNED_STAGE = 'Compromis signé'
export const SOLD_STAGE = 'Vendu'
export const LOST_STAGE = 'Perdu / Écarté'

/** Stade à partir duquel le suivi client peut être créé. */
export const PORTAL_OPENING_STAGE = ESTIMATION_DELIVERED_STAGE

/** Ordre du parcours vendeur linéaire métier (7 étapes clés hors état terminal « perdu »). */
export const SELLER_STAGE_ORDER = [
  NEW_CONTACT_STAGE,
  ESTIMATION_VISIT_STAGE,
  ESTIMATION_DELIVERED_STAGE,
  SIGNED_MANDATE_STAGE,
  MARKETING_VISITS_STAGE,
  PROMISE_SIGNED_STAGE,
  SOLD_STAGE,
  LOST_STAGE,
] as const

/** Parcours lineaire sans l'etat terminal, seul ordre qui ait un sens. */
const LINEAR_STAGE_ORDER = SELLER_STAGE_ORDER.filter((stage) => stage !== LOST_STAGE)

/** Vrai si `stage` est au moins aussi avance que `floor` dans le parcours. */
export function isStageAtLeast(stage: string | null | undefined, floor: string): boolean {
  if (!stage || stage === LOST_STAGE) return false
  const index = LINEAR_STAGE_ORDER.indexOf(stage as (typeof LINEAR_STAGE_ORDER)[number])
  return index >= 0 && index >= LINEAR_STAGE_ORDER.indexOf(floor as (typeof LINEAR_STAGE_ORDER)[number])
}

/**
 * Le suivi client peut être créé à partir de la remise de l'estimation
 * (pour présenter le rapport au vendeur) et jusqu'à la vente — jamais depuis
 * l'état terminal « Perdu / Écarté ».
 */
export function isPortalEligibleStage(stage: string | null | undefined): boolean {
  return isStageAtLeast(stage, PORTAL_OPENING_STAGE)
}

/**
 * Le suivi de vente (étapes, visites, offres, documents) s'ouvre à la signature
 * du mandat et ne se referme plus jusqu'à la vente.
 *
 * Il était auparavant conditionné à la liste littérale `Mandat signé | Vendu`,
 * qui laissait de côté `Commercialisation & Visites` et `Compromis signé` : le
 * vendeur perdait l'accès à son suivi pendant toute la commercialisation, puis
 * le retrouvait à la vente. On raisonne donc sur l'ordre du parcours.
 */
export function isSalesFollowUpStage(stage: string | null | undefined): boolean {
  return isStageAtLeast(stage, SIGNED_MANDATE_STAGE)
}

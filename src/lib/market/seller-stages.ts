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

/**
 * Le suivi client peut être créé à partir de la remise de l'estimation
 * (pour présenter le rapport au vendeur) et jusqu'à la vente — jamais depuis
 * l'état terminal « Perdu / Écarté ».
 */
export function isPortalEligibleStage(stage: string | null | undefined): boolean {
  if (!stage || stage === LOST_STAGE) return false
  const order = SELLER_STAGE_ORDER.filter((s) => s !== LOST_STAGE)
  const index = order.indexOf(stage as (typeof order)[number])
  return index >= 0 && index >= order.indexOf(PORTAL_OPENING_STAGE as (typeof order)[number])
}

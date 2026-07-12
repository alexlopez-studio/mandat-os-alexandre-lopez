/**
 * Stades du pipeline vendeur — module pur (aucune dépendance serveur), donc
 * importable côté client ET serveur.
 */

export const WATCH_LISTING_STAGE = 'Veille annonce'
export const NEW_CONTACT_STAGE = 'Nouveau contact'
export const ESTIMATION_VISIT_STAGE = "Visite d'estimation"
export const ESTIMATION_DELIVERED_STAGE = "Remise de l'estimation"
export const SIGNED_MANDATE_STAGE = 'Mandat signé'
export const LOST_STAGE = 'Perdu / Écarté'

/** Stade à partir duquel le portail client peut être ouvert. */
export const PORTAL_OPENING_STAGE = ESTIMATION_DELIVERED_STAGE

/** Ordre du parcours vendeur, de la veille au bien vendu (hors état terminal « perdu »). */
export const SELLER_STAGE_ORDER = [
  WATCH_LISTING_STAGE,
  NEW_CONTACT_STAGE,
  'Pré-estimation',
  "Visite d'estimation",
  ESTIMATION_DELIVERED_STAGE,
  'Décision vendeur',
  'Suivi moyen terme',
  SIGNED_MANDATE_STAGE,
  'Vendu',
  LOST_STAGE,
] as const

/**
 * Le portail client peut être ouvert à partir de la remise de l'estimation
 * (pour présenter le rapport au vendeur) et jusqu'à la vente — jamais depuis
 * l'état terminal « Perdu / Écarté ».
 */
export function isPortalEligibleStage(stage: string | null | undefined): boolean {
  if (!stage || stage === LOST_STAGE) return false
  const order = SELLER_STAGE_ORDER.filter((s) => s !== LOST_STAGE)
  const index = order.indexOf(stage as (typeof order)[number])
  return index >= 0 && index >= order.indexOf(PORTAL_OPENING_STAGE)
}

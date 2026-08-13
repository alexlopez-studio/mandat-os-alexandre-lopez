/**
 * Socle de jalons montre au vendeur dans l'espace client — module pur, donc
 * importable cote serveur comme cote client.
 *
 * Ces jalons sont une *projection* du pipeline vendeur, pas une seconde liste a
 * tenir a jour : ils se deduisent du stade du projet, de la date de signature du
 * mandat et de la publication de l'estimation.
 *
 * Ne figurent ici que des evenements **irreversibles et ordonnes**. Les visites
 * et les offres en sont volontairement absentes : elles courent tout au long de
 * la commercialisation, une offre peut tomber puis une autre arriver, et un
 * stepper ne sait pas revenir en arriere. Elles relevent de l'activite, que le
 * portail presente deja dans ses sections dediees.
 */

import {
  MARKETING_VISITS_STAGE,
  PROMISE_SIGNED_STAGE,
  SIGNED_MANDATE_STAGE,
  SOLD_STAGE,
  isStageAtLeast,
} from './seller-stages'

export const SELLER_MILESTONE_KEYS = [
  'estimation',
  'mandat',
  'annonce',
  'compromis',
  'acte',
] as const

export type SellerMilestoneKey = (typeof SELLER_MILESTONE_KEYS)[number]

export type SellerMilestoneStatus = 'todo' | 'in_progress' | 'done'

/** Qui porte le jalon. Le portail traduit en « Conseiller / Vendeur / Tous ». */
export type SellerMilestoneResponsible = 'advisor' | 'both'

export type SellerMilestone = {
  key: SellerMilestoneKey
  order: number
  title: string
  description: string
  status: SellerMilestoneStatus
  /** Date de franchissement quand la base la connait, sinon `null`. */
  completed_at: string | null
  responsible: SellerMilestoneResponsible
}

export type SellerMilestoneInput = {
  /** Stade du projet de vente (`projects.stage`). */
  stage: string | null | undefined
  /** `client_dossiers.mandate_signed_at`, seule date fiable du mandat. */
  mandateSignedAt: string | null | undefined
  /** L'avis de valeur est-il publie au vendeur ? */
  estimationPublished: boolean
  /** Date de publication de l'estimation, si connue. */
  estimationPublishedAt: string | null | undefined
}

type MilestoneDefinition = {
  key: SellerMilestoneKey
  title: string
  description: string
  responsible: SellerMilestoneResponsible
  isReached: (input: SellerMilestoneInput) => boolean
  completedAt: (input: SellerMilestoneInput) => string | null
}

/**
 * Les libelles sont ceux que le vendeur comprend, pas les stades internes :
 * « Annonce en ligne » plutot que « Commercialisation & Visites ».
 */
const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  {
    key: 'estimation',
    title: 'Estimation remise',
    description: "L'avis de valeur de votre bien vous a été présenté.",
    responsible: 'advisor',
    isReached: (input) => input.estimationPublished,
    completedAt: (input) => input.estimationPublishedAt ?? null,
  },
  {
    key: 'mandat',
    title: 'Mandat signé',
    description: 'Le mandat de vente est signé : la commercialisation peut commencer.',
    responsible: 'both',
    isReached: (input) => isStageAtLeast(input.stage, SIGNED_MANDATE_STAGE),
    completedAt: (input) => input.mandateSignedAt ?? null,
  },
  {
    key: 'annonce',
    title: 'Annonce en ligne',
    description: 'Votre bien est diffusé et les visites peuvent être organisées.',
    responsible: 'advisor',
    isReached: (input) => isStageAtLeast(input.stage, MARKETING_VISITS_STAGE),
    completedAt: () => null,
  },
  {
    key: 'compromis',
    title: 'Compromis signé',
    description: "L'acquéreur est engagé, le délai de rétractation court.",
    responsible: 'both',
    isReached: (input) => isStageAtLeast(input.stage, PROMISE_SIGNED_STAGE),
    completedAt: () => null,
  },
  {
    key: 'acte',
    title: 'Acte authentique',
    description: 'La vente est signée chez le notaire, les clés sont remises.',
    responsible: 'both',
    isReached: (input) => isStageAtLeast(input.stage, SOLD_STAGE),
    completedAt: () => null,
  },
]

/**
 * Compose les cinq jalons.
 *
 * Chaque jalon est evalue independamment plutot que par rang : un mandat signe
 * alors que l'estimation n'a jamais ete publiee au client est un cas reel, et
 * decaler tout le reste serait faux.
 *
 * Le jalon « en cours » est le premier non franchi **apres le dernier franchi**,
 * et non le premier non franchi tout court. Sans cette nuance, un dossier au
 * compromis affichait « Estimation remise — en cours » devant trois jalons
 * termines : un jalon saute n'est pas le jalon courant, il reste a faire.
 */
export function buildSellerMilestones(input: SellerMilestoneInput): SellerMilestone[] {
  const reachedFlags = MILESTONE_DEFINITIONS.map((definition) => definition.isReached(input))
  const lastReachedIndex = reachedFlags.lastIndexOf(true)
  const currentIndex = reachedFlags.findIndex((reached, index) => !reached && index > lastReachedIndex)

  return MILESTONE_DEFINITIONS.map((definition, index) => {
    const reached = reachedFlags[index]

    let status: SellerMilestoneStatus
    if (reached) {
      status = 'done'
    } else if (index === currentIndex) {
      status = 'in_progress'
    } else {
      status = 'todo'
    }

    return {
      key: definition.key,
      order: index + 1,
      title: definition.title,
      description: definition.description,
      status,
      completed_at: reached ? definition.completedAt(input) : null,
      responsible: definition.responsible,
    }
  })
}

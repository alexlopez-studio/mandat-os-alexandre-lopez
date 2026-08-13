/**
 * Actions de preparation du mandat — module pur, importable des deux cotes.
 *
 * A distinguer du statut du projet (`seller-milestones`) : le statut est
 * lineaire et irreversible, les actions sont **paralleles**. Un DPE et un
 * shooting photo ne se font pas dans un ordre impose, ne se font pas toujours au
 * meme moment, et n'avancent pas le dossier d'un cran — elles le rendent
 * commercialisable.
 */

export type SellerActionResponsible = 'advisor' | 'seller'

export type SellerActionTemplate = {
  /** Cle stable, rangee dans `payload.action_key` pour retrouver l'origine. */
  key: string
  title: string
  description: string
  responsible: SellerActionResponsible
}

/**
 * Gabarit propose a l'ouverture du dossier, a elaguer au cas par cas : tous les
 * biens n'appellent pas les memes diagnostics, et un appartement vide n'a pas
 * besoin de home staging.
 *
 * Toutes sont visibles du vendeur : voir que le conseiller travaille en
 * parallele de ce qu'on lui demande rassure autant que la liste de ses propres
 * obligations.
 */
// Ces libelles sont lus par le vendeur dans son espace : ils sont accentues et
// rediges pour lui, contrairement aux commentaires du code.
export const SELLER_ACTION_TEMPLATE: SellerActionTemplate[] = [
  {
    key: 'dpe',
    title: 'DPE',
    description:
      "Diagnostic de performance énergétique, obligatoire dès la mise en ligne de l'annonce.",
    responsible: 'seller',
  },
  {
    key: 'diagnostics',
    title: 'Diagnostics réglementaires',
    description:
      "Amiante, plomb, électricité, gaz, termites — selon l'âge et la situation du bien.",
    responsible: 'seller',
  },
  {
    key: 'carrez',
    title: 'Mesurage Carrez',
    description:
      'Obligatoire en copropriété, recommandé ailleurs pour sécuriser la surface annoncée.',
    responsible: 'seller',
  },
  {
    key: 'shooting',
    title: 'Shooting photo',
    description: 'Reportage photo professionnel du bien, préalable à la diffusion.',
    responsible: 'advisor',
  },
  {
    key: 'visuels',
    title: 'Mise en ligne des visuels',
    description: 'Publication des photos et du descriptif sur les portails de diffusion.',
    responsible: 'advisor',
  },
]

/** Statuts partages avec `client_dossier_events.status`. */
export const SELLER_ACTION_STATUSES = ['todo', 'done', 'blocked', 'info'] as const

export type SellerActionStatus = (typeof SELLER_ACTION_STATUSES)[number]

export function isSellerActionStatus(value: unknown): value is SellerActionStatus {
  return typeof value === 'string' && (SELLER_ACTION_STATUSES as readonly string[]).includes(value)
}

export type SellerAction = {
  id: string
  title: string
  description: string | null
  status: SellerActionStatus
  responsible: SellerActionResponsible
  /** Echeance facultative : toutes les actions n'en appellent pas une. */
  due_date: string | null
  done_at: string | null
}

/** Une ligne `client_dossier_events` de type `action`, telle qu'elle sort de la base. */
type ActionEventRow = {
  id: string
  title: string
  description: string | null
  status: string | null
  event_date: string | null
  payload: unknown
  updated_at?: string | null
}

function readResponsible(payload: unknown): SellerActionResponsible {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  return record.responsible === 'seller' ? 'seller' : 'advisor'
}

/**
 * Projette les evenements de type `action` vers la forme montree au vendeur.
 * L'ordre suit celui du gabarit tant que les cles sont reconnues, puis les
 * ajouts libres — une liste paralleles n'a pas d'ordre impose, mais un ordre
 * stable evite qu'elle danse d'un affichage a l'autre.
 */
export function mapSellerActions(rows: ActionEventRow[]): SellerAction[] {
  const templateOrder = new Map(SELLER_ACTION_TEMPLATE.map((entry, index) => [entry.title, index]))

  return rows
    .map((row) => {
      const status = isSellerActionStatus(row.status) ? row.status : 'todo'
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status,
        responsible: readResponsible(row.payload),
        due_date: row.event_date,
        done_at: status === 'done' ? row.updated_at ?? null : null,
      }
    })
    .sort((left, right) => {
      const leftRank = templateOrder.get(left.title) ?? Number.MAX_SAFE_INTEGER
      const rightRank = templateOrder.get(right.title) ?? Number.MAX_SAFE_INTEGER
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.title.localeCompare(right.title, 'fr')
    })
}

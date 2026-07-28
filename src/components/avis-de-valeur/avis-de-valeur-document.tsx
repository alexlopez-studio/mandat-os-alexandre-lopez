import { resolvePages } from './page-registry'
import type { AvisDeValeur } from '@/lib/avis-de-valeur/types'

/**
 * Le rapport complet.
 *
 * Le nombre de pages est le résultat du filtre, jamais une constante : c'est ici
 * — et seulement ici — que les numéros sont attribués. Aucune page ne connaît sa
 * position, ce qui permet d'en insérer une sans casser la séquence ni le
 * contrôle de numérotation.
 */
export function AvisDeValeurDocument({ avis }: { avis: AvisDeValeur }) {
  const pages = resolvePages(avis)

  return (
    <article className="avv-document" data-avv-document>
      {pages.map((page, index) => {
        const Page = page.component
        return <Page key={page.id} avis={avis} pageNumber={index + 1} totalPages={pages.length} />
      })}
    </article>
  )
}

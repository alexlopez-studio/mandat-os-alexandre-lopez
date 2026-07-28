import type { ComponentType } from 'react'

import type { PagePosition } from './a4-page'
import type { AvisDeValeur } from '@/lib/avis-de-valeur/types'

import { PageCouverture } from './pages/page-couverture'
import { PageLeBien } from './pages/page-le-bien'
import { PagePerformanceEnergetique } from './pages/page-performance-energetique'
import { PageLeMarche } from './pages/page-le-marche'
import { PageTensionMarche } from './pages/page-tension-marche'
import { PageComparables } from './pages/page-comparables'
import { PageSynthesePrix } from './pages/page-synthese-prix'
import { PageAnalysePatrimoniale } from './pages/page-analyse-patrimoniale'
import { PageVendreOuConserver } from './pages/page-vendre-ou-conserver'
import { PageStrategie } from './pages/page-strategie'
import { PageConclusion } from './pages/page-conclusion'
import { PageEngagements } from './pages/page-engagements'

export type AvisPageProps = PagePosition & { avis: AvisDeValeur }

export interface PageDefinition {
  id: string
  title: string
  isCore: boolean
  component: ComponentType<AvisPageProps>
  /** Évalué uniquement si `isCore` est faux. */
  includeWhen?: (avis: AvisDeValeur) => boolean
}

/**
 * Le plan du rapport.
 *
 * Narration : le bien → le marché → le prix → l'argent → comment je vends →
 * qui je suis.
 *
 * Le document n'a **pas** un nombre de pages fixe. Un socle systématique, et des
 * pages activées selon la situation du vendeur : la majorité des dossiers sont
 * des projets de vente déjà arbitrés, leur servir une page « faut-il vendre ou
 * conserver ? » est hors sujet et affaiblit le document.
 *
 * L'ordre de ce tableau fait foi. Aucun composant ne connaît son numéro : il le
 * reçoit, calculé depuis la liste filtrée.
 */
export const PAGES: PageDefinition[] = [
  { id: 'couverture', title: 'Couverture', isCore: true, component: PageCouverture },
  { id: 'le-bien', title: 'Le bien', isCore: true, component: PageLeBien },
  {
    id: 'performance-energetique',
    title: 'Performance énergétique',
    isCore: true,
    component: PagePerformanceEnergetique,
  },
  { id: 'le-marche', title: 'Le marché', isCore: true, component: PageLeMarche },
  { id: 'tension-marche', title: 'Tension du marché', isCore: true, component: PageTensionMarche },
  { id: 'comparables', title: 'Biens comparables', isCore: true, component: PageComparables },
  { id: 'synthese-prix', title: 'Synthèse des prix', isCore: true, component: PageSynthesePrix },
  {
    id: 'analyse-patrimoniale',
    title: 'Analyse patrimoniale',
    isCore: true,
    component: PageAnalysePatrimoniale,
  },
  {
    id: 'vendre-ou-conserver',
    title: 'Vendre ou conserver',
    isCore: false,
    component: PageVendreOuConserver,
    includeWhen: (avis) =>
      avis.meta.flags.includes('hesite_location') || avis.meta.flags.includes('depart_sans_rachat'),
  },
  { id: 'strategie', title: 'Stratégie de mise en vente', isCore: true, component: PageStrategie },
  { id: 'conclusion', title: 'Conclusion & avis de valeur', isCore: true, component: PageConclusion },
  { id: 'engagements', title: 'Engagements & conseiller', isCore: true, component: PageEngagements },
]

/** Les pages effectivement rendues pour un dossier donné, dans l'ordre. */
export function resolvePages(avis: AvisDeValeur): PageDefinition[] {
  return PAGES.filter((page) => page.isCore || (page.includeWhen?.(avis) ?? false))
}

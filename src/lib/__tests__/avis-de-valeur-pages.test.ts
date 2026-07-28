import { describe, expect, it } from 'vitest'

import { PAGES, resolvePages } from '@/components/avis-de-valeur/page-registry'
import type { AvisDeValeur, AvisFlag } from '@/lib/avis-de-valeur/types'

/** Seuls `meta.flags` comptent pour le filtrage : le reste n'est pas lu. */
function avisWithFlags(flags: AvisFlag[]): AvisDeValeur {
  return { meta: { flags } } as unknown as AvisDeValeur
}

describe('resolvePages', () => {
  it('rend le socle de 11 pages sans aucun drapeau', () => {
    const pages = resolvePages(avisWithFlags([]))

    expect(pages).toHaveLength(11)
    expect(pages.every((page) => page.isCore)).toBe(true)
  })

  it('suit l’ordre de narration : le bien, le marché, le prix, l’argent, la vente, le conseiller', () => {
    expect(resolvePages(avisWithFlags([])).map((page) => page.id)).toEqual([
      'couverture',
      'le-bien',
      'performance-energetique',
      'le-marche',
      'tension-marche',
      'comparables',
      'synthese-prix',
      'analyse-patrimoniale',
      'strategie',
      'conclusion',
      'engagements',
    ])
  })

  it('insère « Vendre ou conserver » après l’analyse patrimoniale quand le vendeur hésite', () => {
    const pages = resolvePages(avisWithFlags(['hesite_location']))

    expect(pages).toHaveLength(12)
    expect(pages[7].id).toBe('analyse-patrimoniale')
    expect(pages[8].id).toBe('vendre-ou-conserver')
    expect(pages[9].id).toBe('strategie')
  })

  it('active aussi la page sur un départ sans rachat', () => {
    expect(resolvePages(avisWithFlags(['depart_sans_rachat'])).map((page) => page.id)).toContain(
      'vendre-ou-conserver',
    )
  })

  it('n’active pas la page sur un drapeau sans rapport', () => {
    expect(resolvePages(avisWithFlags(['succession'])).map((page) => page.id)).not.toContain(
      'vendre-ou-conserver',
    )
  })

  it('ne produit jamais deux pages de même identifiant', () => {
    const ids = resolvePages(avisWithFlags(['hesite_location', 'depart_sans_rachat'])).map((page) => page.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('déclare une condition d’activation pour chaque page non systématique', () => {
    // Sans `includeWhen`, une page optionnelle ne s'afficherait jamais — un
    // oubli silencieux, jamais signalé à l'exécution.
    const optional = PAGES.filter((page) => !page.isCore)

    expect(optional.length).toBeGreaterThan(0)
    expect(optional.every((page) => typeof page.includeWhen === 'function')).toBe(true)
  })
})

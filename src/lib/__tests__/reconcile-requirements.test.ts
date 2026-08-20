import { describe, expect, it } from 'vitest'

import { EMPTY_SALE_CONTEXT, type SaleContext } from '@/lib/market/sale-context'
import {
  documentRequirementsFor,
  reconcileRequirements,
  summarizeRequirements,
  type DocumentRow,
} from '@/lib/market/document-requirements'

function context(overrides: Partial<SaleContext> = {}): SaleContext {
  return { ...EMPTY_SALE_CONTEXT, ...overrides }
}

function row(overrides: Partial<DocumentRow> & { id: string }): DocumentRow {
  return { label: 'Sans titre', requirement_key: null, status: 'missing', ...overrides }
}

/** Simule l'application du gabarit : cree une ligne par piece manquante. */
function applyTemplate(saleContext: SaleContext, existing: DocumentRow[]): DocumentRow[] {
  const rows = reconcileRequirements({ context: saleContext, documents: existing })
  const created = rows
    .filter((entry) => entry.state === 'missing')
    .map((entry, index) =>
      row({ id: `new-${index}`, label: entry.label, requirement_key: entry.key, status: 'missing' })
    )
  return [...existing, ...created]
}

describe('reconcileRequirements', () => {
  it('une piece renommee par le conseiller reste reconnue par sa cle', () => {
    const rows = reconcileRequirements({
      context: context({ property_type: 'maison' }),
      documents: [row({ id: 'a', label: 'DPE (commandé le 12/09)', requirement_key: 'dpe' })],
    })

    const dpe = rows.find((entry) => entry.key === 'dpe')
    expect(dpe?.state).toBe('present')
    // Le libelle affiche reste celui du referentiel, la ligne gardant le sien.
    expect(dpe?.document?.label).toBe('DPE (commandé le 12/09)')
  })

  it('une piece portant le bon libelle mais aucune cle reste manquante', () => {
    const rows = reconcileRequirements({
      context: context({ property_type: 'maison' }),
      documents: [row({ id: 'a', label: 'DPE', requirement_key: null })],
    })
    expect(rows.find((entry) => entry.key === 'dpe')?.state).toBe('missing')
  })

  it("une piece hors referentiel n'est jamais marquee orpheline", () => {
    const rows = reconcileRequirements({
      context: context({ property_type: 'maison' }),
      documents: [row({ id: 'a', label: 'Photo du portail', requirement_key: null })],
    })
    expect(rows.some((entry) => entry.state === 'orphan')).toBe(false)
  })

  it('une cle inconnue du referentiel est ignoree plutot que signalee', () => {
    const rows = reconcileRequirements({
      context: context({ property_type: 'maison' }),
      documents: [row({ id: 'a', label: 'Ancienne pièce', requirement_key: 'regle_supprimee' })],
    })
    expect(rows.some((entry) => entry.state === 'orphan')).toBe(false)
  })

  it('retirer « bien loue » du contexte rend les pieces du bail orphelines', () => {
    const loue = context({ property_type: 'appartement', situations: ['loue'] })
    const documents = applyTemplate(loue, [])
    expect(documents.some((entry) => entry.requirement_key === 'bail_en_cours')).toBe(true)

    const apres = reconcileRequirements({
      context: context({ property_type: 'appartement' }),
      documents,
    })
    const bail = apres.find((entry) => entry.key === 'bail_en_cours')
    expect(bail?.state).toBe('orphan')
    // Jamais supprimee : la ligne existe toujours, le vendeur a pu deposer.
    expect(bail?.document?.id).toBeDefined()
  })

  it('appliquer deux fois le gabarit ne cree rien la seconde fois', () => {
    const saleContext = context({ property_type: 'appartement', regime: 'copropriete' })
    const premier = applyTemplate(saleContext, [])
    const second = applyTemplate(saleContext, premier)
    expect(second.length).toBe(premier.length)
    expect(premier.length).toBe(documentRequirementsFor(saleContext).length)
  })

  it('renommer une piece puis rejouer le gabarit ne cree pas de doublon', () => {
    const saleContext = context({ property_type: 'maison' })
    const premier = applyTemplate(saleContext, [])
    const renomme = premier.map((entry) =>
      entry.requirement_key === 'dpe' ? { ...entry, label: 'DPE — reçu par mail' } : entry
    )
    expect(applyTemplate(saleContext, renomme).length).toBe(premier.length)
  })
})

describe('summarizeRequirements', () => {
  it('compte les presentes, les manquantes et les orphelines separement', () => {
    const saleContext = context({ property_type: 'maison' })
    const attendues = documentRequirementsFor(saleContext)

    const rows = reconcileRequirements({
      context: saleContext,
      documents: [
        row({ id: 'a', label: 'DPE', requirement_key: 'dpe' }),
        row({ id: 'b', label: 'Bail', requirement_key: 'bail_en_cours' }),
      ],
    })

    const summary = summarizeRequirements(rows)
    expect(summary.expected).toBe(attendues.length)
    expect(summary.present).toBe(1)
    expect(summary.missing).toBe(attendues.length - 1)
    expect(summary.orphans).toBe(1)
  })

  it('les orphelines ne comptent pas dans les pieces attendues', () => {
    const rows = reconcileRequirements({
      context: context({ property_type: 'maison' }),
      documents: [row({ id: 'b', label: 'Bail', requirement_key: 'bail_en_cours' })],
    })
    const summary = summarizeRequirements(rows)
    expect(summary.expected + summary.orphans).toBe(rows.length)
  })

  it('seules les obligatoires manquantes alimentent le compteur bloquant', () => {
    const saleContext = context({ property_type: 'terrain' })
    const summary = summarizeRequirements(
      reconcileRequirements({ context: saleContext, documents: [] })
    )
    expect(summary.blockingMissing).toBeGreaterThan(0)
    expect(summary.blockingMissing).toBeLessThan(summary.missing)
  })
})

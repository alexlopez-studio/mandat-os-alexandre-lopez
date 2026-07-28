import { describe, expect, it } from 'vitest'

import { checkPageLayout, type PageMeasurement } from '@/lib/avis-de-valeur/layout-guards'

function page(overrides: Partial<PageMeasurement> = {}): PageMeasurement {
  return {
    pageNumber: 1,
    widthMm: 210,
    heightMm: 297,
    contentOverflowMm: -20,
    fillPercent: 80,
    footerOffsetMm: 12,
    minInkMarginMm: 12.3,
    isCover: false,
    ...overrides,
  }
}

describe('checkPageLayout', () => {
  it('ne signale rien sur un document conforme', () => {
    const pages = [
      page({ pageNumber: 1, isCover: true, footerOffsetMm: null, minInkMarginMm: 0, fillPercent: 100 }),
      page({ pageNumber: 2 }),
      page({ pageNumber: 3 }),
    ]

    expect(checkPageLayout(pages)).toEqual([])
  })

  it('détecte un contenu qui déborde et sera coupé', () => {
    const violations = checkPageLayout([page({ contentOverflowMm: 4.2 })])

    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('Débordement')
    expect(violations[0].severity).toBe('error')
  })

  it('détecte un pied de page qui dérive d’une page à l’autre', () => {
    const violations = checkPageLayout([
      page({ pageNumber: 1, footerOffsetMm: 12 }),
      page({ pageNumber: 2, footerOffsetMm: 15.4 }),
    ])

    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('Alignement du pied de page')
    expect(violations[0].pageNumber).toBe(2)
  })

  it('tolère un écart de pied de page inférieur au demi-millimètre', () => {
    const violations = checkPageLayout([
      page({ pageNumber: 1, footerOffsetMm: 12 }),
      page({ pageNumber: 2, footerOffsetMm: 12.3 }),
    ])

    expect(violations).toEqual([])
  })

  it('détecte de l’encre dans la zone non imprimable', () => {
    const violations = checkPageLayout([page({ minInkMarginMm: 6 })])

    expect(violations[0].rule).toBe('Zone d’impression')
  })

  it('exempte la couverture des règles de marge et de pied de page', () => {
    const violations = checkPageLayout([
      page({ pageNumber: 1, isCover: true, minInkMarginMm: 0, footerOffsetMm: null, fillPercent: 100 }),
    ])

    expect(violations).toEqual([])
  })

  it('signale une page à moitié vide sans la traiter comme une erreur', () => {
    const violations = checkPageLayout([page({ fillPercent: 24 })])

    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('Page trop vide')
    expect(violations[0].severity).toBe('warning')
  })

  it('détecte un format qui n’est pas A4', () => {
    const violations = checkPageLayout([page({ widthMm: 216, heightMm: 279 })])

    expect(violations[0].rule).toBe('Format A4')
  })

  it('détecte une numérotation discontinue', () => {
    const violations = checkPageLayout([page({ pageNumber: 1 }), page({ pageNumber: 3 })])

    expect(violations.some((violation) => violation.rule === 'Numérotation')).toBe(true)
  })
})

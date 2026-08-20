import { describe, expect, it } from 'vitest'

import { EMPTY_SALE_CONTEXT, type SaleContext } from '@/lib/market/sale-context'
import { deriveSaleFlags } from '@/lib/market/sale-flags'

function context(overrides: Partial<SaleContext> = {}): SaleContext {
  return { ...EMPTY_SALE_CONTEXT, ...overrides }
}

describe('deriveSaleFlags', () => {
  it("un permis d'avant 1949 declenche aussi le seuil amiante de 1997", () => {
    const flags = deriveSaleFlags(context({ permis_periode: 'avant_1949' }))
    expect(flags).toContain('permis_avant_1949')
    expect(flags).toContain('permis_avant_1997')
  })

  it('un permis posterieur a 1997 ne declenche aucun des deux seuils', () => {
    const flags = deriveSaleFlags(context({ permis_periode: 'apres_1997' }))
    expect(flags).not.toContain('permis_avant_1949')
    expect(flags).not.toContain('permis_avant_1997')
  })

  it('une periode de permis inconnue declenche plomb et amiante par prudence', () => {
    const flags = deriveSaleFlags(context({ permis_periode: 'inconnu' }))
    expect(flags).toContain('permis_avant_1949')
    expect(flags).toContain('permis_avant_1997')
  })

  it('un permis entre 1949 et 1997 declenche amiante mais pas plomb', () => {
    const flags = deriveSaleFlags(context({ permis_periode: 'de_1949_a_1997' }))
    expect(flags).toContain('permis_avant_1997')
    expect(flags).not.toContain('permis_avant_1949')
  })

  it('gaz absent ne declenche jamais le diagnostic gaz', () => {
    expect(deriveSaleFlags(context({ gaz: 'absent' }))).not.toContain('gaz_a_diagnostiquer')
  })

  it('une electricite de moins de 15 ans ne declenche rien', () => {
    expect(deriveSaleFlags(context({ electricite: 'moins_15_ans' }))).not.toContain('elec_a_diagnostiquer')
  })

  it('une electricite inconnue declenche le diagnostic', () => {
    expect(deriveSaleFlags(context({ electricite: 'plus_15_ans_ou_inconnu' }))).toContain(
      'elec_a_diagnostiquer'
    )
  })

  it('un DPE E, F ou G leve le drapeau passoire, un D non', () => {
    for (const classe of ['E', 'F', 'G'] as const) {
      expect(deriveSaleFlags(context({ dpe_classe: classe }))).toContain('dpe_passoire')
    }
    expect(deriveSaleFlags(context({ dpe_classe: 'D' }))).not.toContain('dpe_passoire')
    expect(deriveSaleFlags(context({ dpe_classe: 'inconnu' }))).not.toContain('dpe_passoire')
  })

  it('les zones prennent le prefixe zone_, sauf le lotissement', () => {
    const flags = deriveSaleFlags(context({ zones: ['termites', 'lotissement'] }))
    expect(flags).toContain('zone_termites')
    expect(flags).toContain('lotissement')
  })

  it('les situations de vente se reportent telles quelles', () => {
    const flags = deriveSaleFlags(context({ situations: ['succession', 'indivision'] }))
    expect(flags).toContain('succession')
    expect(flags).toContain('indivision')
  })

  it('un contexte vide ne leve aucun drapeau situationnel', () => {
    const flags = deriveSaleFlags(EMPTY_SALE_CONTEXT)
    expect(flags).not.toContain('succession')
    expect(flags).not.toContain('copropriete')
    expect(flags).not.toContain('loue')
  })

  it('le regime inconnu ne leve ni copropriete ni monopropriete', () => {
    const flags = deriveSaleFlags(context({ regime: 'inconnu' }))
    expect(flags).not.toContain('copropriete')
    expect(flags).not.toContain('monopropriete')
  })
})

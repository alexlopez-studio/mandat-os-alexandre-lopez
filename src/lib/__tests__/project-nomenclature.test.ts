import { describe, expect, it } from 'vitest'
import {
  buildProjectTitle,
  formatProjectLabel,
  isProjectReference,
  normalizeSearchText,
} from '../project-stages'

describe('buildProjectTitle', () => {
  it('compose "NOM - Commune" pour un titulaire unique', () => {
    expect(buildProjectTitle({ titulaireLastNames: ['Martin'], city: 'Brignoles' })).toBe(
      'MARTIN - Brignoles'
    )
  })

  it('dedoublonne les patronymes identiques (M. et Mme Martin)', () => {
    expect(
      buildProjectTitle({ titulaireLastNames: ['Martin', 'MARTIN'], city: 'Brignoles' })
    ).toBe('MARTIN - Brignoles')
  })

  it('joint deux patronymes distincts dans l ordre recu', () => {
    expect(
      buildProjectTitle({ titulaireLastNames: ['Martin', 'Dupont'], city: 'Brignoles' })
    ).toBe('MARTIN / DUPONT - Brignoles')
  })

  it('resume au-dela de deux titulaires', () => {
    expect(
      buildProjectTitle({
        titulaireLastNames: ['Martin', 'Dupont', 'Delpuech'],
        city: 'Brignoles',
      })
    ).toBe('MARTIN / DUPONT +1 - Brignoles')
  })

  it('tombe sur la commune seule quand aucun titulaire n est designe', () => {
    // Cas d'un dossier ou seul le notaire est rattache : il ne doit pas
    // remonter dans le titre. L'identite est portee par la reference.
    expect(buildProjectTitle({ titulaireLastNames: [], city: 'Brignoles' })).toBe('Brignoles')
  })

  it('n utilise le nom declare que faute de tout contact, et n en garde que le patronyme', () => {
    expect(
      buildProjectTitle({ declaredName: 'Monsieur Jean Dupont', city: 'Barjols' })
    ).toBe('DUPONT - Barjols')
  })

  it('renvoie null quand il n y a ni titulaire ni commune', () => {
    expect(buildProjectTitle({ titulaireLastNames: [null, ''] })).toBeNull()
  })
})

describe('formatProjectLabel', () => {
  it('accole la reference au titre', () => {
    expect(formatProjectLabel('26-042', 'MARTIN - Brignoles')).toBe('26-042 · MARTIN - Brignoles')
  })

  it('se replie sur la seule reference quand le titre est vide', () => {
    expect(formatProjectLabel('26-042', null)).toBe('26-042')
  })
})

describe('isProjectReference', () => {
  it('reconnait le format AA-NNN et son debordement a quatre chiffres', () => {
    expect(isProjectReference('26-042')).toBe(true)
    expect(isProjectReference('26-1042')).toBe(true)
  })

  it('rejette ce qui n en est pas une', () => {
    expect(isProjectReference('MARTIN - Brignoles')).toBe(false)
    expect(isProjectReference('26-42')).toBe(false)
  })
})

describe('normalizeSearchText', () => {
  it('unifie tirets, accents et casse pour que la recherche tombe juste', () => {
    // Le titre affiche un trait d'union, mais un copier-coller depuis un mail
    // peut ramener un demi-cadratin.
    expect(normalizeSearchText('MARTIN – Brignoles')).toBe(normalizeSearchText('martin - brignoles'))
    expect(normalizeSearchText('26 042')).toBe(normalizeSearchText('26-042'))
    expect(normalizeSearchText('Négociation')).toBe('negociation')
  })
})

import { describe, expect, it } from 'vitest'
import { projectClientDossierFromOpportunity } from '../client-dossier-projection'

describe('projectClientDossierFromOpportunity', () => {
  it('keeps dossier-only values and lets opportunity values win', () => {
    const dossier = {
      property_snapshot: {
        commune: 'Cotignac',
        surface: 120,
        mandate_number: 'M-001',
      },
      professional_opinion: {
        price: 390000,
        mandate_type: 'simple',
      },
    }

    const opportunity = {
      property_snapshot: {
        surface: 128,
        dpe: 'C',
      },
      professional_opinion: {
        price: 420000,
        summary: 'Avis actualise apres visite.',
      },
    }

    expect(projectClientDossierFromOpportunity(dossier, opportunity)).toMatchObject({
      property_snapshot: {
        commune: 'Cotignac',
        surface: 128,
        mandate_number: 'M-001',
        dpe: 'C',
      },
      professional_opinion: {
        price: 420000,
        mandate_type: 'simple',
        summary: 'Avis actualise apres visite.',
      },
    })
  })

  it('returns the dossier unchanged when there is no linked opportunity', () => {
    const dossier = {
      property_snapshot: { commune: 'Aups' },
      professional_opinion: { price: 300000 },
    }

    expect(projectClientDossierFromOpportunity(dossier, null)).toBe(dossier)
  })
})

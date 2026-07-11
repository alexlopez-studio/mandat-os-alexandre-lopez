import { describe, it, expect } from 'vitest'
import { computeLeadResults } from '../compute-results'
import type { EstimationInput, EstimationOutput } from '../../estimation'
import type { AuditInput, AuditOutput } from '../../audit'

describe('computeLeadResults', () => {
  it('vendre → appelle l\'estimator avec coercion lat/lng/surface depuis des strings', async () => {
    let captured: EstimationInput | null = null
    const fakeEstimator = async (input: EstimationInput): Promise<EstimationOutput> => {
      captured = input
      return { valeur_mediane: 270000, confiance: 70 } as EstimationOutput
    }

    const result = await computeLeadResults(
      {
        type: 'vendre',
        formData: {
          lat: '43.5',
          lng: 6.1,
          surface: '75',
          type_bien: 'maison',
          etat: 'bon_etat',
          dpe: 'C',
          equipements: ['Piscine', 42, 'Jardin', null],
          delai: '3_6_mois',
        },
      },
      { estimator: fakeEstimator },
    )

    expect(result.valeur_mediane).toBe(270000)
    expect(captured).not.toBeNull()
    expect(captured!.lat).toBe(43.5)
    expect(captured!.lng).toBe(6.1)
    expect(captured!.surface).toBe(75)
    expect(captured!.type_bien).toBe('maison')
    expect(captured!.etat).toBe('bon_etat')
    expect(captured!.equipements).toEqual(['Piscine', 'Jardin'])
  })

  it('vendre rejette si lat/lng/surface manquant dans formData', async () => {
    await expect(
      computeLeadResults({ type: 'vendre', formData: { surface: 75 } }),
    ).rejects.toThrow(/lat, lng, surface requis/)
  })

  it('vendre tolère formData minimal numérique', async () => {
    const fakeEstimator = async (i: EstimationInput): Promise<EstimationOutput> =>
      ({ valeur_mediane: i.surface * 1000 } as EstimationOutput)
    const r = await computeLeadResults(
      { type: 'vendre', formData: { lat: 43, lng: 6, surface: 100 } },
      { estimator: fakeEstimator },
    )
    expect(r.valeur_mediane).toBe(100000)
  })

  it('audit → appelle l\'auditor avec coercion booleen + nombre', async () => {
    let captured: AuditInput | null = null
    const fakeAuditor = (input: AuditInput): AuditOutput => {
      captured = input
      return { score_global: 75 } as AuditOutput
    }

    const r = await computeLeadResults(
      {
        type: 'audit',
        formData: {
          etat_toiture: 'bon',
          humidite: true,
          age_chauffage: '5',
          dpe: 'C',
          isolation_fenetres: 'double_vitrage',
        },
      },
      { auditor: fakeAuditor },
    )

    expect(r.score_global).toBe(75)
    expect(captured).not.toBeNull()
    expect(captured!.etat_toiture).toBe('bon')
    expect(captured!.humidite).toBe(true)
    expect(captured!.age_chauffage).toBe(5)
    expect(captured!.dpe).toBe('C')
    expect(captured!.isolation_fenetres).toBe('double_vitrage')
  })

  it('acheter → résultat vide (passthrough côté front)', async () => {
    const r = await computeLeadResults({
      type: 'acheter',
      formData: { ville: 'Brignoles', budget_max: 350000 },
    })
    expect(r).toEqual({})
  })

  it('formData null → ne crash pas pour acheter, throw pour vendre', async () => {
    expect(await computeLeadResults({ type: 'acheter', formData: null })).toEqual({})
    await expect(
      computeLeadResults({ type: 'vendre', formData: null }),
    ).rejects.toThrow(/lat, lng, surface requis/)
  })
})

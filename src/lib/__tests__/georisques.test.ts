import { describe, expect, it } from 'vitest'

import {
  buildGeocodeQuery,
  geocodePrecision,
  hasClayRisk,
  normalizeGeorisquesReport,
} from '@/lib/market/georisques'

/** Extrait reel de la reponse Georisques pour Barjols (83012). */
const BARJOLS = {
  adresse: { libelle: 'Chemin de la Lauve, 83670 Barjols', longitude: 5.9852, latitude: 43.566128 },
  commune: { libelle: 'BARJOLS', codePostal: '83670', codeInsee: '83012' },
  url: 'https://www.georisques.gouv.fr/mes-risques/.../83012/BARJOLS',
  risquesNaturels: {
    inondation: { present: true, libelle: 'Inondation', libelleStatutCommune: 'Risque Existant', libelleStatutAdresse: null },
    seisme: { present: true, libelle: 'Séisme', libelleStatutCommune: 'Risque Existant - faible', libelleStatutAdresse: 'Zone 2' },
    retraitGonflementArgile: { present: true, libelle: 'Retrait gonflement des argiles', libelleStatutCommune: 'Risque Existant - important', libelleStatutAdresse: null },
    risqueCotier: { present: false, libelle: 'Risques côtiers', libelleStatutCommune: null, libelleStatutAdresse: null },
    avalanche: { present: false, libelle: 'Avalanche', libelleStatutCommune: null, libelleStatutAdresse: null },
  },
  risquesTechnologiques: {
    pollutionSols: { present: true, libelle: 'Pollution des sols', libelleStatutCommune: 'Risque Concerne', libelleStatutAdresse: null },
    nucleaire: { present: false, libelle: 'Nucléaire', libelleStatutCommune: null, libelleStatutAdresse: null },
  },
}

describe('normalizeGeorisquesReport', () => {
  it('ne retient que les risques presents', () => {
    const report = normalizeGeorisquesReport(BARJOLS, 'adresse')!
    const keys = report.risks.map((risk) => risk.key)
    expect(keys).toContain('inondation')
    expect(keys).toContain('retraitGonflementArgile')
    expect(keys).toContain('pollutionSols')
    expect(keys).not.toContain('risqueCotier')
    expect(keys).not.toContain('nucleaire')
    expect(report.risks).toHaveLength(4)
  })

  it('distingue les familles naturelle et technologique', () => {
    const report = normalizeGeorisquesReport(BARJOLS, 'adresse')!
    expect(report.risks.find((risk) => risk.key === 'seisme')?.family).toBe('naturel')
    expect(report.risks.find((risk) => risk.key === 'pollutionSols')?.family).toBe('technologique')
  })

  it("conserve le statut a l'adresse quand il existe", () => {
    const report = normalizeGeorisquesReport(BARJOLS, 'adresse')!
    const seisme = report.risks.find((risk) => risk.key === 'seisme')
    expect(seisme?.addressStatus).toBe('Zone 2')
    expect(seisme?.communeStatus).toBe('Risque Existant - faible')
  })

  it('remonte la commune et le lien du rapport', () => {
    const report = normalizeGeorisquesReport(BARJOLS, 'commune')!
    expect(report.commune.codeInsee).toBe('83012')
    expect(report.commune.label).toBe('BARJOLS')
    expect(report.precision).toBe('commune')
    expect(report.reportUrl).toContain('georisques.gouv.fr')
  })

  it('rend null sur une charge utile inexploitable', () => {
    expect(normalizeGeorisquesReport(null, 'commune')).toBeNull()
    expect(normalizeGeorisquesReport({}, 'commune')).toBeNull()
    // Sans code INSEE, le rapport n'identifie rien.
    expect(normalizeGeorisquesReport({ commune: { libelle: 'X' } }, 'commune')).toBeNull()
  })

  it('supporte une reponse sans bloc adresse', () => {
    const { adresse: _adresse, ...sansAdresse } = BARJOLS
    const report = normalizeGeorisquesReport(sansAdresse, 'commune')!
    expect(report.matchedAddress).toBeNull()
    expect(report.risks.length).toBeGreaterThan(0)
  })
})

describe('hasClayRisk', () => {
  it('detecte le retrait-gonflement des argiles', () => {
    expect(hasClayRisk(normalizeGeorisquesReport(BARJOLS, 'adresse')!)).toBe(true)
  })

  it("ne le detecte pas s'il est absent", () => {
    const sansArgile = {
      ...BARJOLS,
      risquesNaturels: { inondation: BARJOLS.risquesNaturels.inondation },
    }
    expect(hasClayRisk(normalizeGeorisquesReport(sansArgile, 'adresse')!)).toBe(false)
  })
})

describe('buildGeocodeQuery', () => {
  it('assemble adresse, code postal et ville', () => {
    expect(
      buildGeocodeQuery({ address: '12 rue des Lices', zipcode: '83670', city: 'Barjols' })
    ).toBe('12 rue des Lices 83670 Barjols')
  })

  it('tolere les champs manquants', () => {
    expect(buildGeocodeQuery({ city: 'Barjols' })).toBe('Barjols')
    expect(buildGeocodeQuery({ zipcode: '83670', city: null })).toBe('83670')
  })

  it('rend null quand il n’y a rien a chercher', () => {
    expect(buildGeocodeQuery({})).toBeNull()
    expect(buildGeocodeQuery({ address: '   ', city: null, zipcode: undefined })).toBeNull()
  })
})

describe('geocodePrecision', () => {
  // Valeurs relevees sur la BAN pour Barjols (83012).
  it('un resultat communal reste communal, meme tres bien note', () => {
    expect(geocodePrecision('municipality', 0.94)).toBe('commune')
  })

  it('une adresse bien rapprochee est precise', () => {
    expect(geocodePrecision('housenumber', 0.952)).toBe('adresse')
    expect(geocodePrecision('street', 0.952)).toBe('adresse')
  })

  it('une adresse mal rapprochee est signalee comme incertaine', () => {
    // « 12 rue des Lices » renvoie « 12 Rue des Boyers » a 0.604 : bon format,
    // mauvaise rue. On ne doit pas l'annoncer comme une localisation fiable.
    expect(geocodePrecision('housenumber', 0.604)).toBe('incertain')
  })

  it('un type absent ou inconnu retombe sur la commune', () => {
    expect(geocodePrecision(null, 0.99)).toBe('commune')
    expect(geocodePrecision('locality', 0.99)).toBe('commune')
  })

  it('un score non numerique ne passe jamais pour fiable', () => {
    expect(geocodePrecision('housenumber', undefined)).toBe('incertain')
    expect(geocodePrecision('housenumber', 'tres bon')).toBe('incertain')
  })
})

import { describe, expect, it } from 'vitest'

import { EMPTY_SALE_CONTEXT, type SaleContext } from '@/lib/market/sale-context'
import { SALE_FLAGS } from '@/lib/market/sale-flags'
import {
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENT_REQUIREMENTS,
  documentRequirementsFor,
  resolveDocumentRequirements,
} from '@/lib/market/document-requirements'

function context(overrides: Partial<SaleContext> = {}): SaleContext {
  return { ...EMPTY_SALE_CONTEXT, ...overrides }
}

function keysFor(overrides: Partial<SaleContext> = {}): string[] {
  return resolveDocumentRequirements(context(overrides)).map((entry) => entry.requirement.key)
}

describe('resolveDocumentRequirements — type de bien', () => {
  it("un terrain nu n'appelle ni DPE, ni amiante, ni Carrez", () => {
    const keys = keysFor({ property_type: 'terrain', permis_periode: 'avant_1949' })
    expect(keys).not.toContain('dpe')
    expect(keys).not.toContain('amiante')
    expect(keys).not.toContain('crep')
    expect(keys).not.toContain('carrez')
  })

  it('un terrain appelle le certificat d’urbanisme et la viabilisation', () => {
    const keys = keysFor({ property_type: 'terrain' })
    expect(keys).toContain('certificat_urbanisme')
    expect(keys).toContain('viabilisation')
  })

  it('une maison appelle le DPE mais pas le certificat d’urbanisme', () => {
    const keys = keysFor({ property_type: 'maison' })
    expect(keys).toContain('dpe')
    expect(keys).not.toContain('certificat_urbanisme')
  })
})

describe('resolveDocumentRequirements — copropriete', () => {
  it('un appartement en copropriete appelle Carrez, le reglement, les PV d’AG et le pre-etat date', () => {
    const keys = keysFor({ property_type: 'appartement', regime: 'copropriete' })
    expect(keys).toContain('carrez')
    expect(keys).toContain('reglement_copropriete')
    expect(keys).toContain('pv_ag_3_ans')
    expect(keys).toContain('pre_etat_date')
    expect(keys).toContain('etat_date')
  })

  it("une maison hors copropriete n'appelle pas Carrez", () => {
    const keys = keysFor({ property_type: 'maison', regime: 'monopropriete' })
    expect(keys).not.toContain('carrez')
    expect(keys).not.toContain('pv_ag_3_ans')
  })

  it('le DTA des parties communes exige copropriete ET un permis avant 1997', () => {
    expect(keysFor({ regime: 'copropriete', permis_periode: 'apres_1997' })).not.toContain(
      'dta_parties_communes'
    )
    expect(keysFor({ regime: 'copropriete', permis_periode: 'de_1949_a_1997' })).toContain(
      'dta_parties_communes'
    )
  })
})

describe('resolveDocumentRequirements — caracteristiques techniques', () => {
  it('une maison classee F appelle l’audit energetique, un appartement en copropriete non', () => {
    expect(keysFor({ property_type: 'maison', dpe_classe: 'F', regime: 'monopropriete' })).toContain(
      'audit_energetique'
    )
    expect(
      keysFor({ property_type: 'appartement', dpe_classe: 'F', regime: 'copropriete' })
    ).not.toContain('audit_energetique')
  })

  it("l'assainissement non collectif appelle le SPANC, le collectif non", () => {
    expect(keysFor({ assainissement: 'non_collectif' })).toContain('spanc')
    expect(keysFor({ assainissement: 'collectif' })).not.toContain('spanc')
  })

  it('des travaux recents appellent la DAACT et l’assurance dommages-ouvrage', () => {
    const keys = keysFor({ property_type: 'maison', travaux_recents: true })
    expect(keys).toContain('daact')
    expect(keys).toContain('assurance_do')
    expect(keys).toContain('decennales_entreprises')
  })

  it('sans travaux recents, aucune piece de la rubrique travaux', () => {
    const keys = keysFor({ property_type: 'maison', travaux_recents: false })
    expect(keys).not.toContain('daact')
    expect(keys).not.toContain('assurance_do')
  })

  it('une piscine appelle l’attestation de securite', () => {
    expect(keysFor({ property_type: 'maison', equipements: ['piscine'] })).toContain('securite_piscine')
  })

  it('le bornage obligatoire remplace le bornage recommande en lotissement', () => {
    const enLotissement = keysFor({ property_type: 'terrain', zones: ['lotissement'] })
    expect(enLotissement).toContain('bornage_lotissement')
    expect(enLotissement).not.toContain('bornage_terrain')

    const horsLotissement = keysFor({ property_type: 'terrain' })
    expect(horsLotissement).toContain('bornage_terrain')
    expect(horsLotissement).not.toContain('bornage_lotissement')
  })

  it("l'etude de sol G1 ne concerne qu'un terrain en zone d'argile", () => {
    expect(keysFor({ property_type: 'terrain', zones: ['argile'] })).toContain('etude_sol_g1')
    expect(keysFor({ property_type: 'maison', zones: ['argile'] })).not.toContain('etude_sol_g1')
  })
})

describe('resolveDocumentRequirements — situation de vente', () => {
  it("une succession ajoute l'acte de notoriete et l'attestation de propriete", () => {
    const keys = keysFor({ situations: ['succession'] })
    expect(keys).toContain('acte_notoriete')
    expect(keys).toContain('attestation_propriete_notariee')
  })

  it("une indivision exige l'accord de tous les indivisaires", () => {
    expect(keysFor({ situations: ['indivision'] })).toContain('accord_indivisaires')
  })

  it("un bien loue ajoute le bail, l'etat des lieux et la purge du droit de preemption", () => {
    const keys = keysFor({ situations: ['loue'] })
    expect(keys).toContain('bail_en_cours')
    expect(keys).toContain('etat_des_lieux_entree')
    expect(keys).toContain('conge_vente_ou_renonciation')
  })

  it('une SCI appelle le K-bis, les statuts et le PV autorisant la vente', () => {
    const keys = keysFor({ situations: ['sci'] })
    expect(keys).toContain('kbis_sci')
    expect(keys).toContain('statuts_sci')
    expect(keys).toContain('pv_ag_sci_vente')
  })

  it("une protection juridique exige l'autorisation du juge", () => {
    expect(keysFor({ situations: ['protection_juridique'] })).toContain('autorisation_juge_vente')
  })

  it('les situations se cumulent', () => {
    const keys = keysFor({ situations: ['succession', 'indivision', 'loue'] })
    expect(keys).toContain('acte_notoriete')
    expect(keys).toContain('accord_indivisaires')
    expect(keys).toContain('bail_en_cours')
  })

  it('requiresAny se satisfait d’un seul drapeau', () => {
    expect(keysFor({ situations: ['residence_secondaire'] })).toContain('justificatifs_plus_value')
    expect(keysFor({ situations: ['non_resident_fiscal'] })).toContain('justificatifs_plus_value')
    expect(keysFor({})).not.toContain('justificatifs_plus_value')
  })
})

describe('resolveDocumentRequirements — socle et tri', () => {
  it('le socle est propose meme sur un contexte vide', () => {
    const keys = keysFor({})
    expect(keys).toContain('titre_propriete')
    expect(keys).toContain('piece_identite')
    expect(keys).toContain('erp')
    expect(keys).toContain('mandat_signe')
  })

  it('les regles depreciees ne sont jamais proposees', () => {
    expect(keysFor({})).not.toContain('diagnostics')
    expect(keysFor({ property_type: 'maison', regime: 'copropriete' })).not.toContain('diagnostics')
  })

  it('chaque proposition porte au moins une raison, sauf le socle inconditionnel', () => {
    for (const entry of resolveDocumentRequirements(context({ situations: ['succession'] }))) {
      const conditionnee =
        (entry.requirement.appliesTo.requires?.length ?? 0) > 0 ||
        (entry.requirement.appliesTo.requiresAny?.length ?? 0) > 0
      if (conditionnee) expect(entry.reasons.length).toBeGreaterThan(0)
    }
  })

  it('le tri est stable d’un appel a l’autre', () => {
    const overrides = { property_type: 'appartement', regime: 'copropriete' } as const
    expect(keysFor(overrides)).toEqual(keysFor(overrides))
  })

  it('documentRequirementsFor exclut les regles sans volet piece', () => {
    const keys = documentRequirementsFor(context({})).map((entry) => entry.requirement.key)
    expect(keys).not.toContain('shooting')
    expect(keys).not.toContain('visuels')
    expect(keys).toContain('titre_propriete')
  })
})

describe('invariants du referentiel', () => {
  it('toutes les cles sont uniques', () => {
    const keys = DOCUMENT_REQUIREMENTS.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('toutes les categories appartiennent a DOCUMENT_CATEGORY_OPTIONS', () => {
    for (const entry of DOCUMENT_REQUIREMENTS) {
      const category = entry.produces.document?.category
      if (!category) continue
      expect(DOCUMENT_CATEGORY_OPTIONS).toContain(category)
    }
  })

  it('chaque regle produit au moins un volet, piece ou action', () => {
    for (const entry of DOCUMENT_REQUIREMENTS) {
      expect(Boolean(entry.produces.document || entry.produces.action)).toBe(true)
    }
  })

  it('aucune regle ne reference un SaleFlag inexistant', () => {
    for (const entry of DOCUMENT_REQUIREMENTS) {
      const cited = [
        ...(entry.appliesTo.requires ?? []),
        ...(entry.appliesTo.requiresAny ?? []),
        ...(entry.appliesTo.excludes ?? []),
      ]
      for (const flag of cited) expect(SALE_FLAGS).toContain(flag)
    }
  })

  it('la liste des cles est stable', () => {
    // Toute suppression ou renommage de cle laisse des lignes orphelines en
    // base : ce snapshot force a passer par `deprecated` plutot que par une
    // suppression silencieuse.
    expect(DOCUMENT_REQUIREMENTS.map((entry) => entry.key).sort()).toMatchSnapshot()
  })
})

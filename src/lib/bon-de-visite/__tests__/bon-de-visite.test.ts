import { describe, it, expect } from 'vitest'
import {
  getLegalText,
  BON_DE_VISITE_ADVISOR,
  OFFICIAL_DOCUMENT_HEADER,
  OFFICIAL_ENGAGEMENT_TEXT,
  OFFICIAL_PRESTATAIRE_LEGAL_TEXT,
} from '../legal'
import { buildBonDeVisiteEmail } from '../../email/bon-de-visite-template'
import type { BonDeVisite, VisitorInfo } from '../types'

describe('Bon de Visite - Mentions légales officielles iad', () => {
  it('contient les engagements du visiteur et la clause d’éviction 12 mois', () => {
    const text = getLegalText()
    expect(text).toContain('Prestataire de services')
    expect(text).toContain('12 mois')
    expect(text).toContain('entière réparation du préjudice')
  })

  it('fournit les constantes du conseiller iad et du siège I@D France SAS', () => {
    expect(BON_DE_VISITE_ADVISOR.name).toBe('Alexandre LOPEZ')
    expect(BON_DE_VISITE_ADVISOR.phone).toBe('06 13 18 01 68')
    expect(BON_DE_VISITE_ADVISOR.email).toBe('alexandre.lopez@iadfrance.fr')
    expect(OFFICIAL_DOCUMENT_HEADER.title).toBe("BON DE RECHERCHE, D'INDICATION ET DE VISITE")
    expect(OFFICIAL_PRESTATAIRE_LEGAL_TEXT).toContain('CPI 7702 2018 000 028 002')
  })
})

describe('Bon de Visite - Email Template', () => {
  it('génère un email officiel avec les visiteurs, le bien et le lien du document', () => {
    const mockVisitor: VisitorInfo = {
      first_name: 'Jean',
      last_name: 'Dupont',
      cni_number: '123456789012',
      email: 'jean.dupont@test.fr',
      phone: '0612345678',
    }

    const mockBon: BonDeVisite = {
      id: 'test-id-123',
      reference: 'BV-2026-001',
      token: 'test-token-abc',
      project_id: null,
      property_address: '14 Rue des Lavandes',
      property_city: 'Barjols',
      property_zipcode: '83670',
      property_type: 'Maison',
      property_price: 320000,
      mandate_ref: 'M-2026-012',
      visit_at: '2026-08-28T14:00:00.000Z',
      visitors_count: 1,
      visitors: [mockVisitor],
      legal_text: getLegalText(),
      signature_data_url: 'data:image/png;base64,mock',
      signer_name: 'Jean Dupont',
      advisor_name: 'Alexandre LOPEZ',
      advisor_email: 'alexandre.lopez@iadfrance.fr',
      advisor_phone: '06 13 18 01 68',
      advisor_rsac: 'RSAC de Draguignan n° 908 906 423',
      email_status: 'pending',
      email_sent_at: null,
      notes: 'Visite positive',
      created_at: '2026-08-28T14:00:00.000Z',
      updated_at: '2026-08-28T14:00:00.000Z',
    }

    const email = buildBonDeVisiteEmail({
      bon: mockBon,
      recipient: mockVisitor,
      documentUrl: 'http://localhost:3002/bon-de-visite/test-token-abc',
    })

    expect(email.subject).toContain('BV-2026-001')
    expect(email.subject).toContain('Barjols')
    expect(email.html).toContain("BON DE RECHERCHE, D'INDICATION ET DE VISITE")
    expect(email.html).toContain('Bonjour Jean,')
    expect(email.html).toContain('14 Rue des Lavandes')
    expect(email.html).toContain('123456789012')
    expect(email.html).toContain('http://localhost:3002/bon-de-visite/test-token-abc')
    expect(email.text).toContain('Jean Dupont')
  })
})

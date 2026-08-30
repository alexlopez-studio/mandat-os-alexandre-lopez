import { describe, expect, it } from 'vitest'

import { assessGranolaFreshness } from '@/lib/integrations/granola/connection'
import { gradeNextStep, hasIdentityHook, normalizeExtraction } from '@/lib/integrations/granola/extraction'
import { matchMeetingToProject, type ProjectCandidate } from '@/lib/integrations/granola/matching'
import { parseGranolaDate, parseGranolaMeetings } from '@/lib/integrations/granola/parse'
import { mergeMeetings } from '@/lib/integrations/granola/sync'
import type { GranolaMeeting } from '@/lib/integrations/granola/types'

/**
 * Reponse reelle du MCP Granola (plan Basic), reprise telle quelle.
 *
 * C'est le format que l'ingestion doit lire : du balisage texte, pas du JSON.
 * Un attribut mal lu casse l'idempotence, `external_id` etant la moitie de la
 * cle unique `(provider, external_id)`.
 */
const MCP_LIST_RESPONSE = `<access_notice>Results exclude public workspace notes because of your Granola plan.</access_notice>

<meetings_data from="Aug 22, 2026" to="Aug 24, 2026" count="2">
<meeting id="b4eca71e-0668-4fda-836e-e275e31710fb" title="Action plan for Claude&apos;s mandate" date="Aug 24, 2026 6:08 PM GMT+2" captured_by_me="true" listed_as_participant="true" is_workspace_visible="false">
    <known_participants>
    Alexandre Lopez (note creator) from IAD &lt;alexlopez.studio@gmail.com&gt;
    </known_participants>
  </meeting>

<meeting id="0b810a47-5160-4242-9dde-814b590de6f1" title="R1 - Claude Hugues" date="Aug 22, 2026 10:34 AM GMT+2" captured_by_me="true" listed_as_participant="true" is_workspace_visible="false">
    <known_participants>
    Alexandre Lopez (note creator) from IAD &lt;alexlopez.studio@gmail.com&gt;
    </known_participants>
  </meeting>
</meetings_data>`

const MCP_DETAIL_RESPONSE = `<meetings_data from="Aug 22, 2026" to="Aug 24, 2026" count="1">
<meeting id="0b810a47-5160-4242-9dde-814b590de6f1" title="R1 - Claude Hugues" date="Aug 22, 2026 10:34 AM GMT+2">
  <known_participants>
  Alexandre Lopez (note creator) from IAD &lt;alexlopez.studio@gmail.com&gt;
  </known_participants>

  <summary>
### Bien Immobilier
- Maison de village ancienne a Barjols, succession parentale
- Surface: 67 m2 habitables + cave amenageable

### Prochaines Etapes
- **Appeler Frederic** — suivi de la situation juridique liee a la succession.
  </summary>
</meeting>
</meetings_data>`

describe('parseGranolaMeetings — balisage MCP', () => {
  it('lit les deux reunions avec leur identifiant Granola', () => {
    const meetings = parseGranolaMeetings(MCP_LIST_RESPONSE)

    expect(meetings).toHaveLength(2)
    expect(meetings.map((meeting) => meeting.external_id)).toEqual([
      'b4eca71e-0668-4fda-836e-e275e31710fb',
      '0b810a47-5160-4242-9dde-814b590de6f1',
    ])
  })

  it('decode les entites du titre', () => {
    const [first] = parseGranolaMeetings(MCP_LIST_RESPONSE)
    expect(first.title).toBe("Action plan for Claude's mandate")
  })

  it('extrait le resume structure du detail', () => {
    const [meeting] = parseGranolaMeetings(MCP_DETAIL_RESPONSE)
    expect(meeting.summary).toContain('Maison de village ancienne a Barjols')
    expect(meeting.summary).toContain('Appeler Frederic')
  })

  it('lit les participants et leur e-mail', () => {
    const [meeting] = parseGranolaMeetings(MCP_DETAIL_RESPONSE)
    expect(meeting.participants).toHaveLength(1)
    expect(meeting.participants[0].email).toBe('alexlopez.studio@gmail.com')
    expect(meeting.participants[0].name).toBe('Alexandre Lopez')
  })

  it('normalise le decalage horaire court de Granola', () => {
    expect(parseGranolaDate('Aug 22, 2026 10:34 AM GMT+2')).toBe('2026-08-22T08:34:00.000Z')
    expect(parseGranolaDate('pas une date')).toBeNull()
    expect(parseGranolaDate(null)).toBeNull()
  })

  it('accepte aussi une charge JSON (webhook)', () => {
    const meetings = parseGranolaMeetings({
      meetings: [{ id: 'abc', title: 'RDV vendeur', date: '2026-08-22T08:34:00.000Z', summary: 'Resume' }],
    })

    expect(meetings).toHaveLength(1)
    expect(meetings[0].external_id).toBe('abc')
    expect(meetings[0].meeting_at).toBe('2026-08-22T08:34:00.000Z')
  })

  it('ignore une reunion sans identifiant : sans lui, aucune idempotence possible', () => {
    expect(parseGranolaMeetings({ meetings: [{ title: 'Sans id' }] })).toHaveLength(0)
  })
})

describe('mergeMeetings', () => {
  it('combine les metadonnees de la liste et le resume du detail', () => {
    const listed = parseGranolaMeetings(MCP_LIST_RESPONSE)
    const details = parseGranolaMeetings(MCP_DETAIL_RESPONSE)
    const merged = mergeMeetings(listed, details)

    expect(merged).toHaveLength(2)
    const claudeHugues = merged.find((m) => m.external_id === '0b810a47-5160-4242-9dde-814b590de6f1')
    expect(claudeHugues?.summary).toContain('Barjols')
    expect(claudeHugues?.meeting_at).toBe('2026-08-22T08:34:00.000Z')
  })
})

describe('matchMeetingToProject', () => {
  const projects: ProjectCandidate[] = [
    {
      id: 'projet-barjols',
      title: 'Vente maison — Joseph & Régine — Barjols',
      reference: '26-002',
      stage: 'Commercialisation & Visites',
      seller_name: 'Joseph & Régine',
      property_city: 'Barjols',
      property_address: null,
      visit_at: null,
    },
    {
      id: 'projet-saint-maximin',
      title: 'Vente maison — Silvia Vedrines — Saint-Maximin',
      reference: '26-003',
      stage: 'Compromis signé',
      seller_name: 'Silvia Vedrines',
      property_city: 'Saint-Maximin-la-Sainte-Baume',
      property_address: null,
      visit_at: null,
    },
  ]

  function meeting(overrides: Partial<GranolaMeeting>): GranolaMeeting {
    return {
      external_id: 'test',
      title: 'RDV',
      meeting_at: '2026-08-22T08:34:00.000Z',
      summary: null,
      participants: [],
      raw: {},
      ...overrides,
    }
  }

  it('reconnait la commune citee dans le resume', () => {
    const match = matchMeetingToProject(
      meeting({ summary: 'Maison de village ancienne a Barjols, succession parentale' }),
      projects,
    )

    expect(match.project?.id).toBe('projet-barjols')
    expect(match.reasons.join(' ')).toContain('Barjols')
  })

  it('donne plus de poids au vendeur cite dans le titre', () => {
    const match = matchMeetingToProject(meeting({ title: 'R2 - Silvia Vedrines' }), projects)

    expect(match.project?.id).toBe('projet-saint-maximin')
    expect(match.score).toBeGreaterThanOrEqual(0.45)
  })

  it('reconnait une commune abregee (Saint-Maximin pour Saint-Maximin-la-Sainte-Baume)', () => {
    const match = matchMeetingToProject(meeting({ summary: 'Visite du bien a Saint-Maximin' }), projects)
    expect(match.project?.id).toBe('projet-saint-maximin')
  })

  it('rend un score nul et un motif lisible quand rien ne correspond', () => {
    const match = matchMeetingToProject(meeting({ title: 'Point interne outillage' }), projects)

    expect(match.project).toBeNull()
    expect(match.score).toBe(0)
    expect(match.reasons[0]).toContain('Aucun signal')
  })

  it('rapproche une reunion de la date de visite planifiee', () => {
    const withVisit: ProjectCandidate[] = [
      { ...projects[0], property_city: null, seller_name: null, visit_at: '2026-08-22T09:00:00.000Z' },
    ]
    const match = matchMeetingToProject(meeting({ title: 'RDV' }), withVisit)

    expect(match.project?.id).toBe('projet-barjols')
    expect(match.reasons.join(' ')).toContain('Visite planifiee')
  })
})

describe('hasIdentityHook — « Appeler Frederic » est une tache, pas un contact', () => {
  it('refuse une personne citee sans e-mail ni telephone', () => {
    expect(hasIdentityHook({ name: 'Frederic', role: null, email: null, phone: null })).toBe(false)
  })

  it('refuse un nom complet sans role ni coordonnees', () => {
    expect(hasIdentityHook({ name: 'Frederic Martin', role: null, email: null, phone: null })).toBe(false)
  })

  it('accepte un e-mail', () => {
    expect(hasIdentityHook({ name: 'Frederic', role: null, email: 'f@notaire.fr', phone: null })).toBe(true)
  })

  it('accepte un telephone', () => {
    expect(hasIdentityHook({ name: 'Frederic', role: null, email: null, phone: '06 12 34 56 78' })).toBe(true)
  })

  it('accepte un nom complet assorti d’un role dans l’affaire', () => {
    expect(hasIdentityHook({ name: 'Frederic Martin', role: 'notaire', email: null, phone: null })).toBe(true)
  })
})

describe('normalizeExtraction', () => {
  it('valide et complete une reponse partielle du modele', () => {
    const extraction = normalizeExtraction(
      JSON.stringify({
        property: { surface: 67, commune: 'Barjols' },
        prices: [{ label: 'net vendeur', amount: '70 000 €' }],
        next_steps: [{ title: 'Appeler Frederic' }, { detail: 'sans titre' }],
        people: [{ name: 'Frederic', role: 'notaire' }, { role: 'sans nom' }],
      }),
    )

    expect(extraction.property.surface).toBe(67)
    expect(extraction.prices[0].amount).toBe(70000)
    expect(extraction.next_steps).toHaveLength(1)
    expect(extraction.next_steps[0].priority).toBe('normale')
    expect(extraction.people).toHaveLength(1)
    expect(extraction.blockers).toEqual([])
  })

  it('tolere un JSON encadre de balises markdown', () => {
    const extraction = normalizeExtraction('```json\n{"summary_note":"Trois phrases."}\n```')
    expect(extraction.summary_note).toBe('Trois phrases.')
  })

  it('refuse une reponse qui n’est pas du JSON', () => {
    expect(() => normalizeExtraction('desole, je ne peux pas')).toThrow(/JSON/)
  })
})

describe('assessGranolaFreshness — fenetre de 30 jours du plan gratuit', () => {
  function isoDaysAgo(days: number) {
    return new Date(Date.now() - days * 86_400_000).toISOString()
  }

  it('alerte des 20 jours, avant la perte definitive', () => {
    const freshness = assessGranolaFreshness(isoDaysAgo(21))
    expect(freshness.stale).toBe(true)
    expect(freshness.lost_window).toBe(false)
    expect(freshness.message).toContain('perte definitive')
  })

  it('signale la fenetre perdue au-dela de 30 jours', () => {
    const freshness = assessGranolaFreshness(isoDaysAgo(31))
    expect(freshness.lost_window).toBe(true)
  })

  it('reste silencieuse tant que la synchronisation est recente', () => {
    const freshness = assessGranolaFreshness(isoDaysAgo(2))
    expect(freshness.stale).toBe(false)
    expect(freshness.message).toBeNull()
  })

  it('traite l’absence de synchronisation comme une alerte', () => {
    expect(assessGranolaFreshness(null).stale).toBe(true)
  })
})

describe('gradeNextStep — la frontiere que le dispatch autonome ne franchit pas', () => {
  it('classe une tache interne en risque faible', () => {
    expect(gradeNextStep('Recuperer le DPE et les metrages laser')).toEqual({
      action_type: 'create_activity',
      risk_level: 'low',
    })
    expect(gradeNextStep('Appeler Frederic').risk_level).toBe('low')
  })

  it('classe un envoi d’e-mail en risque eleve', () => {
    expect(gradeNextStep('Envoyer le mail de synthese aux vendeurs')).toEqual({
      action_type: 'draft_email',
      risk_level: 'high',
    })
  })

  it('classe une publication en risque eleve', () => {
    expect(gradeNextStep("Mettre l'annonce en ligne directement").risk_level).toBe('high')
    expect(gradeNextStep('Publier une story sur le compte ES').action_type).toBe('publish_listing')
  })

  it('reconnait une mise en ligne dont le libelle est enrichi', () => {
    // Formulation reelle relevee sur un compte rendu : le mot « annonce » et
    // « en ligne » sont separes par le nom du bien.
    expect(gradeNextStep("Mettre l'annonce Barjol en ligne directement, sans teasing").risk_level).toBe('high')
    expect(gradeNextStep("Booster l'annonce en publicite payante le lendemain").risk_level).toBe('high')
  })

  it('classe une modification de prix affiche en risque eleve', () => {
    expect(gradeNextStep('Baisser le prix affiche de 5 000 €')).toEqual({
      action_type: 'update_public_price',
      risk_level: 'high',
    })
  })

  it('ignore les accents et la casse', () => {
    expect(gradeNextStep('ENVOYER UN MAIL AU NOTAIRE').risk_level).toBe('high')
    expect(gradeNextStep('Diffuser l’annonce').risk_level).toBe('high')
  })
})

describe('cityVariants via matchMeetingToProject — « Barjol » dicte pour « Barjols »', () => {
  it('reconnait la commune malgre le s final absent', () => {
    const match = matchMeetingToProject(
      {
        external_id: 'x',
        title: 'Plan de lancement',
        meeting_at: null,
        summary: 'Barjol : strategie simplifiee, mettre l’annonce en ligne directement',
        participants: [],
        raw: {},
      },
      [
        {
          id: 'projet-barjols',
          title: 'Vente maison — Barjols',
          reference: '26-002',
          stage: null,
          seller_name: null,
          property_city: 'Barjols',
          property_address: null,
          visit_at: null,
        },
      ],
    )

    expect(match.project?.id).toBe('projet-barjols')
    expect(match.score).toBeGreaterThan(0)
  })
})

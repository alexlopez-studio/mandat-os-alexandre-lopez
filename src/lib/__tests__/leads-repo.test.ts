/**
 * Tests unitaires du repository leads.
 * Mock du client Supabase via une chaîne fluente recordable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type MockResponse<T> = { data: T | null; error: { message: string } | null }
let mockResponses: Record<string, MockResponse<unknown>> = {}
let fromCalls: string[] = []

function makeChain(table: string) {
  const chain: Record<string, unknown> = {}
  chain.insert = vi.fn(() => chain)
  chain.upsert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.single = vi.fn(() =>
    Promise.resolve(
      mockResponses[`${table}.single`] ?? { data: null, error: null },
    ),
  )
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve(
      mockResponses[`${table}.maybeSingle`] ?? { data: null, error: null },
    ),
  )
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      fromCalls.push(table)
      return makeChain(table)
    }),
  },
}))

import {
  upsertProspect,
  createLead,
  getLeadById,
  updateLeadStatus,
  appendEvent,
  RepoError,
} from '../leads-repo'

beforeEach(() => {
  mockResponses = {}
  fromCalls = []
  vi.clearAllMocks()
})

describe('leads-repo', () => {
  describe('upsertProspect', () => {
    it('returns the upserted prospect on success', async () => {
      const fakeProspect = {
        id: 'p-1',
        email: 'jane@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        phone: null,
        rgpd_consent_at: '2026-05-03T12:00:00.000Z',
        created_at: '2026-05-03T12:00:00.000Z',
        updated_at: '2026-05-03T12:00:00.000Z',
      }
      mockResponses['prospects.single'] = { data: fakeProspect, error: null }

      const result = await upsertProspect({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      })

      expect(result).toEqual(fakeProspect)
      expect(fromCalls).toContain('prospects')
    })

    it('throws RepoError when supabase returns an error', async () => {
      mockResponses['prospects.single'] = {
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      }

      await expect(
        upsertProspect({ email: 'broken@example.com' }),
      ).rejects.toBeInstanceOf(RepoError)
    })

    it('throws RepoError when no data returned without error', async () => {
      mockResponses['prospects.single'] = { data: null, error: null }
      await expect(
        upsertProspect({ email: 'empty@example.com' }),
      ).rejects.toBeInstanceOf(RepoError)
    })
  })

  describe('createLead', () => {
    it('inserts and returns the new lead', async () => {
      const fakeLead = {
        id: 'lead-uuid-1',
        prospect_id: 'p-1',
        tool: 'vendre' as const,
        status: 'nouveau' as const,
        form_data: {},
        results: {},
        commune: 'Brignoles',
        magic_link_expires_at: '2026-06-02T12:00:00.000Z',
        magic_link_sent_at: null,
        deleted_at: null,
        created_at: '2026-05-03T12:00:00.000Z',
        updated_at: '2026-05-03T12:00:00.000Z',
      }
      mockResponses['leads.single'] = { data: fakeLead, error: null }

      const result = await createLead({
        prospectId: 'p-1',
        tool: 'vendre',
        commune: 'Brignoles',
      })

      expect(result.id).toBe('lead-uuid-1')
      expect(result.tool).toBe('vendre')
      expect(result.status).toBe('nouveau')
      expect(fromCalls).toContain('leads')
    })

    it('throws RepoError on supabase error', async () => {
      mockResponses['leads.single'] = {
        data: null,
        error: { message: 'foreign key violation' },
      }
      await expect(
        createLead({ prospectId: 'p-missing', tool: 'audit' }),
      ).rejects.toBeInstanceOf(RepoError)
    })
  })

  describe('getLeadById', () => {
    it('returns the lead with prospect joined when found', async () => {
      const fakeLeadWithProspect = {
        id: 'lead-uuid-1',
        prospect_id: 'p-1',
        tool: 'audit' as const,
        status: 'nouveau' as const,
        form_data: { adresse: '12 rue X' },
        results: { score_global: 75 },
        commune: null,
        magic_link_expires_at: '2026-06-02T12:00:00.000Z',
        magic_link_sent_at: null,
        deleted_at: null,
        created_at: '2026-05-03T12:00:00.000Z',
        updated_at: '2026-05-03T12:00:00.000Z',
        prospect: {
          id: 'p-1',
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          phone: null,
        },
      }
      mockResponses['leads.maybeSingle'] = {
        data: fakeLeadWithProspect,
        error: null,
      }

      const result = await getLeadById('lead-uuid-1')
      expect(result).not.toBeNull()
      expect(result!.prospect.email).toBe('jane@example.com')
    })

    it('returns null when no row found', async () => {
      mockResponses['leads.maybeSingle'] = { data: null, error: null }
      const result = await getLeadById('missing-id')
      expect(result).toBeNull()
    })

    it('throws RepoError on supabase error', async () => {
      mockResponses['leads.maybeSingle'] = {
        data: null,
        error: { message: 'connection lost' },
      }
      await expect(getLeadById('any')).rejects.toBeInstanceOf(RepoError)
    })
  })

  describe('appendEvent', () => {
    it('inserts an event and returns it', async () => {
      const fakeEvent = {
        id: 'ev-1',
        lead_id: 'lead-uuid-1',
        kind: 'note' as const,
        payload: { text: 'Appelé le client' },
        created_by: 'admin@example.com',
        created_at: '2026-05-03T13:00:00.000Z',
      }
      mockResponses['lead_events.single'] = { data: fakeEvent, error: null }

      const result = await appendEvent({
        leadId: 'lead-uuid-1',
        kind: 'note',
        payload: { text: 'Appelé le client' },
        createdBy: 'admin@example.com',
      })

      expect(result.kind).toBe('note')
      expect(result.created_by).toBe('admin@example.com')
    })
  })

  describe('updateLeadStatus', () => {
    it('updates status and appends a status_change event', async () => {
      const fakeLead = {
        id: 'lead-uuid-1',
        prospect_id: 'p-1',
        tool: 'vendre' as const,
        status: 'r1' as const,
        form_data: {},
        results: {},
        commune: null,
        magic_link_expires_at: '2026-06-02T12:00:00.000Z',
        magic_link_sent_at: null,
        deleted_at: null,
        created_at: '2026-05-03T12:00:00.000Z',
        updated_at: '2026-05-03T13:00:00.000Z',
      }
      const fakeEvent = {
        id: 'ev-1',
        lead_id: 'lead-uuid-1',
        kind: 'status_change' as const,
        payload: { status: 'r1' },
        created_by: 'admin@example.com',
        created_at: '2026-05-03T13:00:00.000Z',
      }
      mockResponses['leads.single'] = { data: fakeLead, error: null }
      mockResponses['lead_events.single'] = { data: fakeEvent, error: null }

      const result = await updateLeadStatus({
        leadId: 'lead-uuid-1',
        status: 'r1',
        changedBy: 'admin@example.com',
      })

      expect(result.status).toBe('r1')
      // Vérifie que les deux tables ont bien été sollicitées
      expect(fromCalls).toContain('leads')
      expect(fromCalls).toContain('lead_events')
    })

    it('throws RepoError when update fails', async () => {
      mockResponses['leads.single'] = {
        data: null,
        error: { message: 'row not found' },
      }
      await expect(
        updateLeadStatus({ leadId: 'missing', status: 'vendu' }),
      ).rejects.toBeInstanceOf(RepoError)
    })
  })
})

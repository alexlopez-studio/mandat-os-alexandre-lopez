import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/market/client-admin', () => ({
  rejectIfNoAdmin: vi.fn(() => null),
}))

vi.mock('@/lib/client-portal', () => ({
  ensureClientDossierForBuyer: vi.fn(),
  ensureClientDossierForLead: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  opportunity: {
    data: { id: 'opp-1', lead_id: 'lead-1', stage: 'Mandat signé' },
    error: null as unknown,
  },
  buyer: {
    data: { lead_id: 'buyer-1', stage: 'Mandat de recherche signé' },
    error: null as unknown,
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.maybeSingle = vi.fn(() => {
        if (table === 'opportunities') return Promise.resolve(mocks.opportunity)
        if (table === 'buyer_criteria') return Promise.resolve(mocks.buyer)
        return Promise.resolve({ data: null, error: null })
      })
      return chain
    }),
  },
}))

import { ensureClientDossierForBuyer, ensureClientDossierForLead } from '@/lib/client-portal'
import { POST } from '../route'

const mockedEnsureClientDossierForBuyer = vi.mocked(ensureClientDossierForBuyer)
const mockedEnsureClientDossierForLead = vi.mocked(ensureClientDossierForLead)

function makeRequest(body: unknown): NextRequest {
  return new Request('https://preview.alexlopez-provence.fr/api/market/clients', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

function dossier(id: string) {
  return {
    profile: {
      id: 'profile-1',
      user_id: null,
      email: 'client@example.com',
      first_name: 'Client',
      last_name: 'Test',
      phone: null,
      is_active: true,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    },
    dossier: {
      id,
      client_profile_id: 'profile-1',
      lead_id: null,
      seller_property_id: null,
      opportunity_id: null,
      client_type: 'seller',
      buyer_lead_id: null,
      public_token: `${id}-token`,
      status: 'active',
      title: 'Client',
      property_snapshot: {},
      professional_opinion: {},
      personalization: {},
      advisor_note: null,
      client_welcome_seen_at: null,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.opportunity = { data: { id: 'opp-1', lead_id: 'lead-1', stage: 'Mandat signé' }, error: null }
  mocks.buyer = { data: { lead_id: 'buyer-1', stage: 'Mandat de recherche signé' }, error: null }
  mockedEnsureClientDossierForLead.mockResolvedValue(dossier('seller-client-1'))
  mockedEnsureClientDossierForBuyer.mockResolvedValue(dossier('buyer-client-1'))
})

describe('POST /api/market/clients', () => {
  it('refuses seller client follow-up creation before estimation delivery', async () => {
    mocks.opportunity = { data: { id: 'opp-1', lead_id: 'lead-1', stage: 'Pré-estimation' }, error: null }

    const res = await POST(makeRequest({ client_type: 'seller', opportunity_id: 'opp-1' }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.success).toBe(false)
    expect(mockedEnsureClientDossierForLead).not.toHaveBeenCalled()
  })

  it('creates seller client follow-up from the estimation delivery stage', async () => {
    mocks.opportunity = { data: { id: 'opp-1', lead_id: 'lead-1', stage: "Remise de l'estimation" }, error: null }

    const res = await POST(makeRequest({ client_type: 'seller', opportunity_id: 'opp-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('seller-client-1')
    expect(mockedEnsureClientDossierForLead).toHaveBeenCalledWith('lead-1', 'opp-1')
  })

  it('creates or attaches seller client from signed opportunity', async () => {
    const res = await POST(makeRequest({ client_type: 'seller', opportunity_id: 'opp-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('seller-client-1')
    expect(mockedEnsureClientDossierForLead).toHaveBeenCalledWith('lead-1', 'opp-1')
  })

  it('creates or attaches buyer client from signed search mandate', async () => {
    const res = await POST(makeRequest({ client_type: 'buyer', buyer_lead_id: 'buyer-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('buyer-client-1')
    expect(mockedEnsureClientDossierForBuyer).toHaveBeenCalledWith('buyer-1')
  })
})

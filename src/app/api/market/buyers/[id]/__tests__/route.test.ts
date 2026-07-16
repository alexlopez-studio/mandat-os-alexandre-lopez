import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/client-portal', () => ({
  ensureClientDossierForBuyer: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  buyerEmailCheck: { data: { lead_id: 'buyer-1', prospect_id: null as string | null }, error: null as unknown },
  prospectEmailCheck: { data: null as { email: string | null } | null, error: null as unknown },
  leadEmailCheck: { data: null as unknown, error: null as unknown },
  updateResponse: {
    data: {
      id: 'criteria-1',
      lead_id: 'buyer-1',
      prospect_id: null,
      type_bien: 'maison',
      communes: ['Cotignac'],
      budget_max: 450000,
      surface_min: null,
      pieces_min: null,
      criteres: null,
      active: true,
      stage: 'Mandat de recherche signé',
      next_action: null,
      due_date: null,
      matched_at: null,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    },
    error: null as unknown,
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = { table, mode: 'select' }
      chain.select = vi.fn(() => chain)
      chain.update = vi.fn(() => {
        chain.mode = 'update'
        return chain
      })
      chain.eq = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve(mocks.updateResponse))
      chain.maybeSingle = vi.fn(() => {
        if (table === 'buyer_criteria') return Promise.resolve(mocks.buyerEmailCheck)
        if (table === 'prospects') return Promise.resolve(mocks.prospectEmailCheck)
        if (table === 'leads') return Promise.resolve(mocks.leadEmailCheck)
        return Promise.resolve({ data: null, error: null })
      })
      return chain
    }),
  },
}))

import { ensureClientDossierForBuyer } from '@/lib/client-portal'
import { PUT } from '../route'

const mockedEnsureClientDossierForBuyer = vi.mocked(ensureClientDossierForBuyer)

function makeRequest(body: unknown): NextRequest {
  return new Request('https://preview.alexlopez-provence.fr/api/market/buyers/buyer-1', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.buyerEmailCheck = { data: { lead_id: 'buyer-1', prospect_id: null }, error: null }
  mocks.prospectEmailCheck = { data: null, error: null }
  mocks.leadEmailCheck = { data: null, error: null }
  mockedEnsureClientDossierForBuyer.mockResolvedValue({
    profile: {
      id: 'profile-1',
      user_id: null,
      email: 'buyer@example.com',
      first_name: 'Alex',
      last_name: 'Buyer',
      phone: null,
      is_active: true,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    },
    dossier: {
      id: 'dossier-1',
      client_profile_id: 'profile-1',
      lead_id: null,
      seller_property_id: null,
      opportunity_id: null,
      client_type: 'buyer',
      buyer_lead_id: 'buyer-1',
      public_token: 'buyer-token',
      status: 'active',
      title: 'Recherche acquéreur',
      property_snapshot: {},
      professional_opinion: {},
      personalization: {},
      advisor_note: null,
      client_welcome_seen_at: null,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    },
  })
})

describe('PUT /api/market/buyers/[id]', () => {
  it('refuses signed search mandate without buyer email', async () => {
    const res = await PUT(makeRequest({ stage: 'Mandat de recherche signé' }), {
      params: Promise.resolve({ id: 'buyer-1' }),
    })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toContain('Email acquéreur requis')
    expect(mockedEnsureClientDossierForBuyer).not.toHaveBeenCalled()
  })

  it('creates or attaches buyer client dossier on signed search mandate', async () => {
    mocks.buyerEmailCheck = { data: { lead_id: 'buyer-1', prospect_id: 'prospect-1' }, error: null }
    mocks.prospectEmailCheck = { data: { email: 'buyer@example.com' }, error: null }

    const res = await PUT(makeRequest({ stage: 'Mandat de recherche signé' }), {
      params: Promise.resolve({ id: 'buyer-1' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.client_dossier.id).toBe('dossier-1')
    expect(mockedEnsureClientDossierForBuyer).toHaveBeenCalledWith('buyer-1')
  })
})

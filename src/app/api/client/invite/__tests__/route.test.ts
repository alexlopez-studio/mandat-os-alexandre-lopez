import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/client-portal', () => ({
  ensureClientDossierForLead: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentAdmin: vi.fn().mockResolvedValue({ id: 'admin-1' }),
}))

vi.mock('@/lib/resend', () => ({
  sendClientPortalInviteEmail: vi.fn().mockResolvedValue(true),
}))

const mocks = vi.hoisted(() => ({
  opportunityResponse: { data: null as unknown, error: null as unknown },
  generateLink: vi.fn(),
  signInWithOtp: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        generateLink: mocks.generateLink,
      },
    },
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = vi.fn(() => chain)
      chain.maybeSingle = vi.fn(() => Promise.resolve(mocks.opportunityResponse))
      return chain
    }),
  },
  supabase: {
    auth: {
      signInWithOtp: mocks.signInWithOtp,
    },
  },
}))

import { ensureClientDossierForLead } from '@/lib/client-portal'
import { sendClientPortalInviteEmail } from '@/lib/resend'
import { POST } from '../route'

const mockedEnsureClientDossierForLead = vi.mocked(ensureClientDossierForLead)
const mockedSendClientPortalInviteEmail = vi.mocked(sendClientPortalInviteEmail)

function makeRequest(body: unknown): NextRequest {
  return new Request('https://preview.alexlopez-provence.fr/api/client/invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.opportunityResponse = { data: null, error: null }
  mocks.generateLink.mockResolvedValue({
    data: { properties: { action_link: 'https://magic.example/link' } },
    error: null,
  })
  mocks.signInWithOtp.mockResolvedValue({ error: null })
  mockedEnsureClientDossierForLead.mockResolvedValue({
    profile: {
      id: 'profile-1',
      user_id: null,
      email: 'seller@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      phone: null,
      is_active: true,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    },
    dossier: {
      id: 'dossier-1',
      client_profile_id: 'profile-1',
      lead_id: 'lead-1',
      seller_property_id: null,
      opportunity_id: 'opp-1',
      client_type: 'seller',
      buyer_lead_id: null,
      status: 'active',
      title: 'Projet vendeur',
      property_snapshot: {},
      professional_opinion: {},
      advisor_note: null,
      client_welcome_seen_at: null,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    },
  })
})

describe('POST /api/client/invite', () => {
  it('refuses a lead without signed opportunity', async () => {
    const res = await POST(makeRequest({ lead_id: 'lead-1' }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.success).toBe(false)
    expect(mockedEnsureClientDossierForLead).not.toHaveBeenCalled()
  })

  it('refuses a lead with a pre-mandate opportunity', async () => {
    mocks.opportunityResponse = { data: { id: 'opp-1', stage: 'Nouveau contact', title: 'Projet vendeur' }, error: null }

    const res = await POST(makeRequest({ lead_id: 'lead-1' }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.success).toBe(false)
    expect(mockedEnsureClientDossierForLead).not.toHaveBeenCalled()
  })

  it('creates and sends the client invite for a signed opportunity', async () => {
    mocks.opportunityResponse = { data: { id: 'opp-1', stage: 'Mandat signé', title: 'Projet vendeur' }, error: null }

    const res = await POST(makeRequest({ lead_id: 'lead-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.dossier_id).toBe('dossier-1')
    expect(mockedEnsureClientDossierForLead).toHaveBeenCalledWith('lead-1')
    expect(mockedSendClientPortalInviteEmail).toHaveBeenCalledOnce()
  })
})

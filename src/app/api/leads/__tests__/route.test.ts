/**
 * Tests intégration de POST /api/leads (v2).
 * Mocks : repo, Resend, computeLeadResults.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/leads-repo', () => {
  class RepoError extends Error {
    readonly fn: string
    readonly cause: unknown
    constructor(fn: string, message: string, cause?: unknown) {
      super(`[leads-repo:${fn}] ${message}`)
      this.name = 'RepoError'
      this.fn = fn
      this.cause = cause
    }
  }
  return {
    upsertProspect: vi.fn(),
    createLead: vi.fn(),
    markMagicLinkSent: vi.fn(),
    RepoError,
  }
})

vi.mock('@/lib/resend', () => ({
  sendMagicLinkEmail: vi.fn(),
}))

vi.mock('@/lib/leads/compute-results', () => ({
  computeLeadResults: vi.fn(),
}))

vi.mock('@/lib/leads-crm', () => ({
  asNumber: (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : null
  },
  asStringArray: (value: unknown) => Array.isArray(value) ? value : null,
  resolveCommune: (data: Record<string, unknown>) => typeof data.commune === 'string' ? data.commune : null,
  upsertSellerPropertyForLead: vi.fn().mockResolvedValue({ id: 'seller-property-1' }),
}))

vi.mock('@/lib/notion-estimations', () => ({
  saveEstimationToNotion: vi.fn().mockResolvedValue({ ok: false, skipped: true }),
}))

vi.mock('@/lib/attio', () => ({
  syncLeadToAttio: vi.fn().mockResolvedValue({ ok: false, skipped: true }),
}))

vi.mock('@/lib/server-analytics', () => ({
  logServerConversionEvent: vi.fn(),
}))

vi.mock('@/lib/market/matching-engine', () => ({
  runMatchingForBuyer: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/market/seller-opportunity', () => ({
  ensureSellerOpportunityForLead: vi.fn().mockResolvedValue({
    opportunity: { id: 'opportunity-1' },
    existing: false,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

import { POST } from '../route'
import {
  upsertProspect,
  createLead,
  markMagicLinkSent,
  RepoError,
} from '@/lib/leads-repo'
import { sendMagicLinkEmail } from '@/lib/resend'
import { computeLeadResults } from '@/lib/leads/compute-results'
import { ensureSellerOpportunityForLead } from '@/lib/market/seller-opportunity'
import type { NextRequest } from 'next/server'

const mockedUpsertProspect = vi.mocked(upsertProspect)
const mockedCreateLead = vi.mocked(createLead)
const mockedMarkMagicLinkSent = vi.mocked(markMagicLinkSent)
const mockedSendMagicLinkEmail = vi.mocked(sendMagicLinkEmail)
const mockedComputeLeadResults = vi.mocked(computeLeadResults)
const mockedEnsureSellerOpportunityForLead = vi.mocked(ensureSellerOpportunityForLead)

function makeRequest(body: unknown): NextRequest {
  return new Request('https://preview.alexlopez-provence.fr/api/leads', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

const FAKE_PROSPECT = {
  id: 'p-1',
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  phone: null,
  rgpd_consent_at: '2026-05-03T12:00:00.000Z',
  created_at: '2026-05-03T12:00:00.000Z',
  updated_at: '2026-05-03T12:00:00.000Z',
}

const FAKE_LEAD = {
  id: 'lead-uuid-1',
  prospect_id: 'p-1',
  tool: 'vendre' as const,
  status: 'nouveau' as const,
  form_data: {},
  results: {},
  commune: 'Brignoles',
  source_channel: 'estimation_site',
  priority: 'medium' as const,
  next_action: 'Qualifier la demande d’estimation',
  due_date: null,
  follow_up_at: null,
  magic_link_expires_at: '2026-06-02T12:00:00.000Z',
  magic_link_sent_at: null,
  deleted_at: null,
  created_at: '2026-05-03T12:00:00.000Z',
  updated_at: '2026-05-03T12:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedComputeLeadResults.mockResolvedValue({})
  mockedSendMagicLinkEmail.mockResolvedValue(true)
  mockedUpsertProspect.mockResolvedValue(FAKE_PROSPECT)
  mockedCreateLead.mockResolvedValue(FAKE_LEAD)
  mockedMarkMagicLinkSent.mockResolvedValue(undefined)
})

describe('POST /api/leads (v2)', () => {
  it('400 if email missing', async () => {
    const res = await POST(
      makeRequest({ type: 'vendre', opt_in: true }),
    )
    expect(res.status).toBe(400)
  })

  it('400 if type invalid', async () => {
    const res = await POST(
      makeRequest({
        email: 'a@b.com',
        type: 'unknown',
        opt_in: true,
      }),
    )
    expect(res.status).toBe(400)
  })

  it('400 if opt_in missing or false', async () => {
    const res = await POST(
      makeRequest({ email: 'a@b.com', type: 'vendre' }),
    )
    expect(res.status).toBe(400)
  })

  it('400 on invalid JSON body', async () => {
    const req = new Request(
      'https://preview.alexlopez-provence.fr/api/leads',
      {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      },
    ) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('200 happy path : upsert + create + email + mark sent', async () => {
    const res = await POST(
      makeRequest({
        prenom: 'Jane',
        nom: 'Doe',
        email: 'jane@example.com',
        telephone: '0612345678',
        type: 'vendre',
        form_data: {
          lat: 43.5,
          lng: 6.0,
          surface: 80,
          commune: 'Brignoles',
        },
        opt_in: true,
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.leadId).toBe('lead-uuid-1')
    expect(json.token).toBe('lead-uuid-1')
    expect(json.magicLinkUrl).toContain('/resultats/lead-uuid-1')
    expect(json.emailSent).toBe(true)

    expect(mockedUpsertProspect).toHaveBeenCalledOnce()
    expect(mockedUpsertProspect).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '0612345678',
      }),
    )
    expect(mockedCreateLead).toHaveBeenCalledOnce()
    expect(mockedCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        prospectId: 'p-1',
        tool: 'vendre',
        commune: 'Brignoles',
      }),
    )
    expect(mockedSendMagicLinkEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        token: 'lead-uuid-1',
        type: 'vendre',
      }),
    )
    expect(mockedMarkMagicLinkSent).toHaveBeenCalledWith('lead-uuid-1')
    expect(mockedEnsureSellerOpportunityForLead).toHaveBeenCalledWith('lead-uuid-1')
  })

  it('does not call markMagicLinkSent when email sending fails', async () => {
    mockedSendMagicLinkEmail.mockResolvedValueOnce(false)
    const res = await POST(
      makeRequest({
        email: 'jane@example.com',
        type: 'audit',
        form_data: {},
        opt_in: true,
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.emailSent).toBe(false)
    expect(mockedMarkMagicLinkSent).not.toHaveBeenCalled()
    expect(mockedEnsureSellerOpportunityForLead).not.toHaveBeenCalled()
  })

  it('500 if persistence fails (upsertProspect throws RepoError)', async () => {
    mockedUpsertProspect.mockRejectedValueOnce(
      new RepoError('upsertProspect', 'duplicate key'),
    )
    const res = await POST(
      makeRequest({
        email: 'jane@example.com',
        type: 'vendre',
        form_data: {},
        opt_in: true,
      }),
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('500 when computeLeadResults throws', async () => {
    mockedComputeLeadResults.mockRejectedValueOnce(new Error('DVF down'))
    const res = await POST(
      makeRequest({
        email: 'jane@example.com',
        type: 'vendre',
        form_data: { lat: 43.5, lng: 6.0, surface: 80 },
        opt_in: true,
      }),
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

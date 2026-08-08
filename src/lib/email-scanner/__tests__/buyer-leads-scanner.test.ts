import { describe, expect, it, vi, beforeEach } from 'vitest'
import { scanBuyerLeadsFromGmail } from '../buyer-leads-scanner'

vi.mock('@/lib/google/tokens', () => ({
  getGoogleAccessToken: vi.fn(),
}))

vi.mock('@/lib/supabase', () => {
  const mockFrom = vi.fn()
  return {
    supabaseAdmin: {
      from: mockFrom,
    },
  }
})

vi.mock('@/lib/email-scanner/ai-extract', () => ({
  extractBuyerLeadFromEmail: vi.fn(),
}))

vi.mock('@/lib/email-scanner/property-match', () => ({
  matchBuyerEmailToProperty: vi.fn().mockResolvedValue(null),
}))

import { getGoogleAccessToken } from '@/lib/google/tokens'
import { supabaseAdmin } from '@/lib/supabase'
import { extractBuyerLeadFromEmail } from '@/lib/email-scanner/ai-extract'
import { matchBuyerEmailToProperty } from '@/lib/email-scanner/property-match'

/** Capture les lignes insérées dans `buyer_lead_candidates`. */
let insertedCandidates: any[] = []

function mockSupabase(existingGmailIds: string[] = []) {
  vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
    if (table === 'buyer_lead_candidates') {
      return {
        select: () => Promise.resolve({ data: existingGmailIds.map((id) => ({ gmail_message_id: id })) }),
        insert: (payload: any) => {
          insertedCandidates.push(payload)
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'candidate-1' }, error: null }),
            }),
          }
        },
      } as any
    }

    if (table === 'lead_events') {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [] }) }),
      } as any
    }

    return {} as any
  })
}

function mockGmail(bodyText: string) {
  const globalFetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('/users/me/messages?')) {
      return { ok: true, json: async () => ({ messages: [{ id: 'msg-1', threadId: 't-1' }] }) } as any
    }
    if (url.includes('/users/me/messages/msg-1')) {
      return {
        ok: true,
        json: async () => ({
          id: 'msg-1',
          payload: {
            headers: [
              { name: 'Subject', value: 'Nouvelle demande SeLoger pour votre maison' },
              { name: 'From', value: 'no-reply@seloger.com' },
              { name: 'Date', value: 'Sat, 08 Aug 2026 22:00:00 GMT' },
            ],
            body: { data: Buffer.from(bodyText, 'utf8').toString('base64url') },
          },
        }),
      } as any
    }
    return { ok: false } as any
  })
  vi.stubGlobal('fetch', globalFetch)
}

const AI_LEAD = {
  isBuyerLead: true,
  confidence: 0.92,
  firstName: 'Marc',
  lastName: 'Durand',
  email: 'marc.durand@example.com',
  phone: '0612345678',
  propertyType: 'maison',
  budgetMax: 350000,
  communes: ['Brignoles'],
  propertyReference: null,
  summary: 'Recherche une maison à Brignoles',
  extractedBy: 'ai' as const,
  raw: {},
}

describe('scanBuyerLeadsFromGmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedCandidates = []
    vi.mocked(matchBuyerEmailToProperty).mockResolvedValue(null)
  })

  it('returns explicit error when Google is not connected', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue(null)

    const res = await scanBuyerLeadsFromGmail()
    expect(res.success).toBe(false)
    expect(res.error).toContain('non connecté')
  })

  it('creates a pending candidate instead of a project', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue('mock-token')
    vi.mocked(extractBuyerLeadFromEmail).mockResolvedValue(AI_LEAD)
    mockSupabase()
    mockGmail('Message de Marc Durand concernant la maison à Brignoles')

    const res = await scanBuyerLeadsFromGmail()

    expect(res.success).toBe(true)
    expect(res.candidateCount).toBe(1)
    expect(res.results[0].status).toBe('candidate')
    expect(res.results[0].portal).toBe('SeLoger')
    expect(res.results[0].contactName).toBe('Marc Durand')

    expect(insertedCandidates).toHaveLength(1)
    expect(insertedCandidates[0].status).toBe('pending')
    expect(insertedCandidates[0].gmail_message_id).toBe('msg-1')
  })

  it('records non-buyer e-mails as rejected so they are not re-analysed', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue('mock-token')
    vi.mocked(extractBuyerLeadFromEmail).mockResolvedValue({
      ...AI_LEAD,
      isBuyerLead: false,
      confidence: 0.05,
    })
    mockSupabase()
    mockGmail('Votre facture SeLoger du mois de juillet')

    const res = await scanBuyerLeadsFromGmail()

    expect(res.candidateCount).toBe(0)
    expect(res.discardedCount).toBe(1)
    expect(insertedCandidates[0].status).toBe('rejected')
    expect(insertedCandidates[0].reviewed_at).toBeTruthy()
  })

  it('skips messages already present in the candidate table', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue('mock-token')
    vi.mocked(extractBuyerLeadFromEmail).mockResolvedValue(AI_LEAD)
    mockSupabase(['msg-1'])
    mockGmail('Message de Marc Durand')

    const res = await scanBuyerLeadsFromGmail()

    expect(res.alreadyProcessedCount).toBe(1)
    expect(res.candidateCount).toBe(0)
    expect(insertedCandidates).toHaveLength(0)
    expect(extractBuyerLeadFromEmail).not.toHaveBeenCalled()
  })

  it('flags a degraded run when the AI fell back to heuristics', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue('mock-token')
    vi.mocked(extractBuyerLeadFromEmail).mockResolvedValue({ ...AI_LEAD, extractedBy: 'heuristics' })
    mockSupabase()
    mockGmail('Message de Marc Durand')

    const res = await scanBuyerLeadsFromGmail()

    expect(res.degraded).toBe(true)
    expect(insertedCandidates[0].extracted_by).toBe('heuristics')
  })

  it('stores the matched property when one is found', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue('mock-token')
    vi.mocked(extractBuyerLeadFromEmail).mockResolvedValue(AI_LEAD)
    vi.mocked(matchBuyerEmailToProperty).mockResolvedValue({
      projectId: 'project-42',
      reason: 'Commune « Brignoles » citée dans l\'e-mail',
    })
    mockSupabase()
    mockGmail('Message de Marc Durand')

    const res = await scanBuyerLeadsFromGmail()

    expect(res.results[0].matchedProjectId).toBe('project-42')
    expect(insertedCandidates[0].matched_project_id).toBe('project-42')
  })
})

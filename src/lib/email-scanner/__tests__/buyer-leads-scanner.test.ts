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

vi.mock('@/lib/leads-crm', () => ({
  upsertCrmProspect: vi.fn().mockResolvedValue({ id: 'prospect-1' }),
}))

import { getGoogleAccessToken } from '@/lib/google/tokens'
import { supabaseAdmin } from '@/lib/supabase'

describe('scanBuyerLeadsFromGmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns explicit error when Google is not connected', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue(null)

    const res = await scanBuyerLeadsFromGmail()
    expect(res.success).toBe(false)
    expect(res.error).toContain('non connecté')
  })

  it('scans Gmail and creates contacts/buyer projects', async () => {
    vi.mocked(getGoogleAccessToken).mockResolvedValue('mock-token')

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'lead_events') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [] }),
          }),
          insert: () => Promise.resolve({ error: null }),
        } as any
      }

      if (table === 'contacts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'contact-1' }, error: null }),
            }),
          }),
        } as any
      }

      if (table === 'buyer_criteria') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'buyer-1' }, error: null }),
            }),
          }),
        } as any
      }

      if (table === 'project_contacts') {
        return {
          insert: () => Promise.resolve({ error: null }),
        } as any
      }

      return {} as any
    })

    // Mock global fetch for Gmail API
    const globalFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/users/me/messages?')) {
        return {
          ok: true,
          json: async () => ({ messages: [{ id: 'msg-1', threadId: 't-1' }] }),
        } as any
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
              body: {
                data: Buffer.from('Message de Marc Durand (0612345678, marc.durand@example.com) concernant la maison à Brignoles 350000 €', 'utf8').toString('base64url'),
              },
            },
          }),
        } as any
      }
      return { ok: false } as any
    })

    vi.stubGlobal('fetch', globalFetch)

    const res = await scanBuyerLeadsFromGmail()
    expect(res.success).toBe(true)
    expect(res.createdCount).toBe(1)
    expect(res.results[0].portal).toBe('SeLoger')
    expect(res.results[0].contactName).toBe('Marc Durand')
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'

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

import { supabaseAdmin } from '@/lib/supabase'

describe('POST /api/integrations/playiad/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty payload', async () => {
    const req = new NextRequest('http://localhost/api/integrations/playiad/sync', {
      method: 'POST',
      body: JSON.stringify({ leads: [] }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('syncs Playiad buyer lead successfully', async () => {
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
              single: () => Promise.resolve({ data: { id: 'buyer-playiad-1' }, error: null }),
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

    const req = new NextRequest('http://localhost/api/integrations/playiad/sync', {
      method: 'POST',
      body: JSON.stringify({
        leads: [
          {
            playiad_id: 'lead-12345',
            first_name: 'Claire',
            last_name: 'Moreau',
            email: 'claire.moreau@example.com',
            phone: '0698765432',
            source: 'Playiad',
            property_title: 'Villa Cotignac',
            budget_max: 420000,
          },
        ],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.createdCount).toBe(1)
    expect(json.results[0].buyer_id).toBe('buyer-playiad-1')
  })
})

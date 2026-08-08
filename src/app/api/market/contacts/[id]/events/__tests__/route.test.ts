import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

vi.mock('@/lib/supabase', () => {
  const mockFrom = vi.fn()
  return {
    supabaseAdmin: {
      from: mockFrom,
    },
  }
})

import { supabaseAdmin } from '@/lib/supabase'

describe('/api/market/contacts/[id]/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches events for contact', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: () => ({
        or: () => ({
          order: () => Promise.resolve({ data: [{ id: 'evt-1', kind: 'note' }], error: null }),
        }),
      }),
    } as any)

    const req = new NextRequest('http://localhost/api/market/contacts/c-1/events')
    const res = await GET(req, { params: Promise.resolve({ id: 'c-1' }) })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.events.length).toBe(1)
    expect(json.events[0].id).toBe('evt-1')
  })

  it('creates new note for contact', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'evt-2', kind: 'note' }, error: null }),
        }),
      }),
    } as any)

    const req = new NextRequest('http://localhost/api/market/contacts/c-1/events', {
      method: 'POST',
      body: JSON.stringify({ kind: 'note', text: 'Appel téléphonique de qualification effectué.' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'c-1' }) })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.event.id).toBe('evt-2')
  })
})

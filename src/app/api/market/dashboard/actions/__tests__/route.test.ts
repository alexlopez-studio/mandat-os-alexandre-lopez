import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  updates: [] as Array<{ table: string; payload: unknown; field: string; value: string }>,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = { table, payload: null }
      chain.update = vi.fn((payload: unknown) => {
        chain.payload = payload
        return chain
      })
      chain.eq = vi.fn((field: string, value: string) => {
        mocks.updates.push({ table, payload: chain.payload, field, value })
        return Promise.resolve({ error: null })
      })
      return chain
    }),
  },
}))

import { PATCH } from '../route'

function makeRequest(body: unknown): NextRequest {
  return new Request('https://preview.alexlopez-provence.fr/api/market/dashboard/actions', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

describe('PATCH /api/market/dashboard/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updates = []
  })

  it('completes opportunity timeline events', async () => {
    const response = await PATCH(makeRequest({
      action_id: 'event-1',
      source: 'opportunity_event',
      operation: 'complete',
    }))

    expect(response.status).toBe(200)
    expect(mocks.updates[0]).toMatchObject({
      table: 'opportunity_events',
      field: 'id',
      value: 'event-1',
    })
    expect(mocks.updates[0].payload).toHaveProperty('completed_at')
  })

  it('postpones buyer actions on the existing due date field', async () => {
    const response = await PATCH(makeRequest({
      action_id: 'buyer-1',
      source: 'buyer',
      operation: 'postpone',
      due_date: '2026-07-12',
    }))

    expect(response.status).toBe(200)
    expect(mocks.updates[0]).toMatchObject({
      table: 'buyer_criteria',
      payload: { due_date: '2026-07-12T00:00:00.000Z' },
      field: 'lead_id',
      value: 'buyer-1',
    })
  })
})

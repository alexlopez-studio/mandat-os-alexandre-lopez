import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { method: string; args: unknown[] }

const mocks = vi.hoisted(() => ({
  admin: null as { id: string } | null,
  calls: [] as Call[],
  updatePatch: null as Record<string, unknown> | null,
  row: { id: 'post-1' } as Record<string, unknown>,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentAdmin: vi.fn(async () => mocks.admin),
}))

vi.mock('@/lib/supabase', () => {
  const record = (method: string, ...args: unknown[]) => {
    mocks.calls.push({ method, args })
  }
  return {
    supabaseAdmin: {
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {}
        const passthrough = (name: string) =>
          vi.fn((...args: unknown[]) => {
            record(name, ...args)
            return chain
          })
        chain.select = passthrough('select')
        chain.eq = passthrough('eq')
        chain.is = passthrough('is')
        chain.gte = passthrough('gte')
        chain.lte = passthrough('lte')
        chain.ilike = passthrough('ilike')
        chain.update = vi.fn((patch: Record<string, unknown>) => {
          mocks.updatePatch = patch
          record('update', patch)
          return chain
        })
        chain.single = vi.fn(() => Promise.resolve({ data: mocks.row, error: null }))
        chain.order = vi.fn((...args: unknown[]) => {
          record('order', ...args)
          return chain
        })
        chain.range = vi.fn(() =>
          Promise.resolve({ data: [mocks.row], count: 1, error: null }),
        )
        return chain
      }),
    },
  }
})

import { GET } from '../route'
import { PATCH } from '../[id]/route'

function get(url: string, apiKey = 'secret-de-test') {
  return new NextRequest(url, { headers: { authorization: `Bearer ${apiKey}` } })
}

function patch(body: unknown, apiKey = 'secret-de-test') {
  return new NextRequest('http://localhost/api/market/content/posts/post-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ id: 'post-1' }) }

describe('/api/market/content/posts', () => {
  beforeEach(() => {
    mocks.admin = null
    mocks.calls = []
    mocks.updatePatch = null
    mocks.row = { id: 'post-1' }
    process.env.EDITORIAL_API_KEY = 'secret-de-test'
  })

  afterEach(() => {
    delete process.env.EDITORIAL_API_KEY
    vi.clearAllMocks()
  })

  it('GET refuse une requete non authentifiee', async () => {
    const res = await GET(new NextRequest('http://localhost/api/market/content/posts'))
    expect(res.status).toBe(401)
  })

  it('GET borne le calendrier sur from / to', async () => {
    const res = await GET(
      get('http://localhost/api/market/content/posts?from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.000Z'),
    )
    expect(res.status).toBe(200)

    const gte = mocks.calls.find((c) => c.method === 'gte')
    const lte = mocks.calls.find((c) => c.method === 'lte')
    expect(gte?.args).toEqual(['scheduled_for', '2026-09-01T00:00:00.000Z'])
    expect(lte?.args).toEqual(['scheduled_for', '2026-09-30T23:59:59.000Z'])
  })

  it('GET rejette une borne non ISO', async () => {
    const res = await GET(get('http://localhost/api/market/content/posts?from=septembre'))
    expect(res.status).toBe(400)
  })

  it('GET unscheduled=1 filtre les posts sans date', async () => {
    await GET(get('http://localhost/api/market/content/posts?unscheduled=1'))
    const is = mocks.calls.find((c) => c.method === 'is')
    expect(is?.args).toEqual(['scheduled_for', null])
  })

  it('GET rejette un canal inconnu', async () => {
    const res = await GET(get('http://localhost/api/market/content/posts?channel=tiktok'))
    expect(res.status).toBe(400)
  })

  it('PATCH published horodate published_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T08:30:00.000Z'))

    const res = await PATCH(patch({ status: 'published' }), params)
    expect(res.status).toBe(200)
    expect(mocks.updatePatch).toEqual({
      status: 'published',
      published_at: '2026-09-15T08:30:00.000Z',
    })

    vi.useRealTimers()
  })

  it('PATCH vers un autre statut efface published_at', async () => {
    await PATCH(patch({ status: 'ready' }), params)
    expect(mocks.updatePatch).toEqual({ status: 'ready', published_at: null })
  })

  it('PATCH ignore les champs non whitelistes', async () => {
    await PATCH(patch({ title: 'Nouveau titre', angle_id: 'autre-angle', id: 'usurpe' }), params)
    expect(mocks.updatePatch).toEqual({ title: 'Nouveau titre' })
  })

  it('PATCH rejette un corps sans champ modifiable', async () => {
    const res = await PATCH(patch({ inconnu: 1 }), params)
    expect(res.status).toBe(400)
  })

  it('PATCH rejette une date de planification invalide', async () => {
    const res = await PATCH(patch({ scheduled_for: 'la semaine prochaine' }), params)
    expect(res.status).toBe(400)
  })

  it('PATCH accepte une sortie du calendrier (scheduled_for null)', async () => {
    await PATCH(patch({ scheduled_for: null }), params)
    expect(mocks.updatePatch).toEqual({ scheduled_for: null })
  })
})

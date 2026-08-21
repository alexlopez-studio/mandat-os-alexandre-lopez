import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  admin: null as { id: string } | null,
  /** Lignes renvoyees par le `.select('id')` de l'upsert : simule la dedup. */
  upsertReturn: [] as { id: string }[],
  upsertCalls: [] as { rows: unknown[]; options: unknown }[],
  statusRows: [] as { status: string }[],
}))

vi.mock('@/lib/auth', () => ({
  getCurrentAdmin: vi.fn(async () => mocks.admin),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.upsert = vi.fn((rows: unknown[], options: unknown) => {
        mocks.upsertCalls.push({ rows, options })
        return {
          select: vi.fn(() => Promise.resolve({ data: mocks.upsertReturn, error: null })),
        }
      })
      // `select('status')` sans suite : agregat des compteurs.
      chain.select = vi.fn(() => Promise.resolve({ data: mocks.statusRows, error: null }))
      return chain
    }),
  },
}))

import { POST } from '../route'

function postRequest(body: unknown, apiKey?: string) {
  return new NextRequest('http://localhost/api/market/news', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

const ARTICLE = {
  source: 'les-echos',
  url: 'https://example.test/taux-mars',
  title: 'Les taux repassent sous 3 %',
  category: 'taux',
}

describe('POST /api/market/news', () => {
  beforeEach(() => {
    mocks.admin = null
    mocks.upsertReturn = []
    mocks.upsertCalls = []
    mocks.statusRows = []
    process.env.EDITORIAL_API_KEY = 'secret-de-test'
  })

  afterEach(() => {
    delete process.env.EDITORIAL_API_KEY
    vi.clearAllMocks()
  })

  it('refuse une requete sans clé ni session', async () => {
    const res = await POST(postRequest({ items: [ARTICLE] }))
    expect(res.status).toBe(401)
    expect(mocks.upsertCalls).toHaveLength(0)
  })

  it('refuse une clé erronee', async () => {
    const res = await POST(postRequest({ items: [ARTICLE] }, 'mauvaise-clé'))
    expect(res.status).toBe(401)
  })

  it('accepte une session admin sans clé', async () => {
    mocks.admin = { id: 'admin-1' }
    mocks.upsertReturn = [{ id: 'news-1' }]

    const res = await POST(postRequest({ items: [ARTICLE] }))
    expect(res.status).toBe(201)
  })

  it('ingere un article et renvoie le compte insere', async () => {
    mocks.upsertReturn = [{ id: 'news-1' }]

    const res = await POST(postRequest({ items: [ARTICLE] }, 'secret-de-test'))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json).toEqual({ success: true, data: { inserted: 1, skipped: 0 } })
    expect(mocks.upsertCalls[0].options).toEqual({ onConflict: 'url', ignoreDuplicates: true })
  })

  it('compte en "skipped" un article deja connu (dedup par url)', async () => {
    // Une URL deja presente : `ignoreDuplicates` ne renvoie aucune ligne.
    mocks.upsertReturn = []

    const res = await POST(postRequest({ items: [ARTICLE] }, 'secret-de-test'))
    const json = await res.json()

    expect(json).toEqual({ success: true, data: { inserted: 0, skipped: 1 } })
  })

  it('applique les valeurs par defaut de qualification', async () => {
    mocks.upsertReturn = [{ id: 'news-1' }]

    await POST(postRequest({ items: [ARTICLE] }, 'secret-de-test'))
    const row = mocks.upsertCalls[0].rows[0] as Record<string, unknown>

    expect(row.confidence).toBe('external')
    expect(row.relevance).toBe(0)
    expect(row.raw_json).toEqual({})
  })

  it('rejette une categorie hors liste', async () => {
    const res = await POST(
      postRequest({ items: [{ ...ARTICLE, category: 'potins' }] }, 'secret-de-test'),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('category invalide')
    expect(mocks.upsertCalls).toHaveLength(0)
  })

  it('rejette une pertinence hors bornes', async () => {
    const res = await POST(
      postRequest({ items: [{ ...ARTICLE, relevance: 140 }] }, 'secret-de-test'),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('relevance')
  })

  it('rejette une date de publication invalide', async () => {
    const res = await POST(
      postRequest({ items: [{ ...ARTICLE, published_at: 'hier' }] }, 'secret-de-test'),
    )
    expect(res.status).toBe(400)
  })

  it('refuse un lot trop gros', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      ...ARTICLE,
      url: `https://example.test/article-${i}`,
    }))
    const res = await POST(postRequest({ items }, 'secret-de-test'))
    expect(res.status).toBe(400)
    expect(mocks.upsertCalls).toHaveLength(0)
  })

  it('refuse un corps sans items', async () => {
    const res = await POST(postRequest({}, 'secret-de-test'))
    expect(res.status).toBe(400)
  })
})

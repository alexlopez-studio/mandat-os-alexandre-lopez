import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  admin: null as { id: string } | null,
  angleInsert: null as Record<string, unknown> | null,
  postRows: null as Record<string, unknown>[] | null,
  postsInsertFails: false,
  deletedAngleIds: [] as string[],
}))

vi.mock('@/lib/auth', () => ({
  getCurrentAdmin: vi.fn(async () => mocks.admin),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {}

      chain.insert = vi.fn((payload: unknown) => {
        if (table === 'content_angles') {
          mocks.angleInsert = payload as Record<string, unknown>
          return {
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'angle-1' }, error: null })),
            })),
          }
        }
        mocks.postRows = payload as Record<string, unknown>[]
        return Promise.resolve(
          mocks.postsInsertFails ? { error: { message: 'boom' } } : { error: null },
        )
      })

      chain.delete = vi.fn(() => ({
        eq: vi.fn((_col: string, id: string) => {
          mocks.deletedAngleIds.push(id)
          return Promise.resolve({ error: null })
        }),
      }))

      chain.select = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { id: 'angle-1', content_posts: [] }, error: null }),
          ),
        })),
      }))

      return chain
    }),
  },
}))

import { POST } from '../route'

function request(body: unknown, apiKey = 'secret-de-test') {
  return new NextRequest('http://localhost/api/market/content/angles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/market/content/angles', () => {
  beforeEach(() => {
    mocks.admin = null
    mocks.angleInsert = null
    mocks.postRows = null
    mocks.postsInsertFails = false
    mocks.deletedAngleIds = []
    process.env.EDITORIAL_API_KEY = 'secret-de-test'
  })

  afterEach(() => {
    delete process.env.EDITORIAL_API_KEY
    vi.clearAllMocks()
  })

  it('refuse une requete non authentifiee', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/market/content/angles', {
        method: 'POST',
        body: JSON.stringify({ title: 'Sujet' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('cree un angle et ses declinaisons en un appel', async () => {
    const res = await POST(
      request({
        title: 'Taux sous 3 %',
        angle: 'Ce que ça change pour un vendeur de Barjols',
        pillar: 'taux',
        news_item_id: 'news-1',
        posts: [
          { channel: 'linkedin', status: 'draft' },
          { channel: 'blog', scheduled_for: '2026-09-20T09:00:00.000Z' },
        ],
      }),
    )

    expect(res.status).toBe(201)
    expect(mocks.angleInsert).toMatchObject({ title: 'Taux sous 3 %', pillar: 'taux' })
    expect(mocks.postRows).toHaveLength(2)
    expect(mocks.postRows?.[0]).toMatchObject({ angle_id: 'angle-1', channel: 'linkedin' })
    expect(mocks.postRows?.[1]).toMatchObject({ scheduled_for: '2026-09-20T09:00:00.000Z' })
  })

  it('pose les colonnes not null sur chaque ligne d’un lot heterogene', async () => {
    // PostgREST unifie les colonnes d'une insertion groupee : sans valeur
    // explicite, la ligne qui n'a pas de `hashtags` recoit un NULL et casse la
    // contrainte `not null`, au lieu de retomber sur le DEFAULT.
    await POST(
      request({
        title: 'Sujet',
        posts: [
          { channel: 'linkedin', status: 'ready', hashtags: ['#immo'], created_by: 'admin' },
          { channel: 'blog' },
        ],
      }),
    )

    expect(mocks.postRows?.[1]).toMatchObject({
      channel: 'blog',
      status: 'draft',
      created_by: 'claude',
      hashtags: [],
    })
    expect(mocks.postRows?.[0]).toMatchObject({ status: 'ready', hashtags: ['#immo'] })
  })

  it('exige un titre', async () => {
    const res = await POST(request({ posts: [] }))
    expect(res.status).toBe(400)
    expect(mocks.angleInsert).toBeNull()
  })

  it('valide les declinaisons avant de creer l’angle', async () => {
    const res = await POST(
      request({ title: 'Sujet', posts: [{ channel: 'tiktok' }] }),
    )
    expect(res.status).toBe(400)
    // Rien ne doit avoir ete ecrit : pas d'angle orphelin.
    expect(mocks.angleInsert).toBeNull()
  })

  it('exige un canal sur chaque declinaison', async () => {
    const res = await POST(request({ title: 'Sujet', posts: [{ status: 'draft' }] }))
    expect(res.status).toBe(400)
    expect(mocks.angleInsert).toBeNull()
  })

  it('retire l’angle si l’insertion des declinaisons echoue', async () => {
    mocks.postsInsertFails = true

    const res = await POST(request({ title: 'Sujet', posts: [{ channel: 'linkedin' }] }))

    expect(res.status).toBe(500)
    expect(mocks.deletedAngleIds).toEqual(['angle-1'])
  })

  it('refuse plus de 12 declinaisons', async () => {
    const posts = Array.from({ length: 13 }, () => ({ channel: 'linkedin' }))
    const res = await POST(request({ title: 'Sujet', posts }))
    expect(res.status).toBe(400)
    expect(mocks.angleInsert).toBeNull()
  })

  it('rejette un pilier hors liste', async () => {
    const res = await POST(request({ title: 'Sujet', pillar: 'potins' }))
    expect(res.status).toBe(400)
  })
})

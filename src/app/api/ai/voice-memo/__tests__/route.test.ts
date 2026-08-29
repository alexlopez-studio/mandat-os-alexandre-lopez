import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  currentAdmin: null as unknown,
  processVoiceMemo: vi.fn(),
}))

// `/api/ai/voice-memo` est hors du middleware de session : la garde de la route
// est la seule protection. Ces tests la verrouillent.
vi.mock('@/lib/auth', () => ({
  getCurrentAdmin: vi.fn(async () => mocks.currentAdmin),
}))

vi.mock('@/lib/ai/voice-memo-processor', () => ({
  processVoiceMemo: mocks.processVoiceMemo,
}))

vi.mock('@/lib/ai/db', () => ({
  adminDb: () => ({
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = () => chain
      chain.in = () => chain
      chain.eq = () => chain
      chain.limit = () => Promise.resolve({ data: [], error: null })
      return chain
    },
  }),
}))

import { GET, POST } from '../route'

const URL_BASE = 'https://app.alexandrelopez.fr/api/ai/voice-memo'
const SECRET = 'secret-de-test-du-raccourci'

function makeGet(headers: Record<string, string> = {}): NextRequest {
  return new Request(URL_BASE, { headers }) as unknown as NextRequest
}

function makePost(headers: Record<string, string> = {}): NextRequest {
  const body = new FormData()
  body.append('transcript', 'Visite maison Barjols, vendeurs pressés.')
  return new Request(URL_BASE, { method: 'POST', body, headers }) as unknown as NextRequest
}

describe('garde de /api/ai/voice-memo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentAdmin = null
    mocks.processVoiceMemo.mockResolvedValue({ title: 'Compte-rendu', transcript: '' })
    process.env.VOICE_MEMO_API_KEY = SECRET
  })

  afterEach(() => {
    delete process.env.VOICE_MEMO_API_KEY
  })

  it('refuse une lecture sans secret ni session', async () => {
    const response = await GET(makeGet())
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ reason: 'bad-credentials' })
  })

  it('refuse une lecture avec un mauvais secret', async () => {
    const response = await GET(makeGet({ authorization: 'Bearer mauvais-secret-de-meme-taille' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ reason: 'bad-credentials' })
  })

  it('accepte un secret entoure d’espaces des deux cotes', async () => {
    process.env.VOICE_MEMO_API_KEY = `  ${SECRET}\n`
    expect((await GET(makeGet({ authorization: `Bearer ${SECRET} ` }))).status).toBe(200)
  })

  it('accepte le secret du raccourci iOS en Bearer ou en x-api-key', async () => {
    expect((await GET(makeGet({ authorization: `Bearer ${SECRET}` }))).status).toBe(200)
    expect((await GET(makeGet({ 'x-api-key': SECRET }))).status).toBe(200)
  })

  it('accepte une session admin', async () => {
    mocks.currentAdmin = { id: 'admin-1', email: 'alex@example.com' }
    expect((await GET(makeGet())).status).toBe(200)
  })

  it("refuse l'ingestion sans secret et ne déclenche aucun traitement IA", async () => {
    const response = await POST(makePost())
    expect(response.status).toBe(401)
    expect(mocks.processVoiceMemo).not.toHaveBeenCalled()
  })

  it("accepte l'ingestion avec le secret du raccourci", async () => {
    const response = await POST(makePost({ authorization: `Bearer ${SECRET}` }))
    expect(response.status).toBe(200)
    expect(mocks.processVoiceMemo).toHaveBeenCalledOnce()
    expect(mocks.processVoiceMemo.mock.calls[0][0]).toMatchObject({ source: 'ios_shortcut' })
  })

  it('refuse tout accès machine quand VOICE_MEMO_API_KEY est absente, et le dit', async () => {
    delete process.env.VOICE_MEMO_API_KEY
    const response = await GET(makeGet({ authorization: `Bearer ${SECRET}` }))
    expect(response.status).toBe(401)
    // Le motif distingue « variable absente du deploiement » de « cle erronee ».
    expect(await response.json()).toMatchObject({ reason: 'no-secret-configured' })
  })
})

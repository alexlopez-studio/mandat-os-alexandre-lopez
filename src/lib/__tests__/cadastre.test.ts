import { describe, it, expect, afterEach, vi } from 'vitest'
import { findParcelByPoint, findParcelByCode } from '@/lib/cadastre'

type MockResponse = { status?: number; body: unknown }

function mockFetch(
  routes: Array<{ match: string; response: MockResponse }>,
) {
  const fn = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    for (const route of routes) {
      if (url.includes(route.match)) {
        return new Response(JSON.stringify(route.response.body), {
          status: route.response.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    return new Response(
      JSON.stringify({ type: 'FeatureCollection', features: [] }),
      { status: 200 },
    )
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function feature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[6.149, 43.528], [6.150, 43.528], [6.150, 43.529], [6.149, 43.528]]] },
    properties: {
      idu: '830420000A0123',
      code_insee: '83042',
      code_dep: '83',
      code_com: '042',
      code_arr: '000',
      nom_com: 'Cotignac',
      section: '0A',
      numero: '0123',
      contenance: 1245,
      ...overrides,
    },
  }
}

describe('lib/cadastre.findParcelByPoint', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the first parcel from the FeatureCollection', async () => {
    const fetch = mockFetch([
      {
        match: '/api/cadastre/parcelle',
        response: {
          body: { type: 'FeatureCollection', features: [feature()] },
        },
      },
    ])
    const parcel = await findParcelByPoint({ lat: 43.5283, lng: 6.1494 })
    expect(parcel).not.toBeNull()
    expect(parcel?.idu).toBe('830420000A0123')
    expect(parcel?.section).toBe('0A')
    expect(parcel?.numero).toBe('0123')
    expect(parcel?.contenance_m2).toBe(1245)
    expect(parcel?.nom_com).toBe('Cotignac')
    // URL contient bien les coordonnées au format GeoJSON encodé
    const calledUrl = String(fetch.mock.calls[0]?.[0])
    expect(calledUrl).toContain('geom=')
    expect(decodeURIComponent(calledUrl)).toContain('"Point"')
    expect(decodeURIComponent(calledUrl)).toContain('6.1494')
    expect(decodeURIComponent(calledUrl)).toContain('43.5283')
  })

  it('returns null when FeatureCollection has no features', async () => {
    mockFetch([
      {
        match: '/api/cadastre/parcelle',
        response: { body: { type: 'FeatureCollection', features: [] } },
      },
    ])
    const parcel = await findParcelByPoint({ lat: 0, lng: 0 })
    expect(parcel).toBeNull()
  })

  it('returns null gracefully on HTTP 500', async () => {
    mockFetch([
      {
        match: '/api/cadastre/parcelle',
        response: { status: 500, body: { error: 'boom' } },
      },
    ])
    const parcel = await findParcelByPoint({ lat: 0, lng: 0 })
    expect(parcel).toBeNull()
  })

  it('skips features without idu and returns the next valid one', async () => {
    mockFetch([
      {
        match: '/api/cadastre/parcelle',
        response: {
          body: {
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', properties: {} },
              feature({ idu: 'XYZ123' }),
            ],
          },
        },
      },
    ])
    const parcel = await findParcelByPoint({ lat: 0, lng: 0 })
    expect(parcel?.idu).toBe('XYZ123')
  })

  it('handles missing contenance gracefully', async () => {
    mockFetch([
      {
        match: '/api/cadastre/parcelle',
        response: {
          body: {
            type: 'FeatureCollection',
            features: [feature({ contenance: null })],
          },
        },
      },
    ])
    const parcel = await findParcelByPoint({ lat: 0, lng: 0 })
    expect(parcel?.contenance_m2).toBeNull()
  })
})

describe('lib/cadastre.findParcelByCode', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the parcel matching the code triplet', async () => {
    const fetch = mockFetch([
      {
        match: '/api/cadastre/parcelle',
        response: {
          body: { type: 'FeatureCollection', features: [feature()] },
        },
      },
    ])
    const parcel = await findParcelByCode({
      codeInsee: '83042',
      section: '0A',
      numero: '0123',
    })
    expect(parcel?.idu).toBe('830420000A0123')
    const calledUrl = String(fetch.mock.calls[0]?.[0])
    expect(calledUrl).toContain('code_insee=83042')
    expect(calledUrl).toContain('section=0A')
    expect(calledUrl).toContain('numero=0123')
  })

  it('returns null on HTTP error', async () => {
    mockFetch([
      {
        match: '/api/cadastre/parcelle',
        response: { status: 502, body: 'bad gateway' },
      },
    ])
    const parcel = await findParcelByCode({
      codeInsee: '00000',
      section: 'X',
      numero: '0',
    })
    expect(parcel).toBeNull()
  })

  it('returns null when not found', async () => {
    mockFetch([])
    const parcel = await findParcelByCode({
      codeInsee: '00000',
      section: 'X',
      numero: '0',
    })
    expect(parcel).toBeNull()
  })
})

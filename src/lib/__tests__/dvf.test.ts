import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchDvfMutations, median } from '@/lib/dvf'

type MockResponse = { status?: number; body: unknown }

function mockFetch(routes: Array<{ match: string; response: MockResponse }>) {
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
    return new Response(JSON.stringify({ results: [] }), { status: 200 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('lib/dvf.median', () => {
  it('returns 0 for empty arrays', () => {
    expect(median([])).toBe(0)
  })

  it('returns the middle value for odd arrays', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('returns the average middle value for even arrays', () => {
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
})

describe('lib/dvf.fetchDvfMutations', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('uses Cerema as primary source by default', async () => {
    const fetch = mockFetch([
      {
        match: 'apidf-preprod.cerema.fr',
        response: {
          body: {
            results: [
              {
                valeur_fonciere: 240000,
                surface_reelle_bati: 100,
                type_local: 'Maison',
                date_mutation: '2025-01-10',
                code_postal: '83670',
                lat: 43.55,
                lon: 6.03,
              },
            ],
          },
        },
      },
    ])

    const rows = await fetchDvfMutations(43.55, 6.03, 'maison', 1500)

    expect(rows).toHaveLength(1)
    expect(rows[0].valeur_fonciere).toBe(240000)
    expect(rows[0].surface_reelle_bati).toBe(100)
    const calledUrl = String(fetch.mock.calls[0]?.[0])
    expect(calledUrl).toContain('apidf-preprod.cerema.fr')
    expect(calledUrl).toContain('in_type_local=Maison')
    expect(calledUrl).toContain('rayon=1500')
  })

  it('uses Appartement for apartment searches', async () => {
    const fetch = mockFetch([
      {
        match: 'apidf-preprod.cerema.fr',
        response: { body: { results: [] } },
      },
      {
        match: 'api.cquest.org',
        response: { body: [] },
      },
    ])

    await fetchDvfMutations(43.55, 6.03, 'appartement', 1500)

    const calledUrl = String(fetch.mock.calls[0]?.[0])
    expect(calledUrl).toContain('in_type_local=Appartement')
  })

  it('falls back to cquest when Cerema is unavailable', async () => {
    const fetch = mockFetch([
      {
        match: 'apidf-preprod.cerema.fr',
        response: { status: 503, body: { error: 'unavailable' } },
      },
      {
        match: 'api.cquest.org',
        response: {
          body: [
            {
              valeur: '315000',
              surface_bati: '126',
              type_local: 'Maison',
              date_mutation: '2024-06-01',
              code_postal: '83670',
            },
          ],
        },
      },
    ])

    const rows = await fetchDvfMutations(43.55, 6.03, 'maison', 5000)

    expect(rows).toHaveLength(1)
    expect(rows[0].valeur_fonciere).toBe(315000)
    expect(rows[0].surface_reelle_bati).toBe(126)
    expect(String(fetch.mock.calls[1]?.[0])).toContain('api.cquest.org')
    expect(String(fetch.mock.calls[1]?.[0])).toContain('dist=5000')
    expect(String(fetch.mock.calls[1]?.[0])).toContain('type_local=Maison')
  })

  it('can disable the secondary fallback via environment', async () => {
    vi.stubEnv('DVF_ENABLE_FALLBACK', 'false')
    const fetch = mockFetch([
      {
        match: 'apidf-preprod.cerema.fr',
        response: { status: 500, body: { error: 'boom' } },
      },
    ])

    const rows = await fetchDvfMutations(43.55, 6.03, 'maison', 1500)

    expect(rows).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('can use cquest as primary source', async () => {
    vi.stubEnv('DVF_PRIMARY_PROVIDER', 'cquest')
    const fetch = mockFetch([
      {
        match: 'api.cquest.org',
        response: {
          body: [
            {
              valeur_fonciere: 180000,
              surface_reelle_bati: 72,
              type_local: 'Appartement',
              date_mutation: '2025-02-01',
            },
          ],
        },
      },
    ])

    const rows = await fetchDvfMutations(43.55, 6.03, 'appartement', 1000)

    expect(rows).toHaveLength(1)
    expect(String(fetch.mock.calls[0]?.[0])).toContain('api.cquest.org')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('dist=1000')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('type_local=Appartement')
  })

  it('normalizes GeoJSON FeatureCollection responses', async () => {
    mockFetch([
      {
        match: 'apidf-preprod.cerema.fr',
        response: {
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [6.0305, 43.5505] },
                properties: {
                  valeur_fonciere: 220000,
                  surface_reelle_bati: 90,
                  type_local: 'Maison',
                  date_mutation: '2023-04-03',
                  code_postal: '83670',
                },
              },
            ],
          },
        },
      },
    ])

    const rows = await fetchDvfMutations(43.55, 6.03, 'maison', 1500)

    expect(rows).toHaveLength(1)
    expect(rows[0].distance_m).toBeGreaterThan(0)
    expect(rows[0].type_local).toBe('Maison')
  })

  it('filters unusable rows without value or surface', async () => {
    mockFetch([
      {
        match: 'apidf-preprod.cerema.fr',
        response: {
          body: {
            results: [
              { valeur_fonciere: 250000, surface_reelle_bati: null },
              { valeur_fonciere: null, surface_reelle_bati: 100 },
              { valeur_fonciere: 210000, surface_reelle_bati: 84 },
            ],
          },
        },
      },
    ])

    const rows = await fetchDvfMutations(43.55, 6.03, 'maison', 1500)

    expect(rows).toHaveLength(1)
    expect(rows[0].valeur_fonciere).toBe(210000)
  })
})

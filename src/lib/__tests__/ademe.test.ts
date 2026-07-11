import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  findDpeNearby,
  getDpeByNumber,
  haversineMeters,
} from '@/lib/ademe'

const LAT = 43.5283
const LNG = 6.1494

type MockResponse = {
  status?: number
  body: unknown
}

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
    return new Response(JSON.stringify({ total: 0, results: [] }), {
      status: 200,
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    numero_dpe: '2380E1234567A',
    etiquette_dpe: 'C',
    etiquette_ges: 'D',
    surface_habitable_logement: 122,
    adresse_ban: "3252 Rte d'Entrecasteaux",
    code_postal_ban: '83570',
    code_insee_ban: '83042',
    date_etablissement_dpe: '2024-08-12',
    annee_construction: 1985,
    type_batiment: 'maison',
    version_dpe: '2.4',
    _geopoint: `${LAT + 0.0001},${LNG + 0.0001}`,
    ...overrides,
  }
}

describe('lib/ademe.haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters([6, 43], [6, 43])).toBe(0)
  })
  it('returns positive distance for distinct points', () => {
    const d = haversineMeters([6.1494, 43.5283], [6.1504, 43.5283])
    expect(d).toBeGreaterThan(50)
    expect(d).toBeLessThan(150)
  })
})

describe('lib/ademe.findDpeNearby', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns exact confidence when DPE within 30m and surface matches', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: { body: { total: 1, results: [record()] } },
      },
    ])
    const r = await findDpeNearby({ lat: LAT, lng: LNG, surface: 122 })
    expect(r.dpe).not.toBeNull()
    expect(r.dpe?.etiquette_dpe).toBe('C')
    expect(r.dpe?.dataset).toBe('existing')
    expect(r.confidence).toBe('exact')
    expect(r.candidates).toBe(1)
  })

  it('returns approximatif when surface mismatches > 10% even at close distance', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: {
          body: {
            total: 1,
            results: [record({ surface_habitable_logement: 80 })],
          },
        },
      },
    ])
    const r = await findDpeNearby({ lat: LAT, lng: LNG, surface: 122 })
    expect(r.confidence).toBe('approximatif')
  })

  it('returns approximatif when DPE is between 30m and 150m', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: {
          body: {
            total: 1,
            // ~80m offset (1 deg ≈ 111km, 0.0007 deg ≈ 78m at this latitude)
            results: [record({ _geopoint: `${LAT + 0.0007},${LNG}` })],
          },
        },
      },
    ])
    const r = await findDpeNearby({ lat: LAT, lng: LNG })
    expect(r.confidence).toBe('approximatif')
  })

  it('falls back to logements-neufs when existing returns empty', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: { body: { total: 0, results: [] } },
      },
      {
        match: 'dpe-v2-logements-neufs',
        response: {
          body: {
            total: 1,
            results: [record({ numero_dpe: 'NEUF1', etiquette_dpe: 'A' })],
          },
        },
      },
    ])
    const r = await findDpeNearby({ lat: LAT, lng: LNG })
    expect(r.dpe?.dataset).toBe('new')
    expect(r.dpe?.etiquette_dpe).toBe('A')
    expect(r.confidence).toBe('exact')
  })

  it('returns non_trouve gracefully on HTTP 500', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: { status: 500, body: { error: 'boom' } },
      },
    ])
    const r = await findDpeNearby({ lat: 0, lng: 0 })
    expect(r.dpe).toBeNull()
    expect(r.confidence).toBe('non_trouve')
  })

  it('returns non_trouve when both datasets are empty', async () => {
    mockFetch([])
    const r = await findDpeNearby({ lat: 0, lng: 0 })
    expect(r.dpe).toBeNull()
    expect(r.confidence).toBe('non_trouve')
    expect(r.candidates).toBe(0)
  })

  it('picks the closest record when multiple are returned', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: {
          body: {
            total: 2,
            results: [
              record({ numero_dpe: 'FAR', _geopoint: `${LAT + 0.0008},${LNG}` }),
              record({ numero_dpe: 'NEAR', _geopoint: `${LAT + 0.00005},${LNG}` }),
            ],
          },
        },
      },
    ])
    const r = await findDpeNearby({ lat: LAT, lng: LNG })
    expect(r.dpe?.numero_dpe).toBe('NEAR')
  })
})

describe('lib/ademe.getDpeByNumber', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the record when found in existing', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: { body: { total: 1, results: [record()] } },
      },
    ])
    const r = await getDpeByNumber('2380E1234567A')
    expect(r?.numero_dpe).toBe('2380E1234567A')
    expect(r?.dataset).toBe('existing')
  })

  it('falls back to neufs when not in existing', async () => {
    mockFetch([
      {
        match: 'dpe-v2-logements-existants',
        response: { body: { total: 0, results: [] } },
      },
      {
        match: 'dpe-v2-logements-neufs',
        response: { body: { total: 1, results: [record({ numero_dpe: 'NEUF1' })] } },
      },
    ])
    const r = await getDpeByNumber('NEUF1')
    expect(r?.dataset).toBe('new')
  })

  it('returns null when not found anywhere', async () => {
    mockFetch([])
    const r = await getDpeByNumber('NOPE')
    expect(r).toBeNull()
  })

  it('returns null on empty input', async () => {
    mockFetch([])
    const r = await getDpeByNumber('   ')
    expect(r).toBeNull()
  })
})

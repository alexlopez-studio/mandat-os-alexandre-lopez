import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MAX_CRAWL_AGE_DAYS,
  evaluateListingQuality,
  normalizeListing,
  propertyTypeLabels,
  sellerTypesForPublisherTypes,
} from '@/lib/stream-estate'

// Fixtures calquées sur des documents réellement renvoyés par Stream Estate
// (commune de Pontevès), y compris leurs pièges : annonce leboncoin expirée en
// première position, prix divergents entre portails, DPE porté par l'annonce.

type AdvertOverrides = {
  url: string
  expired?: boolean
  price?: number
  publisherType?: number
  lastCrawledAt?: string
  coherentPrice?: boolean
}

function advert({
  url,
  expired = false,
  price = 250_000,
  publisherType = 1,
  lastCrawledAt = '2026-08-01T10:00:00+02:00',
  coherentPrice = true,
}: AdvertOverrides) {
  return {
    uuid: `advert-${url}`,
    url,
    price,
    title: 'Maison de village',
    description: 'Description portail',
    expired,
    expiredAt: null,
    surface: 84,
    room: 4,
    bedroom: 3,
    landSurface: 518,
    energy: { value: null, category: 'C' },
    greenHouseGas: { value: null, category: 'B' },
    coherentPrice,
    publisher: { name: 'LBC', type: publisherType, category: 'Portails' },
    contact: { name: 'Christian', agency: null } as { name: string; agency: string | null },
    createdAt: '2026-06-30T16:20:58+02:00',
    updatedAt: '2026-06-30T16:20:58+02:00',
    lastCrawledAt,
    pictures: [],
    picturesRemote: [],
  }
}

function propertyDocument(adverts: ReturnType<typeof advert>[], overrides: Record<string, unknown> = {}) {
  return {
    uuid: '56611bab-de95-4f48-8ed9-9a0cb947efbf',
    '@type': 'PropertyDocument',
    city: { name: 'Pontevès', zipcode: '83670', insee: '83095' },
    location: { lat: 43.55, lon: 6.06 },
    propertyType: 1,
    transactionType: 0,
    price: 250_000,
    surface: 83,
    room: 4,
    bedroom: 3,
    landSurface: null,
    expired: false,
    expiredAt: null,
    createdAt: '2026-06-30T16:20:58+02:00',
    updatedAt: '2026-06-30T20:03:42+02:00',
    lastCrawledAt: '2026-08-01T10:00:00+02:00',
    publisherTypes: [0, 1],
    pictures: ['https://pictures.notif.immo/a.jpg'],
    adverts,
    ...overrides,
  }
}

const LBC = 'https://www.leboncoin.fr/ad/ventes_immobilieres/3225332630'
const SELOGER = 'https://www.seloger.com/annonces/achat/maison/ponteves-83/248124579.htm'
const LOGIC_IMMO = 'https://www.logic-immo.com/detail-vente-248124579.htm'
const ENTRE_PARTICULIERS = 'https://www.entreparticuliers.com/annonces-immobilieres/maison/vente/ponteves-83670/ref-20861497'

describe('normalizeListing — annonce de référence', () => {
  it('ignore une annonce leboncoin expirée au profit de la diffusion encore en ligne', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, expired: true, price: 90_000 }),
      advert({ url: SELOGER, expired: true, price: 90_000 }),
      advert({ url: ENTRE_PARTICULIERS, expired: false, price: 86_000, publisherType: 0 }),
    ]))

    expect(listing.url).toBe(ENTRE_PARTICULIERS)
    expect(listing.price).toBe(86_000)
    expect(listing.onlineAdvertCount).toBe(1)
  })

  it('privilégie leboncoin quand plusieurs diffusions sont en ligne', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LOGIC_IMMO, expired: false, price: 90_000 }),
      advert({ url: SELOGER, expired: false, price: 90_000 }),
      advert({ url: LBC, expired: false, price: 86_000, publisherType: 0 }),
    ]))

    expect(listing.url).toBe(LBC)
    expect(listing.price).toBe(86_000)
  })

  it('conserve les diffusions expirées dans adverts pour tracer la multi-diffusion', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, expired: true }),
      advert({ url: ENTRE_PARTICULIERS, expired: false }),
    ]))

    expect(listing.adverts).toHaveLength(2)
    expect(listing.adverts.map((a) => a.portal)).toEqual(['Leboncoin', 'Entre Particuliers'])
    expect(listing.adverts.find((a) => a.portal === 'Leboncoin')?.expired).toBe(true)
  })
})

describe('normalizeListing — champs du bien', () => {
  it('mappe pièces, chambres, DPE et GES depuis les noms de champs Stream Estate', () => {
    const listing = normalizeListing(propertyDocument([advert({ url: LBC })]))

    expect(listing.rooms).toBe(4)
    expect(listing.bedrooms).toBe(3)
    expect(listing.dpe).toBe('C')
    expect(listing.ges).toBe('B')
  })

  it('complète le terrain manquant au niveau bien avec celui de l’annonce', () => {
    const listing = normalizeListing(propertyDocument([advert({ url: LBC })]))
    expect(listing.landSurface).toBe(518)
  })
})

describe('normalizeListing — type de vendeur', () => {
  it('retient PAP dès qu’une diffusion en ligne est un particulier', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, expired: true, publisherType: 1 }),
      advert({ url: ENTRE_PARTICULIERS, expired: false, publisherType: 0 }),
    ]))

    expect(listing.sellerType).toBe('individual')
  })

  it('ne prend pas un contact « Propriétaire particulier » pour une agence', () => {
    // Cas réel : SeLoger renseigne `contact.agency = "Propriétaire particulier"`.
    const seloger = advert({ url: SELOGER, expired: false, publisherType: 1 })
    seloger.contact = { name: 'Particulier', agency: 'Propriétaire particulier' }

    const listing = normalizeListing(propertyDocument([seloger]))
    expect(listing.sellerType).toBe('individual')
  })

  it('classe en agence quand aucune diffusion en ligne n’est un particulier', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, expired: true, publisherType: 0 }),
      advert({ url: SELOGER, expired: false, publisherType: 1 }),
    ]))

    expect(listing.sellerType).toBe('agency')
  })
})

describe('périmètre de réconciliation', () => {
  // La réconciliation expire ce qui n'est pas remonté par un import exhaustif.
  // Mal cadrée, elle sortirait du marché des biens qui n'étaient pas dans le scan.
  it('traduit les codes de type de bien en libellés stockés en base', () => {
    expect(propertyTypeLabels([0, 1, 5])).toEqual(['Appartement', 'Maison', 'Terrain'])
    expect(propertyTypeLabels([1])).toEqual(['Maison'])
    expect(propertyTypeLabels([99])).toEqual([])
  })

  it('restreint le type de vendeur au périmètre scanné', () => {
    expect(sellerTypesForPublisherTypes([0])).toEqual(['individual'])
    expect(sellerTypesForPublisherTypes([1])).toEqual(['agency'])
    // Les deux types scannés → aucune restriction à appliquer côté requête.
    expect(sellerTypesForPublisherTypes([0, 1])).toEqual(['individual', 'agency'])
  })
})

describe('evaluateListingQuality', () => {
  const now = new Date('2026-08-14T12:00:00Z')

  it('accepte une annonce en ligne et récemment crawlée', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, lastCrawledAt: '2026-07-30T20:52:06+02:00' }),
    ], { lastCrawledAt: '2026-07-30T20:52:06+02:00' }))

    expect(evaluateListingQuality(listing, { now }).online).toBe(true)
  })

  it('écarte une annonce jamais recrawlée depuis 2023 malgré expired=false', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, lastCrawledAt: '2023-06-21T09:09:57+02:00' }),
    ], { lastCrawledAt: '2023-06-21T09:09:57+02:00', updatedAt: '2023-06-21T09:09:57+02:00' }))

    const quality = evaluateListingQuality(listing, { now })
    expect(quality.online).toBe(false)
    expect(quality.reasons).toContain('stale_crawl')
    expect(quality.crawlAgeDays).toBeGreaterThan(DEFAULT_MAX_CRAWL_AGE_DAYS)
  })

  it('écarte un bien dont toutes les diffusions sont expirées', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, expired: true }),
      advert({ url: SELOGER, expired: true }),
    ]))

    expect(listing.status).toBe('expired')
    expect(evaluateListingQuality(listing, { now }).reasons).toContain('expired')
  })

  it('écarte un prix jugé incohérent par Stream Estate', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, price: 1, coherentPrice: false }),
    ]))

    const quality = evaluateListingQuality(listing, { now })
    expect(quality.reasons).toContain('incoherent_price')
    expect(evaluateListingQuality(listing, { now, requireCoherentPrice: false }).reasons)
      .not.toContain('incoherent_price')
  })

  it('écarte une annonce sans prix exploitable', () => {
    const listing = normalizeListing(propertyDocument([advert({ url: LBC, price: 0 })], { price: 0 }))
    expect(evaluateListingQuality(listing, { now }).reasons).toContain('missing_price')
  })

  it('ne juge pas la fraîcheur quand le seuil est désactivé', () => {
    const listing = normalizeListing(propertyDocument([
      advert({ url: LBC, lastCrawledAt: '2023-06-21T09:09:57+02:00' }),
    ], { lastCrawledAt: '2023-06-21T09:09:57+02:00', updatedAt: '2023-06-21T09:09:57+02:00' }))

    expect(evaluateListingQuality(listing, { now, maxCrawlAgeDays: 0 }).online).toBe(true)
  })
})

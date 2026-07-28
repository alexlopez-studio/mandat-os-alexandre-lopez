import { describe, expect, it } from 'vitest'

import {
  adjustPricePerM2,
  buildDistribution,
  computeTension,
  detectSegments,
  matchSegment,
  median,
  percentChange,
  quantile,
} from '@/lib/avis-de-valeur/market-analysis'
import type { MarketYearData } from '@/lib/avis-de-valeur/types'

describe('median', () => {
  it('rend null sur un échantillon vide', () => {
    expect(median([])).toBeNull()
  })

  it('moyenne les deux valeurs centrales sur un effectif pair', () => {
    expect(median([1000, 2000, 3000, 4000])).toBe(2500)
  })
})

describe('quantile', () => {
  it('interpole entre deux valeurs', () => {
    expect(quantile([1000, 2000, 3000, 4000, 5000], 0.5)).toBe(3000)
    expect(quantile([1000, 2000], 0.25)).toBe(1250)
  })
})

describe('percentChange', () => {
  it('rend null quand la référence manque ou vaut zéro', () => {
    expect(percentChange(100, null)).toBeNull()
    expect(percentChange(100, 0)).toBeNull()
  })

  it('arrondit au dixième', () => {
    expect(percentChange(2130, 2121)).toBe(0.4)
  })
})

describe('detectSegments', () => {
  it('sépare deux blocs quand le marché est bimodal', () => {
    // Bâti de village d'un côté, biens rénovés de l'autre, rien entre les deux.
    const prices = [2100, 2180, 2250, 2300, 2380, 2450, 2500, 2550, 3050, 3200, 3400, 3600, 3850]

    const segments = detectSegments(prices)

    expect(segments).toHaveLength(2)
    expect(segments[0].label).toBe('Bloc bas')
    expect(segments[0].highPricePerM2).toBe(2550)
    expect(segments[1].label).toBe('Bloc haut')
    expect(segments[1].lowPricePerM2).toBe(3050)
    // Le vide entre les blocs dépasse 45 % : c'est bien une différence de nature.
    expect(segments[1].medianPricePerM2 / segments[0].medianPricePerM2).toBeGreaterThan(1.2)
  })

  it('rend un segment unique quand aucune rupture nette n’existe', () => {
    const prices = [2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900]

    const segments = detectSegments(prices)

    expect(segments).toHaveLength(1)
    expect(segments[0].label).toBe('Segment unique')
  })

  it('ne segmente pas un échantillon trop petit pour être concluant', () => {
    expect(detectSegments([2000, 5000, 5100])).toHaveLength(1)
  })

  it('ignore une queue de distribution isolée', () => {
    // La valeur extrême est hors du cœur de la distribution : ce n'est pas une
    // frontière de segment, c'est une vente atypique.
    const prices = [2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400, 6000]

    expect(detectSegments(prices)).toHaveLength(1)
  })
})

describe('matchSegment', () => {
  const segments = detectSegments([2100, 2180, 2250, 2300, 2380, 2450, 2500, 2550, 3050, 3200, 3400, 3600, 3850])

  it('rattache un prix au bloc qui le contient', () => {
    expect(matchSegment(segments, 2300)).toBe('Bloc bas')
    expect(matchSegment(segments, 3300)).toBe('Bloc haut')
  })

  it('rattache un prix hors bornes au bloc dont la médiane est la plus proche', () => {
    expect(matchSegment(segments, 4500)).toBe('Bloc haut')
    expect(matchSegment(segments, 1500)).toBe('Bloc bas')
  })

  it('rend null sans prix', () => {
    expect(matchSegment(segments, null)).toBeNull()
  })
})

describe('buildDistribution', () => {
  it('répartit les ventes en tranches dont les parts totalisent environ 100 %', () => {
    const prices = Array.from({ length: 60 }, (_, index) => 1800 + index * 40)

    const bins = buildDistribution(prices)

    expect(bins).toHaveLength(5)
    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(prices.length)
    expect(bins.reduce((total, bin) => total + bin.percentage, 0)).toBeGreaterThanOrEqual(97)
  })

  it('renonce plutôt que de produire des tranches vides sur un échantillon minuscule', () => {
    expect(buildDistribution([2000, 2100])).toEqual([])
  })
})

describe('computeTension', () => {
  const series: MarketYearData[] = [
    { year: 2025, salesCount: 43, medianPrice: 399000, medianPricePerM2: 2130, pricePerM2Change: 0.4 },
    { year: 2024, salesCount: 60, medianPrice: 418735, medianPricePerM2: 2121, pricePerM2Change: 4.3 },
    { year: 2023, salesCount: 53, medianPrice: 444900, medianPricePerM2: 2034, pricePerM2Change: 9.4 },
    { year: 2022, salesCount: 74, medianPrice: 482500, medianPricePerM2: 1859, pricePerM2Change: 14.4 },
  ]

  it('calcule la rotation du parc quand le stock de logements est connu', () => {
    const tension = computeTension(series, 1700)

    expect(tension.rotationByYear[0]).toEqual({ year: 2025, rotation: 2.5 })
    expect(tension.rotationByYear[3]).toEqual({ year: 2022, rotation: 4.4 })
    expect(tension.reading).toContain('ralentit par les volumes')
  })

  it('mesure la contraction par les volumes, pas par les prix', () => {
    const tension = computeTension(series, 1700)

    // Les prix sont stables alors que les volumes chutent : c'est tout l'intérêt
    // de l'indicateur.
    expect(tension.volumeChange1y).toBeLessThan(-25)
    expect(tension.pricePerM2Change1y).toBeCloseTo(0.4, 1)
  })

  it('se rabat sur les variations quand le parc de logements est inconnu', () => {
    const tension = computeTension(series, null)

    expect(tension.rotationByYear.every((entry) => entry.rotation === null)).toBe(true)
    expect(tension.reading).toContain('Sur un an')
  })
})

describe('adjustPricePerM2', () => {
  const series: MarketYearData[] = [
    { year: 2025, salesCount: 43, medianPrice: null, medianPricePerM2: 2130, pricePerM2Change: null },
    { year: 2023, salesCount: 53, medianPrice: null, medianPricePerM2: 2034, pricePerM2Change: null },
  ]

  it('réactualise une vente ancienne à la dérive du marché', () => {
    // 2 000 €/m² signés en 2023 valent 2 094 €/m² au marché 2025.
    expect(adjustPricePerM2(2000, 2023, series)).toBe(2094)
  })

  it('laisse inchangée une vente de l’année de référence', () => {
    expect(adjustPricePerM2(2000, 2025, series)).toBe(2000)
  })

  it('rend null quand l’année de la vente n’a pas de médiane', () => {
    expect(adjustPricePerM2(2000, 2019, series)).toBeNull()
  })
})

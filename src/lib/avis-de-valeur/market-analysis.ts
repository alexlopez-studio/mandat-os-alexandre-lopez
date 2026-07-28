import type { MarketSegment, MarketTension, MarketYearData, PriceDistributionBin } from './types'

/**
 * Analyse de marché — fonctions pures, sans accès base.
 *
 * Tout ce qui relève du raisonnement d'estimation vit ici : c'est ce qui doit
 * survivre au rapport, à sa mise en page et à ses composants.
 */

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return Math.round(next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]))
}

/** Variation en pourcentage, arrondie au dixième. `null` si l'un des deux termes manque. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/**
 * Distribution des prix au m² en tranches régulières.
 *
 * Les bornes sont calées sur les déciles extrêmes pour qu'une vente aberrante
 * résiduelle n'étale pas toute l'échelle sur une tranche vide.
 */
export function buildDistribution(pricesPerM2: number[], binCount = 5): PriceDistributionBin[] {
  if (pricesPerM2.length < binCount) return []

  const low = quantile(pricesPerM2, 0.05)
  const high = quantile(pricesPerM2, 0.95)
  if (low === null || high === null || high <= low) return []

  const step = (high - low) / binCount
  const bins: PriceDistributionBin[] = []

  for (let i = 0; i < binCount; i += 1) {
    const lowerBound = Math.round(low + step * i)
    const upperBound = i === binCount - 1 ? Infinity : Math.round(low + step * (i + 1))
    const count = pricesPerM2.filter((price) =>
      i === 0
        ? price < upperBound
        : upperBound === Infinity
          ? price >= lowerBound
          : price >= lowerBound && price < upperBound,
    ).length

    bins.push({
      rangeLabel:
        i === 0
          ? `< ${formatEuroPerM2(upperBound)}`
          : upperBound === Infinity
            ? `> ${formatEuroPerM2(lowerBound)}`
            : `${formatEuroPerM2(lowerBound)} – ${formatEuroPerM2(upperBound)}`,
      lowerBound: i === 0 ? 0 : lowerBound,
      upperBound,
      count,
      percentage: Math.round((count / pricesPerM2.length) * 100),
    })
  }

  return bins
}

/**
 * Segmentation du marché avant médianisation.
 *
 * Sur les petites surfaces, le marché se répartit le plus souvent en deux blocs
 * séparés par un vide : bâti ancien sans extérieur d'un côté, biens rénovés ou
 * bien situés de l'autre. Une médiane globale tombe entre les deux, là où rien
 * ne se vend. On détecte le vide au lieu de le moyenner.
 *
 * Détection : plus grand écart relatif entre deux ventes consécutives, cherché
 * dans le cœur de la distribution (entre le 1er et le 3e quartile) pour ne pas
 * confondre une queue de distribution avec une frontière de segment.
 */
export function detectSegments(pricesPerM2: number[], minGapRatio = 0.12): MarketSegment[] {
  const sorted = [...pricesPerM2].sort((a, b) => a - b)
  const overallMedian = median(sorted)
  if (sorted.length < 8 || overallMedian === null) return singleSegment(sorted, overallMedian)

  const searchStart = Math.max(2, Math.floor(sorted.length * 0.25))
  const searchEnd = Math.min(sorted.length - 3, Math.ceil(sorted.length * 0.75))

  let bestIndex = -1
  let bestGap = 0
  for (let i = searchStart; i <= searchEnd; i += 1) {
    const gap = sorted[i + 1] - sorted[i]
    if (gap > bestGap) {
      bestGap = gap
      bestIndex = i
    }
  }

  if (bestIndex === -1 || bestGap / overallMedian < minGapRatio) return singleSegment(sorted, overallMedian)

  const lowBlock = sorted.slice(0, bestIndex + 1)
  const highBlock = sorted.slice(bestIndex + 1)

  return [
    {
      label: 'Bloc bas',
      description: 'Bâti ancien, sans extérieur ni stationnement privatif',
      lowPricePerM2: lowBlock[0],
      highPricePerM2: lowBlock[lowBlock.length - 1],
      medianPricePerM2: median(lowBlock) ?? lowBlock[0],
      count: lowBlock.length,
    },
    {
      label: 'Bloc haut',
      description: 'Rénové, ou bénéficiant d’un emplacement ou d’un attribut rare',
      lowPricePerM2: highBlock[0],
      highPricePerM2: highBlock[highBlock.length - 1],
      medianPricePerM2: median(highBlock) ?? highBlock[0],
      count: highBlock.length,
    },
  ]
}

function singleSegment(sorted: number[], overallMedian: number | null): MarketSegment[] {
  if (sorted.length === 0 || overallMedian === null) return []
  return [
    {
      label: 'Segment unique',
      description: 'Aucune rupture nette détectée : le marché comparable est homogène',
      lowPricePerM2: sorted[0],
      highPricePerM2: sorted[sorted.length - 1],
      medianPricePerM2: overallMedian,
      count: sorted.length,
    },
  ]
}

/** Bloc auquel appartient un prix au m² donné, ou `null` si hors de tous les blocs. */
export function matchSegment(segments: MarketSegment[], pricePerM2: number | null): string | null {
  if (pricePerM2 === null || segments.length === 0) return null
  const exact = segments.find((s) => pricePerM2 >= s.lowPricePerM2 && pricePerM2 <= s.highPricePerM2)
  if (exact) return exact.label
  // Hors bornes : on rattache au bloc dont la médiane est la plus proche.
  return segments.reduce((closest, s) =>
    Math.abs(s.medianPricePerM2 - pricePerM2) < Math.abs(closest.medianPricePerM2 - pricePerM2) ? s : closest,
  ).label
}

/**
 * Tension du marché mesurée par les volumes.
 *
 * La DVF ne contient pas de délai de vente. La rotation du parc — part du stock
 * communal qui change de mains chaque année — en est le substitut défendable :
 * un marché s'ajuste d'abord par les volumes, ensuite seulement par les prix.
 */
export function computeTension(yearSeries: MarketYearData[], housingStock: number | null): MarketTension {
  const rotationByYear = yearSeries.map((entry) => ({
    year: entry.year,
    rotation: housingStock && housingStock > 0 ? Math.round((entry.salesCount / housingStock) * 1000) / 10 : null,
  }))

  const [latest, previous] = yearSeries
  const volumeChange1y = latest && previous ? percentChange(latest.salesCount, previous.salesCount) : null
  const pricePerM2Change1y = latest && previous ? percentChange(latest.medianPricePerM2, previous.medianPricePerM2) : null

  return {
    rotationByYear,
    housingStock,
    volumeChange1y,
    pricePerM2Change1y,
    reading: buildTensionReading(rotationByYear, volumeChange1y, pricePerM2Change1y),
  }
}

function buildTensionReading(
  rotationByYear: Array<{ year: number; rotation: number | null }>,
  volumeChange1y: number | null,
  pricePerM2Change1y: number | null,
): string | null {
  const known = rotationByYear.filter((entry) => entry.rotation !== null)
  if (known.length >= 2) {
    const recent = known[0]
    const oldest = known[known.length - 1]
    if (recent.rotation !== null && oldest.rotation !== null && oldest.rotation > 0) {
      const drop = Math.round(((oldest.rotation - recent.rotation) / oldest.rotation) * 100)
      if (drop >= 15) {
        return `La rotation du parc passe de ${formatPercent(oldest.rotation)} en ${oldest.year} à ${formatPercent(recent.rotation)} en ${recent.year}, soit ${drop} % de rythme en moins. Le marché ralentit par les volumes avant de ralentir par les prix : c'est dans ce contexte qu'un bien surévalué reste en vitrine sans trouver preneur.`
      }
      if (drop <= -15) {
        return `La rotation du parc remonte de ${formatPercent(oldest.rotation)} en ${oldest.year} à ${formatPercent(recent.rotation)} en ${recent.year}. Le marché se réanime par les volumes, ce qui précède généralement la tenue des prix.`
      }
      return `La rotation du parc reste stable, autour de ${formatPercent(recent.rotation)} par an. Les volumes n'envoient pas de signal d'accélération ni de blocage.`
    }
  }

  if (volumeChange1y !== null && pricePerM2Change1y !== null) {
    return `Sur un an, les volumes évoluent de ${formatSignedPercent(volumeChange1y)} et le prix médian au m² de ${formatSignedPercent(pricePerM2Change1y)}.`
  }

  return null
}

/**
 * Réactualisation d'un comparable ancien.
 *
 * Un comparable vieux de deux ans sur un marché en recul doit être corrigé
 * avant d'être présenté, sinon il tire l'estimation vers un marché qui n'existe
 * plus. La correction utilise la dérive du prix médian au m² de la commune.
 */
export function adjustPricePerM2(
  pricePerM2: number,
  saleYear: number,
  yearSeries: MarketYearData[],
): number | null {
  const reference = yearSeries[0]
  const atSale = yearSeries.find((entry) => entry.year === saleYear)
  if (!reference?.medianPricePerM2 || !atSale?.medianPricePerM2) return null
  if (reference.year === saleYear) return pricePerM2
  return Math.round(pricePerM2 * (reference.medianPricePerM2 / atSale.medianPricePerM2))
}

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100
}

function formatEuroPerM2(value: number) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} €`
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} %`
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} %`
}

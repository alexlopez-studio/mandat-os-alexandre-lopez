'use client'

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

import type { MarketYearData } from '@/lib/avis-de-valeur/types'

/**
 * Volumes de ventes et prix médian au m², par année.
 *
 * Dimensions fixes et non responsives : le document est destiné au papier, et
 * un conteneur responsive rend une zone vide tant que l'hydratation n'a pas eu
 * lieu — ce qui suffit à sortir un PDF sans graphique. Pas d'animation non plus,
 * pour la même raison.
 */
export function MarketChart({
  series,
  width = 392,
  height = 176,
}: {
  series: MarketYearData[]
  width?: number
  height?: number
}) {
  // La série arrive du plus récent au plus ancien : on la remet dans le sens de lecture.
  const data = [...series].reverse().map((entry) => ({
    year: String(entry.year),
    salesCount: entry.salesCount,
    medianPricePerM2: entry.medianPricePerM2,
  }))

  const prices = data.map((entry) => entry.medianPricePerM2).filter((value): value is number => value !== null)
  const min = prices.length ? Math.floor((Math.min(...prices) * 0.9) / 100) * 100 : 0
  const max = prices.length ? Math.ceil((Math.max(...prices) * 1.1) / 100) * 100 : 100

  return (
    <ComposedChart width={width} height={height} data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E9FCFF" />
      <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#006390', fontWeight: 700 }} />
      <YAxis yAxisId="volumes" tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} />
      <YAxis
        yAxisId="prices"
        orientation="right"
        domain={[min, max]}
        tick={{ fontSize: 9, fill: '#008EC3' }}
        width={44}
      />
      <Bar yAxisId="volumes" dataKey="salesCount" fill="#006390" radius={[3, 3, 0, 0]} barSize={22} isAnimationActive={false} />
      <Line
        yAxisId="prices"
        type="monotone"
        dataKey="medianPricePerM2"
        stroke="#00b4ec"
        strokeWidth={2.5}
        dot={{ r: 3.5, fill: '#00b4ec' }}
        isAnimationActive={false}
        connectNulls
      />
    </ComposedChart>
  )
}

import { Activity, BarChart3, Layers, TrendingUp } from 'lucide-react'

import { A4Page } from '../a4-page'
import { KpiTile } from '../kpi-tile'
import { MarketChart } from '../market-chart'
import { DVF_SOURCE_LABEL } from '@/lib/avis-de-valeur/advisor'
import { BLANK, formatNumber, formatPercent, formatPricePerM2 } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'

/**
 * Le marché communal.
 *
 * Uniquement des ventes signées. Les prix demandés sont traités page stratégie,
 * et jamais dans le même graphique : ils ne se comparent pas, ils se lisent
 * côte à côte.
 */
export function PageLeMarche({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { market, advisor } = avis
  const latest = market.yearSeries[0]

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle={`Le marché • ${market.cityName}`}
      isDarkHeader
      heroStat={{
        value: formatPricePerM2(market.medianPricePerM2),
        label: 'Médiane des ventes signées',
      }}
      advisor={advisor}
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-3 gap-2.5">
          <KpiTile
            label="Ventes sur 5 ans"
            value={formatNumber(market.totalSales5y)}
            unit="mutations"
            context={`${formatNumber(latest?.salesCount ?? null)} en ${latest?.year ?? BLANK}`}
            variance={
              market.tension.volumeChange1y !== null
                ? {
                    value: formatPercent(market.tension.volumeChange1y, { signed: true }),
                    isNegative: market.tension.volumeChange1y < 0,
                  }
                : undefined
            }
            icon={BarChart3}
          />
          <KpiTile
            label="Prix médian au m²"
            value={formatNumber(latest?.medianPricePerM2 ?? null)}
            unit="€/m²"
            context="Prix effectivement payés"
            variance={
              market.tension.pricePerM2Change1y !== null
                ? {
                    value: formatPercent(market.tension.pricePerM2Change1y, { signed: true }),
                    isNegative: market.tension.pricePerM2Change1y < 0,
                  }
                : undefined
            }
            icon={TrendingUp}
          />
          <KpiTile
            label="Prix médian"
            value={formatNumber(latest?.medianPrice ?? null)}
            unit="€"
            context={`Toutes surfaces, ${latest?.year ?? BLANK}`}
            icon={Layers}
          />
        </div>

        <div className="grid grid-cols-12 items-start gap-3.5">
          <div className="col-span-7 space-y-2 rounded-lg border border-[#CDF7FF] bg-white p-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
                <BarChart3 className="h-3.5 w-3.5 text-[#00b4ec]" />
                Volumes et prix médian au m² (5 ans)
              </span>
              <span className="flex items-center gap-2 text-[9px] font-bold">
                <span className="flex items-center gap-1 text-[#006390]">
                  <span className="h-2 w-2 rounded bg-[#006390]" />
                  Ventes
                </span>
                <span className="flex items-center gap-1 text-[#008EC3]">
                  <span className="h-2 w-2 rounded bg-[#00b4ec]" />
                  €/m²
                </span>
              </span>
            </div>

            {market.yearSeries.length > 0 ? (
              <MarketChart series={market.yearSeries} />
            ) : (
              <p className="py-12 text-center text-[10pt] italic text-slate-400">
                Aucune mutation DVF disponible pour cette commune.
              </p>
            )}

            <p className="border-t border-slate-100 pt-1 text-[8.5px] font-medium uppercase tracking-wider text-slate-400">
              {DVF_SOURCE_LABEL}
            </p>
          </div>

          <div className="col-span-5 space-y-3.5">
            <div className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF] p-3.5">
              <div className="mb-2.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
                <Activity className="h-3.5 w-3.5 text-[#00b4ec]" />
                Distribution des prix au m²
              </div>

              {market.distribution.length > 0 ? (
                <div className="space-y-2">
                  {market.distribution.map((bin) => (
                    <div key={bin.rangeLabel} className="space-y-0.5">
                      <div className="flex justify-between text-[9.5px] font-semibold text-slate-700">
                        <span>{bin.rangeLabel}</span>
                        <span className="font-bold text-[#006390]">
                          {bin.percentage} % ({bin.count})
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full border border-[#CDF7FF] bg-white">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#006390] to-[#00b4ec]"
                          style={{ width: `${bin.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10pt] italic text-slate-400">
                  Échantillon insuffisant pour établir une distribution.
                </p>
              )}
            </div>

            <div className="rounded-lg border-l-4 border-[#25CFFF] bg-[#006390] p-3 text-white">
              <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-cyan-200">
                Ventes signées, pas prix affichés
              </div>
              <p className="text-[10pt] font-normal leading-normal text-slate-100">
                Tous les chiffres de cette page proviennent des mutations enregistrées par la DGFiP. Ce sont
                des montants effectivement payés devant notaire, opposables, et non des prix demandés sur
                les portails.
              </p>
            </div>
          </div>
        </div>

        {market.yearSeries.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#CDF7FF] bg-white">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="bg-[#E9FCFF] text-[8.5px] font-extrabold uppercase tracking-wider text-[#006390]">
                  <th className="p-2">Année</th>
                  <th className="p-2">Ventes signées</th>
                  <th className="p-2">Prix médian</th>
                  <th className="p-2">Médiane €/m²</th>
                  <th className="p-2">Variation €/m²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {market.yearSeries.map((entry) => (
                  <tr key={entry.year}>
                    <td className="p-2 font-bold text-[#006390]">{entry.year}</td>
                    <td className="p-2 font-semibold">{formatNumber(entry.salesCount)}</td>
                    <td className="p-2">{formatNumber(entry.medianPrice)} €</td>
                    <td className="p-2 font-bold">{formatNumber(entry.medianPricePerM2)} €/m²</td>
                    <td
                      className={`p-2 font-bold ${
                        entry.pricePerM2Change !== null && entry.pricePerM2Change < 0
                          ? 'text-[#ea584a]'
                          : 'text-[#008EC3]'
                      }`}
                    >
                      {formatPercent(entry.pricePerM2Change, { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </A4Page>
  )
}

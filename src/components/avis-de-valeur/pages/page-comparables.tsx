import { Building2, Layers, MapPin } from 'lucide-react'

import { A4Page } from '../a4-page'
import { SituationMap } from '../situation-map'
import { DVF_SOURCE_LABEL } from '@/lib/avis-de-valeur/advisor'
import { BLANK, formatDistance, formatMonthYear, formatNumber, formatPrice } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { AvisDeValeur } from '@/lib/avis-de-valeur/types'

/**
 * Biens comparables — ventes signées uniquement.
 *
 * Trois filtres, dans cet ordre : surface (±22 %), emprise foncière (le filtre
 * le plus souvent oublié et celui qui fausse le plus), puis date avec
 * réactualisation. Aucune annonce en cours n'apparaît dans ce tableau.
 */
export function PageComparables({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { comparables, advisor, property, valuation, market } = avis
  const dvfReference = valuation.references.find((reference) => reference.id === 'dvf')

  // L'écart entre blocs est l'argument : le chiffrer plutôt que le décrire.
  const segmentGap =
    market.segments.length === 2 && market.segments[0].medianPricePerM2 > 0
      ? Math.round(
          ((market.segments[1].medianPricePerM2 - market.segments[0].medianPricePerM2) /
            market.segments[0].medianPricePerM2) *
            100,
        )
      : null

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Biens comparables • ventes signées"
      isDarkHeader
      heroStat={{
        value: String(comparables.length),
        label: comparables.length > 1 ? 'ventes retenues' : 'vente retenue',
      }}
      advisor={advisor}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-[#CDF7FF] bg-[#E9FCFF] p-3 text-[10.5px]">
          <span className="flex items-center gap-2 font-bold text-[#006390]">
            <Building2 className="h-4 w-4 text-[#00b4ec]" />
            Surface {property.livingSurface ? `${formatNumber(property.livingSurface)} m² ± 22 %` : 'comparable'},
            emprise foncière comparable, ventes des 4 dernières années
          </span>
          <span className="text-[9px] font-semibold uppercase text-slate-500">Prix payés, pas prix demandés</span>
        </div>

        <div className="grid grid-cols-12 items-start gap-3">
          <div className="col-span-8 overflow-hidden rounded-xl border border-[#CDF7FF] bg-white">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="bg-[#006390] text-[8.5px] font-extrabold uppercase tracking-wider text-white">
                  <th className="px-1.5 py-1.5">#</th>
                  <th className="px-1.5 py-1.5">Adresse</th>
                  <th className="px-1.5 py-1.5">Surf.</th>
                  <th className="px-1.5 py-1.5">Terrain</th>
                  <th className="px-1.5 py-1.5">Prix</th>
                  <th className="px-1.5 py-1.5">€/m²</th>
                  <th className="px-1.5 py-1.5">Actualisé</th>
                  <th className="px-1.5 py-1.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {comparables.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-[10pt] italic text-slate-400">
                      Aucune vente comparable sur la période et les filtres retenus.
                    </td>
                  </tr>
                )}
                {comparables.map((comparable, index) => (
                  <tr key={comparable.id} className={index % 2 === 0 ? 'bg-white' : 'bg-[#E9FCFF]/30'}>
                    <td className="px-1.5 py-1">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#008EC3] text-[8px] font-bold text-white">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-1.5 py-1 text-[9.5px] font-bold leading-tight text-slate-900">
                      <span className="flex items-start gap-1">
                        <MapPin className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#00b4ec]" />
                        <span>
                          {formatAddress(comparable.address)}
                          <span className="font-normal text-slate-500">
                            {comparable.distanceKm !== null ? ` · ${formatDistance(comparable.distanceKm)}` : ''}
                            {comparable.roomsCount ? ` · ${comparable.roomsCount} p.` : ''}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-1.5 py-1 font-bold text-[#006390]">{formatNumber(comparable.surface)} m²</td>
                    <td className="px-1.5 py-1 text-slate-600">
                      {comparable.landSurface ? `${formatNumber(comparable.landSurface)} m²` : BLANK}
                    </td>
                    <td className="px-1.5 py-1 font-extrabold text-slate-900">{formatPrice(comparable.price)}</td>
                    <td className="px-1.5 py-1 font-bold text-slate-700">{formatNumber(comparable.pricePerM2)}</td>
                    <td className="px-1.5 py-1 font-extrabold text-[#008EC3]">
                      {comparable.adjustedPricePerM2 !== null ? formatNumber(comparable.adjustedPricePerM2) : BLANK}
                    </td>
                    <td className="px-1.5 py-1 whitespace-nowrap text-slate-600">
                      {formatMonthYear(comparable.saleDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="col-span-4 space-y-2">
            <div className="text-[9.5px] font-extrabold uppercase tracking-widest text-[#006390]">
              Plan de situation
            </div>
            <SituationMap property={property} comparables={comparables} width={222} height={168} />
            <p className="text-[8.5px] leading-snug text-slate-500">
              Le point cyan est votre bien. Les positions sont relatives, à l&apos;échelle indiquée.
            </p>
          </div>
        </div>

        {market.segments.length > 0 && (
          <div className="space-y-2 rounded-xl border border-[#CDF7FF] bg-[#E9FCFF]/60 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
                <Layers className="h-3.5 w-3.5 text-[#00b4ec]" />
                Deux blocs de marché, pas une moyenne
              </span>
              {market.matchedSegmentLabel && (
                <span className="rounded bg-[#006390] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Votre bien : {market.matchedSegmentLabel}
                </span>
              )}
            </div>

            <div className={`grid gap-2.5 ${market.segments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {market.segments.map((segment) => (
                <div
                  key={segment.label}
                  className={`rounded-lg p-2.5 ${
                    segment.label === market.matchedSegmentLabel
                      ? 'border-2 border-[#00b4ec] bg-white'
                      : 'border border-[#CDF7FF] bg-white/70'
                  }`}
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#006390]">
                    {segment.label}
                  </div>
                  <div className="avv-figure text-lg font-black text-[#006390]">
                    {formatNumber(segment.lowPricePerM2)} – {formatNumber(segment.highPricePerM2)}
                    <span className="ml-1 text-[10px] font-semibold text-[#008EC3]">€/m²</span>
                  </div>
                  <p className="text-[9.5px] leading-snug text-slate-600">{segment.description}</p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-500">
                    Médiane {formatNumber(segment.medianPricePerM2)} €/m² • {segment.count} vente
                    {segment.count > 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>

            {segmentGap !== null && (
              <p className="text-[9.5px] leading-snug text-slate-600">
                <strong className="text-[#006390]">{segmentGap} % d&apos;écart</strong> entre les deux blocs, et
                aucune vente entre les deux. Appliquer une médiane communale globale placerait votre bien
                exactement dans ce vide, là où rien ne se vend. Le positionnement se fait donc à l&apos;intérieur
                d&apos;un bloc.
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border-l-4 border-[#25CFFF] bg-[#006390] p-3 text-white">
          <h4 className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-cyan-200">
            Lecture de l&apos;échantillon
          </h4>
          <p className="text-[10pt] font-normal leading-normal text-slate-100">
            {comparables.length > 0 && dvfReference?.pricePerM2
              ? `Les ventes retenues s'établissent à ${formatNumber(dvfReference.pricePerM2)} €/m² en médiane, une fois corrigées de la dérive du marché depuis leur date de signature. C'est cette valeur, et non un prix affiché, qui sert de base au positionnement.`
              : 'Échantillon insuffisant pour établir une médiane opposable. Élargir la tolérance de surface ou la période avant de conclure.'}
          </p>
        </div>

        <p className="text-[8.5px] font-medium uppercase tracking-wider text-slate-400">{DVF_SOURCE_LABEL}</p>
      </div>
    </A4Page>
  )
}

/**
 * La DVF écrit les voies en abrégé et en capitales. On rétablit une casse
 * lisible sans réécrire l'adresse : c'est une donnée officielle, pas un texte.
 */
function formatAddress(address: string | null): string {
  if (!address) return 'Adresse non communiquée'
  return address
    .toLocaleLowerCase('fr-FR')
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toLocaleUpperCase('fr-FR') + word.slice(1) : word))
    .join(' ')
}

import { Clock, Gauge, PackageSearch, TrendingDown } from 'lucide-react'

import { A4Page } from '../a4-page'
import { KpiTile } from '../kpi-tile'
import { BLANK, formatNumber, formatPercent } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'

/**
 * Tension du marché.
 *
 * La DVF ne contient pas de délai de vente. La rotation du parc — part du stock
 * communal qui change de mains chaque année — en est le substitut défendable,
 * parce qu'elle repose sur des ventes signées et non sur des déclarations.
 *
 * Le message tient en une phrase : un marché s'ajuste d'abord par les volumes,
 * ensuite seulement par les prix affichés. C'est le contexte dans lequel un bien
 * surévalué reste en vitrine sans trouver preneur.
 */
export function PageTensionMarche({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { market, advisor } = avis
  const { tension } = market

  const known = tension.rotationByYear.filter(
    (entry): entry is { year: number; rotation: number } => entry.rotation !== null,
  )
  const latestRotation = known[0] ?? null
  const oldestRotation = known[known.length - 1] ?? null
  const rotationDrop =
    latestRotation && oldestRotation && oldestRotation.rotation > 0
      ? Math.round(((oldestRotation.rotation - latestRotation.rotation) / oldestRotation.rotation) * 100)
      : null

  // Sans parc communal, la contraction se lit sur les volumes bruts. Sans ce
  // repli, la page affirmerait que le rythme « reste comparable » à côté d'un
  // indicateur qui annonce le contraire — exactement la contradiction interne
  // qui ruine la crédibilité du document.
  const firstYear = market.yearSeries[market.yearSeries.length - 1]
  const lastYear = market.yearSeries[0]
  const volumeDrop =
    rotationDrop ??
    (firstYear && lastYear && firstYear.salesCount > 0
      ? Math.round(((firstYear.salesCount - lastYear.salesCount) / firstYear.salesCount) * 100)
      : null)

  const maxRotation = known.length > 0 ? Math.max(...known.map((entry) => entry.rotation)) : 0
  const volumes = market.yearSeries.map((entry) => entry.salesCount)
  const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 0

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Tension du marché"
      isDarkHeader
      heroStat={{
        value: latestRotation ? formatPercent(latestRotation.rotation) : BLANK,
        label: 'du parc vendu par an',
      }}
      advisor={advisor}
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-3 gap-2.5">
          <KpiTile
            label="Rotation du parc"
            value={latestRotation ? formatPercent(latestRotation.rotation) : BLANK}
            context={
              tension.housingStock
                ? `${formatNumber(tension.housingStock)} logements recensés`
                : 'Parc communal à renseigner'
            }
            variance={
              rotationDrop !== null && rotationDrop !== 0
                ? { value: `${rotationDrop > 0 ? '−' : '+'}${Math.abs(rotationDrop)} % sur 5 ans`, isNegative: rotationDrop > 0 }
                : undefined
            }
            icon={Gauge}
          />
          <KpiTile
            label="Volumes sur un an"
            value={formatPercent(tension.volumeChange1y, { signed: true })}
            context="Nombre de ventes signées"
            icon={TrendingDown}
          />
          <KpiTile
            label="Prix sur un an"
            value={formatPercent(tension.pricePerM2Change1y, { signed: true })}
            context="Médiane au m² des ventes"
            icon={PackageSearch}
          />
        </div>

        <div className="grid grid-cols-12 items-start gap-3.5">
          <div className="col-span-7 space-y-2 rounded-xl border border-[#CDF7FF] bg-white p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
              Part du parc vendue, année par année
            </div>

            {known.length > 0 ? (
              <div className="space-y-2 pt-1">
                {[...known].reverse().map((entry) => (
                  <div key={entry.year} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 text-[9.5px] font-bold text-[#006390]">{entry.year}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded border border-[#CDF7FF] bg-[#E9FCFF]">
                      <div
                        className="flex h-full items-center justify-end rounded bg-gradient-to-r from-[#006390] to-[#00b4ec] pr-1.5 text-[8.5px] font-bold text-white"
                        style={{ width: `${maxRotation > 0 ? (entry.rotation / maxRotation) * 100 : 0}%` }}
                      >
                        {formatPercent(entry.rotation)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-[10pt] italic leading-snug text-slate-400">
                  Le parc de logements de la commune n&apos;est pas renseigné : la rotation ne peut pas être
                  calculée. Les volumes bruts sont présentés à la place.
                </p>
                {[...market.yearSeries].reverse().map((entry) => (
                  <div key={entry.year} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 text-[9.5px] font-bold text-[#006390]">{entry.year}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded border border-[#CDF7FF] bg-[#E9FCFF]">
                      <div
                        className="flex h-full items-center justify-end rounded bg-gradient-to-r from-[#006390] to-[#00b4ec] pr-1.5 text-[8.5px] font-bold text-white"
                        style={{ width: `${maxVolume > 0 ? (entry.salesCount / maxVolume) * 100 : 0}%` }}
                      >
                        {formatNumber(entry.salesCount)} ventes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-5 space-y-3">
            <div className="rounded-xl border-l-4 border-[#25CFFF] bg-[#006390] p-3.5 text-white">
              <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-cyan-200">
                Ce que disent les volumes
              </div>
              <p className="text-[10pt] font-normal leading-normal text-slate-100">
                {tension.reading ?? 'Série insuffisante pour établir une lecture de tension.'}
              </p>
            </div>

            <DelayCard delay={market.salesDelay} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Consequence
            title="Sur les stocks"
            text={
              volumeDrop !== null && volumeDrop >= 15
                ? `Le nombre de ventes recule de ${volumeDrop} % sur la période, à parc de logements inchangé : les biens restent plus longtemps en vitrine et la concurrence s’accumule.`
                : volumeDrop !== null && volumeDrop <= -15
                  ? `Le nombre de ventes progresse de ${Math.abs(volumeDrop)} % sur la période : le stock s’écoule plus vite qu’il ne se reconstitue.`
                  : 'Le rythme de transactions reste comparable d’une année sur l’autre : le stock s’écoule sans accumulation notable.'
            }
          />
          <Consequence
            title="Sur les délais"
            text="Un bien correctement positionné dès le premier jour capte les acquéreurs déjà financés. Passé quelques semaines, il ne reçoit plus que des visites de comparaison."
          />
          <Consequence
            title="Sur les prix"
            text={
              tension.pricePerM2Change1y !== null && Math.abs(tension.pricePerM2Change1y) < 2
                ? 'Les prix signés restent stables : l’ajustement du marché ne s’est pas encore traduit dans les montants, seulement dans les volumes.'
                : 'Les prix signés bougent : l’ajustement par les volumes a commencé à se répercuter sur les montants.'
            }
            highlighted
          />
        </div>
      </div>
    </A4Page>
  )
}

function DelayCard({ delay }: { delay: AvisPageProps['avis']['market']['salesDelay'] }) {
  if (!delay) {
    return (
      <div className="rounded-xl border border-dashed border-[#CDF7FF] bg-[#E9FCFF]/40 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-widest text-[#006390]">
          <Clock className="h-3.5 w-3.5 text-[#00b4ec]" />
          Délai de commercialisation
        </div>
        <p className="text-[9.5pt] leading-snug text-slate-600">
          Non renseigné. La DVF ne contient pas de délai de vente : aucun chiffre n&apos;est avancé ici
          plutôt qu&apos;un chiffre invérifiable. La rotation du parc en tient lieu.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#CDF7FF] bg-white p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-widest text-[#006390]">
        <Clock className="h-3.5 w-3.5 text-[#00b4ec]" />
        Délai de commercialisation
      </div>
      <div className="avv-figure mb-1 text-2xl font-black text-[#006390]">
        {formatNumber(delay.value.median)}
        <span className="ml-1 text-[10px] font-semibold text-[#008EC3]">jours en médiane</span>
      </div>
      <p className="text-[9.5px] text-slate-600">
        Quartile rapide {formatNumber(delay.value.fastQuartile)} jours · quartile lent{' '}
        {formatNumber(delay.value.slowQuartile)} jours
      </p>
      <p className="mt-1 text-[8.5px] uppercase tracking-wider text-slate-400">{delay.source}</p>
    </div>
  )
}

function Consequence({ title, text, highlighted = false }: { title: string; text: string; highlighted?: boolean }) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlighted ? 'border-2 border-[#00b4ec] bg-[#E9FCFF]' : 'border border-[#CDF7FF] bg-[#E9FCFF]/50'
      }`}
    >
      <div className="mb-1 text-[9.5px] font-extrabold uppercase tracking-wider text-[#006390]">{title}</div>
      <p className="text-[9.5pt] leading-snug text-slate-700">{text}</p>
    </div>
  )
}

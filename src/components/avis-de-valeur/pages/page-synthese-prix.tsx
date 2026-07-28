import { CheckCircle2, Sliders, Timer } from 'lucide-react'

import { A4Page } from '../a4-page'
import { BLANK, formatNumber, formatPercent, formatPrice, formatPricePerM2 } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { ValuationReference } from '@/lib/avis-de-valeur/types'

/**
 * Synthèse des prix.
 *
 * La page repose sur un seul écart : ce que les vendeurs demandent n'est pas ce
 * que les acquéreurs paient. Les trois références sont affichées côte à côte sur
 * une échelle commune, jamais fusionnées en une moyenne — c'est justement leur
 * écart qui porte l'argument.
 */
export function PageSynthesePrix({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { valuation, market, advisor, property } = avis

  const values = [
    ...valuation.references.map((reference) => reference.pricePerM2),
    ...market.segments.flatMap((segment) => [segment.lowPricePerM2, segment.highPricePerM2]),
    valuation.retainedPricePerM2,
  ].filter((value): value is number => value !== null && Number.isFinite(value))

  const scaleMin = values.length ? Math.floor((Math.min(...values) * 0.92) / 100) * 100 : 0
  const scaleMax = values.length ? Math.ceil((Math.max(...values) * 1.08) / 100) * 100 : 100
  const span = Math.max(1, scaleMax - scaleMin)
  const position = (value: number) => ((value - scaleMin) / span) * 100

  // Les délais dérivent de la saisie manuelle citée page Tension, jamais d'un
  // chiffre inventé : sans source, les trois scénarios restent sans durée.
  const medianDelay = market.salesDelay?.value.median ?? null
  const fastDelay = market.salesDelay?.value.fastQuartile ?? null
  const slowDelay = market.salesDelay?.value.slowQuartile ?? null

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Synthèse des prix • valeur retenue"
      advisor={advisor}
    >
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-3 rounded-xl border-y border-r border-l-8 border-[#CDF7FF] border-l-[#00b4ec] bg-gradient-to-r from-[#E9FCFF] via-[#CDF7FF]/50 to-white p-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-[#006390] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
                Valeur retenue
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#00b4ec]" />
                Comparaison directe sur ventes signées
              </span>
            </div>

            {/* Le prix est en cyan. Le corail iad est réservé aux alertes. */}
            <div className="avv-figure flex items-baseline gap-2 text-4xl font-black leading-tight text-[#00b4ec]">
              <span>{formatPrice(valuation.retainedPrice)}</span>
              <span className="text-xs font-bold tracking-normal text-[#006390]">honoraires inclus</span>
            </div>

            <p className="mt-1 text-[10.5pt] font-medium text-slate-700">
              Fourchette de négociation :{' '}
              <strong className="text-[#006390]">
                {valuation.priceRange ? formatPrice(valuation.priceRange[0]) : BLANK}
              </strong>{' '}
              à{' '}
              <strong className="text-[#006390]">
                {valuation.priceRange ? formatPrice(valuation.priceRange[1]) : BLANK}
              </strong>
            </p>
          </div>

          <div className="shrink-0 space-y-1.5 rounded-lg border border-[#CDF7FF] bg-white/80 p-2.5">
            <Row label="Prix au m² retenu" value={formatPricePerM2(valuation.retainedPricePerM2)} strong />
            <Row label="Surface retenue" value={property.livingSurface ? `${formatNumber(property.livingSurface)} m²` : BLANK} />
            <Row
              label={`Honoraires iad (${formatPercent(valuation.feePercent)})`}
              value={formatPrice(valuation.feeAmount)}
              accent
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[#CDF7FF] bg-white p-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
              <Sliders className="h-3.5 w-3.5 text-[#00b4ec]" />
              Trois références, une seule opposable
            </span>
            <span className="text-[9px] font-bold uppercase text-slate-500">
              Échelle {formatNumber(scaleMin)} – {formatNumber(scaleMax)} €/m²
            </span>
          </div>

          <div className="space-y-2.5">
            {valuation.references.map((reference) => (
              <ReferenceRow key={reference.id} reference={reference} position={position} />
            ))}
          </div>

          <p className="border-t border-slate-100 pt-2 text-[9.5px] leading-snug text-slate-600">
            Les prix demandés et les prix payés ne se comparent pas : ils se lisent côte à côte. Un rapport qui ne
            montrerait que la sortie du moteur d&apos;estimation exposerait le bien à plusieurs mois de vitrine.
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-[#CDF7FF] bg-white p-3.5">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
            <Timer className="h-3.5 w-3.5 text-[#00b4ec]" />
            Prix de départ et délai de vente attendu
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <DelayScenario
              label="Sous la fourchette"
              price={valuation.priceRange ? valuation.priceRange[0] : null}
              delay={fastDelay}
              note="Capte immédiatement les acquéreurs déjà financés."
            />
            <DelayScenario
              label="Prix retenu"
              price={valuation.retainedPrice}
              delay={medianDelay}
              note="Équilibre entre valeur nette et délai de commercialisation."
              highlighted
            />
            <DelayScenario
              label="Au-dessus"
              price={valuation.priceRange ? valuation.priceRange[1] : null}
              delay={slowDelay}
              note="Le bien s’use en vitrine, puis se négocie sous le prix retenu."
            />
          </div>

          <p className="text-[9.5px] leading-snug text-slate-600">
            Un surpositionnement au lancement ne se rattrape pas : il allonge le délai, puis se solde par une
            décote supérieure à l&apos;ajustement qu&apos;il aurait fallu consentir au départ.
          </p>
        </div>
      </div>
    </A4Page>
  )
}

function ReferenceRow({
  reference,
  position,
}: {
  reference: ValuationReference
  position: (value: number) => number
}) {
  const hasValue = reference.pricePerM2 !== null

  return (
    <div
      className={`rounded-lg p-2.5 ${
        reference.isOpposable ? 'border-2 border-[#00b4ec] bg-[#E9FCFF]' : 'border border-slate-200 bg-slate-50'
      }`}
    >
      <div className="mb-1 flex items-center justify-between text-[10.5px]">
        <span className="flex items-center gap-2">
          <span className={`font-bold ${reference.isOpposable ? 'text-[#006390]' : 'text-slate-800'}`}>
            {reference.label}
          </span>
          {reference.isOpposable && (
            <span className="rounded bg-[#00b4ec] px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-white">
              Référence opposable
            </span>
          )}
        </span>
        <span className="font-extrabold text-slate-900">
          {formatPricePerM2(reference.pricePerM2)}
          {reference.price !== null && (
            <span className="ml-1 text-[9px] font-normal text-slate-500">
              (soit {formatPrice(reference.price)})
            </span>
          )}
        </span>
      </div>

      <div className="relative my-1.5 h-3 w-full rounded-full bg-slate-200">
        {hasValue && (
          <div
            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${
              reference.isOpposable ? 'bg-[#00b4ec]' : 'bg-[#006390]'
            }`}
            style={{ left: `${Math.min(100, Math.max(0, position(reference.pricePerM2!)))}%` }}
          >
            <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        )}
      </div>

      <p className="text-[9.5px] font-normal leading-snug text-slate-600">{reference.description}</p>
    </div>
  )
}

function DelayScenario({
  label,
  price,
  delay,
  note,
  highlighted = false,
}: {
  label: string
  price: number | null
  delay: number | null
  note: string
  highlighted?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-2.5 ${
        highlighted ? 'border-2 border-[#00b4ec] bg-[#E9FCFF]' : 'border border-slate-200 bg-slate-50'
      }`}
    >
      <div
        className={`mb-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
          highlighted ? 'text-[#006390]' : 'text-slate-500'
        }`}
      >
        {label}
      </div>
      <div className={`avv-figure font-black ${highlighted ? 'text-xl text-[#00b4ec]' : 'text-base text-slate-800'}`}>
        {formatPrice(price)}
      </div>
      <div className="mt-0.5 text-[9.5px] font-bold text-[#006390]">
        {delay !== null ? `≈ ${formatNumber(delay)} jours` : 'délai non estimé'}
      </div>
      <p className={`mt-1 text-[9px] leading-snug ${highlighted ? 'text-[#006390]' : 'text-slate-600'}`}>{note}</p>
    </div>
  )
}

function Row({
  label,
  value,
  strong = false,
  accent = false,
}: {
  label: string
  value: string
  strong?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[10.5px]">
      <span className="font-medium text-slate-600">{label}</span>
      <span
        className={
          accent ? 'font-extrabold text-[#008EC3]' : strong ? 'font-extrabold text-[#006390]' : 'font-bold text-slate-700'
        }
      >
        {value}
      </span>
    </div>
  )
}

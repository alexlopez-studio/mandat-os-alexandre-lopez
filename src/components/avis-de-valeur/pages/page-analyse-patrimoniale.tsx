import { AlertTriangle, Landmark, Scale, Wallet } from 'lucide-react'

import { A4Page } from '../a4-page'
import { NOTARY_DISCLAIMER } from '@/lib/avis-de-valeur/advisor'
import { BLANK, formatNumber, formatPercent, formatPrice } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { AvisDeValeur } from '@/lib/avis-de-valeur/types'

/**
 * Analyse patrimoniale.
 *
 * Ce que le vendeur regarde n'est pas le prix d'affichage mais le net vendeur,
 * puis ce qu'il lui reste une fois le prêt soldé. Ce dernier montant n'est pas
 * connu du conseiller : il est laissé en blanc, avec l'indication d'où le
 * trouver. Un blanc assumé vaut mieux qu'un chiffre inventé.
 */
export function PageAnalysePatrimoniale({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { valuation, patrimonial, advisor } = avis
  const feeShare =
    valuation.retainedPrice && valuation.feeAmount
      ? (valuation.feeAmount / valuation.retainedPrice) * 100
      : null

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Analyse patrimoniale • net vendeur et fiscalité"
      advisor={advisor}
    >
      <div className="space-y-3.5">
        <div className="space-y-3 rounded-xl border border-[#CDF7FF] bg-white p-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
              <Wallet className="h-3.5 w-3.5 text-[#00b4ec]" />
              Du prix affiché au capital disponible
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <Step
              index="1"
              title="Prix de vente"
              value={formatPrice(valuation.retainedPrice)}
              note="Honoraires inclus"
              tone="pale"
            />
            <Step
              index="2"
              title="Honoraires iad"
              value={valuation.feeAmount !== null ? `− ${formatPrice(valuation.feeAmount)}` : BLANK}
              note={`${formatPercent(valuation.feePercent)} du prix affiché`}
              tone="muted"
            />
            <Step
              index="3"
              title="Net vendeur"
              value={formatPrice(valuation.netProceeds)}
              note="Avant remboursement du prêt"
              tone="dark"
            />
            <Step
              index="4"
              title="Capital restant dû"
              value={valuation.outstandingLoan !== null ? `− ${formatPrice(valuation.outstandingLoan)}` : BLANK}
              note={
                valuation.outstandingLoan !== null
                  ? `Reste ${formatPrice((valuation.netProceeds ?? 0) - valuation.outstandingLoan)}`
                  : 'À reporter depuis votre relevé annuel de prêt'
              }
              tone="dashed"
            />
          </div>

          {feeShare !== null && (
            <div className="my-1 flex h-4 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              <div
                className="flex h-full items-center justify-center bg-[#006390] text-[8px] font-bold text-white"
                style={{ width: `${100 - feeShare}%` }}
              >
                Net vendeur {formatNumber(Math.round(100 - feeShare))} %
              </div>
              <div
                className="flex h-full items-center justify-center bg-slate-400 text-[8px] font-bold text-white"
                style={{ width: `${feeShare}%` }}
              >
                {formatNumber(Math.round(feeShare))} %
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {patrimonial.scenarios.map((scenario, index) => (
            <div
              key={scenario.title}
              className={`space-y-2 rounded-xl p-3.5 ${
                index === 0 ? 'border border-[#CDF7FF] bg-white' : 'border border-[#CDF7FF] bg-[#E9FCFF]/50'
              }`}
            >
              <div className="flex items-center gap-1.5 border-b border-[#CDF7FF] pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#006390]">
                {index === 0 ? (
                  <Wallet className="h-3.5 w-3.5 text-[#00b4ec]" />
                ) : (
                  <Scale className="h-3.5 w-3.5 text-[#006390]" />
                )}
                {scenario.title}
              </div>
              <ul className="space-y-1.5 text-[10pt] text-slate-700">
                {scenario.points.map((point) => (
                  <li key={point} className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4ec]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#CDF7FF] bg-white p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
            <Landmark className="h-3.5 w-3.5 text-[#00b4ec]" />
            Plus-value immobilière
          </div>
          <p className="text-[10pt] font-normal leading-normal text-slate-800">{patrimonial.capitalGainNote}</p>
          <p className="mt-1.5 text-[8.5px] uppercase tracking-wider text-slate-400">{NOTARY_DISCLAIMER}</p>
        </div>

        {/* Corail : réservé aux alertes et points de vigilance. Jamais un prix. */}
        <div className="rounded-xl border-y border-r border-l-4 border-[#ea584a]/30 border-l-[#ea584a] bg-[#ea584a]/10 p-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#ea584a]" />
            <h4 className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#ea584a]">
              Points de vigilance
            </h4>
          </div>
          <ul className="space-y-1 text-[10pt] leading-snug text-slate-800">
            {patrimonial.vigilance.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ea584a]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </A4Page>
  )
}

function Step({
  index,
  title,
  value,
  note,
  tone,
}: {
  index: string
  title: string
  value: string
  note: string
  tone: 'pale' | 'muted' | 'dark' | 'dashed'
}) {
  const styles = {
    pale: 'border border-[#CDF7FF] bg-[#E9FCFF]',
    muted: 'border border-slate-200 bg-slate-50',
    dark: 'border-b-2 border-[#00b4ec] bg-[#006390] text-white',
    dashed: 'border-2 border-dashed border-[#00b4ec] bg-[#CDF7FF]/40',
  }[tone]

  const valueColor = tone === 'dark' ? 'text-[#25CFFF]' : tone === 'muted' ? 'text-slate-700' : 'text-[#006390]'
  const titleColor = tone === 'dark' ? 'text-cyan-200' : tone === 'muted' ? 'text-slate-600' : 'text-[#006390]'
  const noteColor = tone === 'dark' ? 'text-white/80' : 'text-slate-500'

  return (
    <div className={`rounded-lg p-2.5 ${styles}`}>
      <div className={`mb-0.5 text-[8.5px] font-extrabold uppercase ${titleColor}`}>
        {index}. {title}
      </div>
      <div className={`avv-figure text-base font-extrabold ${valueColor}`}>{value}</div>
      <div className={`text-[8px] font-medium leading-tight ${noteColor}`}>{note}</div>
    </div>
  )
}

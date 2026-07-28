import { CheckCircle2, MessageSquareQuote, Sparkles } from 'lucide-react'

import { A4Page } from '../a4-page'
import { formatDate, formatPercent, formatPrice, formatPricePerM2 } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'

/**
 * Conclusion et avis de valeur.
 *
 * La page que le vendeur relira. Elle rappelle d'où vient le prix avant de
 * l'annoncer : rappel de méthode, atouts qui font sortir le bien de son bloc,
 * objections anticipées, puis l'encadré de valeur avec le net vendeur.
 */
export function PageConclusion({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { valuation, opinion, market, advisor, property, seller } = avis
  const dvfReference = valuation.references.find((reference) => reference.id === 'dvf')

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Conclusion & avis de valeur"
      advisor={advisor}
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-[#CDF7FF] bg-[#E9FCFF]/50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
            <Sparkles className="h-3.5 w-3.5 text-[#00b4ec]" />
            La méthode en une phrase
          </div>
          <p className="text-[10pt] leading-snug text-slate-800">
            {dvfReference?.pricePerM2
              ? `Le prix ne vient pas d'un algorithme ni des annonces du secteur, mais des ventes réellement signées devant notaire : ${dvfReference.description.toLowerCase()} Votre bien a ensuite été positionné à l'intérieur de son bloc de marché${market.matchedSegmentLabel ? ` — ${market.matchedSegmentLabel.toLowerCase()}` : ''}, en fonction de ce qui le distingue de ces ventes.`
              : 'Le prix repose sur les ventes réellement signées du secteur, corrigées de la dérive du marché, puis ajustées selon les caractéristiques propres au bien.'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6 space-y-2 rounded-xl border border-[#CDF7FF] bg-white p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#00b4ec]" />
              Ce qui distingue votre bien
            </div>
            {opinion.strengths.length > 0 ? (
              <ul className="space-y-1.5">
                {opinion.strengths.map((strength) => (
                  <li key={strength} className="flex items-start gap-1.5 text-[10pt] leading-snug text-slate-800">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4ec]" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10pt] italic text-slate-400">Atouts différenciants à renseigner.</p>
            )}
          </div>

          <div className="col-span-6 space-y-2 rounded-xl border border-[#CDF7FF] bg-white p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
              <MessageSquareQuote className="h-3.5 w-3.5 text-[#00b4ec]" />
              Objections anticipées
            </div>
            {opinion.objections.length > 0 ? (
              <div className="space-y-2">
                {opinion.objections.map((entry) => (
                  <div key={entry.objection}>
                    <p className="text-[9.5pt] font-semibold leading-snug text-[#ea584a]">« {entry.objection} »</p>
                    <p className="text-[9.5pt] leading-snug text-slate-700">{entry.response}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10pt] italic text-slate-400">
                Objections à préparer avant le rendez-vous de remise.
              </p>
            )}
          </div>
        </div>

        {opinion.conclusion && (
          <div className="rounded-xl border-l-4 border-[#25CFFF] bg-[#006390] p-3 text-white">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-cyan-200">
              Notre recommandation
            </div>
            <p className="whitespace-pre-line text-[10pt] font-normal leading-normal text-slate-100">
              {opinion.conclusion}
            </p>
          </div>
        )}

        <div className="rounded-xl border-y border-r border-l-8 border-[#CDF7FF] border-l-[#00b4ec] bg-gradient-to-r from-[#E9FCFF] via-[#CDF7FF]/50 to-white p-4">
          <div className="mb-1 text-[9px] font-extrabold uppercase tracking-widest text-[#006390]">
            Avis de valeur
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              {/* Le prix est en cyan. Le corail iad est réservé aux alertes. */}
              <div className="avv-figure text-4xl font-black leading-tight text-[#00b4ec]">
                {formatPrice(valuation.retainedPrice)}
              </div>
              <p className="text-[10.5pt] font-medium text-slate-700">
                honoraires inclus
                {valuation.retainedPricePerM2 !== null
                  ? ` — soit ${formatPricePerM2(valuation.retainedPricePerM2)}`
                  : ''}
              </p>
              {valuation.priceRange && (
                <p className="mt-0.5 text-[9.5pt] text-slate-600">
                  Fourchette de négociation : {formatPrice(valuation.priceRange[0])} à{' '}
                  {formatPrice(valuation.priceRange[1])}
                </p>
              )}
            </div>

            <div className="shrink-0 space-y-1 rounded-lg border border-[#CDF7FF] bg-white/80 p-2.5 text-[10.5px]">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Honoraires iad ({formatPercent(valuation.feePercent)})</span>
                <span className="font-bold text-[#008EC3]">{formatPrice(valuation.feeAmount)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-100 pt-1">
                <span className="font-semibold text-slate-700">Net vendeur</span>
                <span className="font-extrabold text-[#006390]">{formatPrice(valuation.netProceeds)}</span>
              </div>
            </div>
          </div>

          <p className="mt-2 border-t border-[#CDF7FF] pt-1.5 text-[8.5px] leading-snug text-slate-500">
            Avis de valeur remis à titre d&apos;information
            {seller.name ? ` à ${seller.civility ? `${seller.civility} ` : ''}${seller.name}` : ''}
            {property.address ? `, pour le bien situé ${property.address}` : ''}. Il ne constitue ni une
            expertise judiciaire, ni une garantie de prix de vente. Établi le {formatDate(avis.meta.generatedAt)}
            {avis.meta.visitedAt ? `, après visite du ${formatDate(avis.meta.visitedAt)}` : ''}.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[#CDF7FF] bg-white p-3">
          <p className="text-[9.5pt] leading-snug text-slate-600">
            Je reste disponible pour reprendre chacun de ces chiffres avec vous, et pour ajuster le
            positionnement si votre calendrier évolue.
          </p>
          <div className="shrink-0 border-l border-slate-100 pl-4 text-center">
            <div className="text-[9px] font-bold uppercase text-slate-500">Le conseiller</div>
            <div className="my-0.5 text-lg font-bold italic text-[#006390]">{advisor.name}</div>
            <div className="text-[9px] text-slate-500">{advisor.phone}</div>
          </div>
        </div>
      </div>
    </A4Page>
  )
}

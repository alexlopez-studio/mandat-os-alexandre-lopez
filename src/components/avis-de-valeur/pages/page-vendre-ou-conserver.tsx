import { HelpCircle, KeyRound, Wallet } from 'lucide-react'

import { A4Page } from '../a4-page'
import { NOTARY_DISCLAIMER } from '@/lib/avis-de-valeur/advisor'
import { BLANK, formatPrice, formatSurface } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'

/**
 * Page optionnelle — vendre ou conserver.
 *
 * Ne s'affiche que si le vendeur hésite réellement entre vendre et louer, ou
 * envisage un départ sans rachat. La majorité des dossiers sont des projets
 * déjà arbitrés : leur servir cette page est hors sujet et affaiblit le reste
 * du document.
 *
 * Les deux colonnes ne sont jamais ramenées à un chiffre unique. Un capital et
 * un revenu ne se comparent pas : c'est une différence de nature, pas de degré.
 */
export function PageVendreOuConserver({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { valuation, property, advisor } = avis

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Vendre ou conserver"
      advisor={advisor}
    >
      <div className="space-y-3.5">
        <p className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF]/50 p-3 text-[10pt] leading-snug text-slate-800">
          Vous hésitez entre vendre et conserver le bien en location. Les deux options ne produisent pas la
          même chose : l&apos;une libère un capital, l&apos;autre génère un revenu. Elles sont présentées côte
          à côte, sans être ramenées à un chiffre unique — ce serait comparer deux natures différentes.
        </p>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-2 rounded-xl border-2 border-[#00b4ec] bg-white p-3.5">
            <div className="flex items-center gap-1.5 border-b border-[#CDF7FF] pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#006390]">
              <Wallet className="h-3.5 w-3.5 text-[#00b4ec]" />
              Ce que la vente libère
            </div>

            <div className="avv-figure text-2xl font-black text-[#00b4ec]">
              {formatPrice(valuation.netProceeds)}
            </div>
            <p className="text-[9.5px] text-slate-500">
              Net vendeur, avant remboursement du capital restant dû
            </p>

            <ul className="space-y-1.5 pt-1 text-[10pt] text-slate-700">
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4ec]" />
                <span>Un capital disponible immédiatement, mobilisable comme apport sur un prochain achat.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4ec]" />
                <span>
                  Aucun risque de vacance locative, d&apos;impayé, ni de travaux de copropriété impromptus.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4ec]" />
                <span>
                  Fin des charges courantes : taxe foncière, entretien, assurance propriétaire non occupant.
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-2 rounded-xl border border-[#CDF7FF] bg-[#E9FCFF]/50 p-3.5">
            <div className="flex items-center gap-1.5 border-b border-[#CDF7FF] pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#006390]">
              <KeyRound className="h-3.5 w-3.5 text-[#006390]" />
              Ce que la location produit
            </div>

            <div className="avv-figure text-2xl font-black text-[#006390]">{BLANK}</div>
            <p className="text-[9.5px] text-slate-500">
              Loyer de marché à établir — aucun montant n&apos;est avancé sans étude locative
            </p>

            <ul className="space-y-1.5 pt-1 text-[10pt] text-slate-700">
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006390]" />
                <span>Un revenu récurrent, imposable, dont le rendement net dépend du régime fiscal retenu.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006390]" />
                <span>
                  La conservation du bien{property.livingSurface ? ` de ${formatSurface(property.livingSurface)}` : ''}{' '}
                  et de son évolution de valeur, à la hausse comme à la baisse.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006390]" />
                <span>
                  La perte de l&apos;exonération de plus-value au titre de la résidence principale, dès la mise
                  en location.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[#CDF7FF] bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
            <HelpCircle className="h-3.5 w-3.5 text-[#00b4ec]" />
            Trois questions pour trancher
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Question
              number="1"
              question="Avez-vous besoin du capital ?"
              detail="Si le produit de la vente finance un achat, la question du rendement locatif ne se pose pas : c’est la capacité d’achat qui compte."
            />
            <Question
              number="2"
              question="Êtes-vous prêt à gérer ?"
              detail="Recherche de locataire, état des lieux, impayés, travaux, fiscalité annuelle : la location est une activité, pas un placement passif."
            />
            <Question
              number="3"
              question="Que devient l’exonération ?"
              detail="Si le bien est votre résidence principale aujourd’hui, la vendre l’exonère totalement de plus-value. La louer fait perdre cet avantage."
            />
          </div>

          <p className="border-t border-slate-100 pt-1.5 text-[8.5px] uppercase tracking-wider text-slate-400">
            {NOTARY_DISCLAIMER}
          </p>
        </div>
      </div>
    </A4Page>
  )
}

function Question({ number, question, detail }: { number: string; question: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF]/40 p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#006390] text-[9px] font-black text-white">
          {number}
        </span>
        <span className="text-[9.5pt] font-extrabold leading-tight text-[#006390]">{question}</span>
      </div>
      <p className="text-[9pt] leading-snug text-slate-700">{detail}</p>
    </div>
  )
}

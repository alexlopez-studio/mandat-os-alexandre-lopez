import { Clock, Globe, ShieldCheck, Store, Users } from 'lucide-react'

import { A4Page } from '../a4-page'
import { LISTINGS_SOURCE_LABEL } from '@/lib/avis-de-valeur/advisor'
import { BLANK, formatNumber, formatPrice, formatPricePerM2 } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { CompetitionListing } from '@/lib/avis-de-valeur/types'

/** Un bien invendu de longue date n'est pas un comparable : c'est un signal de marché. */
const STALE_LISTING_DAYS = 180

/** Délai de commercialisation retenu à défaut de donnée saisie, en jours. */
const FALLBACK_MARKETING_DAYS = 90

/** Entre l'offre acceptée et l'acte authentique : purge, financement, notaire. */
const CLOSING_DAYS = 90

/**
 * Stratégie de mise en vente.
 *
 * Fusion du positionnement et du plan d'action : le vendeur n'a pas besoin de
 * deux pages pour comprendre à quel prix on part et ce qui se passe ensuite.
 *
 * Le calendrier est **recalé sur le délai annoncé ailleurs dans le rapport**.
 * Une page qui promet un compromis à J+90 alors qu'une autre donne un délai
 * médian de commercialisation de 103 jours ruine la crédibilité de l'ensemble :
 * le compromis vient après la vente, pas pendant.
 */
export function PageStrategie({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { competition, advisor, property, market } = avis

  const stale = competition
    .filter((listing) => listing.daysOnMarket !== null && listing.daysOnMarket >= STALE_LISTING_DAYS)
    .sort((a, b) => (b.daysOnMarket ?? 0) - (a.daysOnMarket ?? 0))
    .slice(0, 3)

  const active = competition.slice(0, 5)

  const marketingDays = market.salesDelay?.value.median ?? FALLBACK_MARKETING_DAYS
  const isEstimatedDelay = market.salesDelay === null

  const steps = [
    {
      number: '01',
      title: 'Signature du mandat',
      delay: 'Jour J',
      description: 'Validation de la stratégie de prix et lancement des diagnostics obligatoires.',
    },
    {
      number: '02',
      title: 'Reportage photo et rédaction',
      delay: 'J + 2',
      description: 'Prises de vue professionnelles et rédaction de l’annonce avant toute mise en ligne.',
    },
    {
      number: '03',
      title: 'Diffusion et activation du réseau',
      delay: 'J + 4',
      description: 'Publication sur les portails et transmission aux acquéreurs déjà qualifiés du réseau iad.',
    },
    {
      number: '04',
      title: 'Visites qualifiées et offres',
      delay: `J + 15 à J + ${formatNumber(marketingDays)}`,
      description:
        'Sélection des acquéreurs sur capacité de financement vérifiée, compte rendu après chaque visite.',
    },
    {
      number: '05',
      title: 'Compromis puis acte authentique',
      delay: `≈ J + ${formatNumber(marketingDays + CLOSING_DAYS)}`,
      description: 'Le compromis suit l’offre acceptée ; l’acte intervient environ trois mois plus tard.',
    },
  ]

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Stratégie de mise en vente"
      advisor={advisor}
    >
      <div className="space-y-3">
        <div className="space-y-2 rounded-xl border border-[#CDF7FF] bg-white p-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
              <Store className="h-3.5 w-3.5 text-[#00b4ec]" />
              Ce que demande la concurrence aujourd&apos;hui
            </span>
            <span className="text-[9px] font-bold uppercase text-slate-500">Prix affichés, non signés</span>
          </div>

          {active.length > 0 ? (
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="pb-1">Bien en vente</th>
                  <th className="pb-1">Surface</th>
                  <th className="pb-1">Prix demandé</th>
                  <th className="pb-1">€/m²</th>
                  <th className="pb-1">En ligne depuis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {active.map((listing) => (
                  <tr key={listing.id}>
                    <td className="py-1 pr-2 font-semibold text-slate-900">
                      {listing.title ?? 'Annonce sans titre'}
                    </td>
                    <td className="py-1 pr-2">{listing.surface ? `${formatNumber(listing.surface)} m²` : BLANK}</td>
                    <td className="py-1 pr-2 font-bold">{formatPrice(listing.price)}</td>
                    <td className="py-1 pr-2 font-extrabold text-[#008EC3]">
                      {formatPricePerM2(listing.pricePerM2)}
                    </td>
                    <td className="py-1">
                      {listing.daysOnMarket !== null ? `${formatNumber(listing.daysOnMarket)} jours` : BLANK}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10pt] italic text-slate-400">
              Aucune annonce concurrente relevée sur {property.city} au moment de l&apos;édition.
            </p>
          )}

          <p className="text-[8.5px] font-medium uppercase tracking-wider text-slate-400">{LISTINGS_SOURCE_LABEL}</p>
        </div>

        {stale.length > 0 && (
          <div className="space-y-1 rounded-xl border-y border-r border-l-4 border-[#ea584a]/30 border-l-[#ea584a] bg-[#ea584a]/10 p-3">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[#ea584a]">
              <Clock className="h-4 w-4 shrink-0" />
              Les invendus du secteur
            </div>
            <ul className="space-y-0.5 text-[9.5pt] leading-snug text-slate-800">
              {stale.map((listing) => (
                <li key={listing.id} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ea584a]" />
                  <span>{describeStale(listing)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[9.5px] leading-snug text-slate-600">
              Ces biens ne sont pas des comparables, ce sont des signaux. Un prix trop haut au lancement ne se
              rattrape pas : il s&apos;use en vitrine puis se négocie plus bas que l&apos;ajustement initial.
            </p>
          </div>
        )}

        <div className="space-y-1.5 rounded-xl border border-[#CDF7FF] bg-white p-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
              Calendrier de commercialisation
            </span>
            <span className="text-[8.5px] font-semibold uppercase text-slate-500">
              {isEstimatedDelay
                ? 'Repères indicatifs, délai local non renseigné'
                : `Calé sur le délai médian de ${formatNumber(marketingDays)} jours`}
            </span>
          </div>

          {steps.map((step) => (
            <div key={step.number} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-2.5">
                <span className="rounded bg-[#006390] px-2 py-0.5 text-[10px] font-black text-white">
                  {step.number}
                </span>
                <div>
                  <h4 className="text-[10pt] font-extrabold leading-tight text-slate-900">{step.title}</h4>
                  <p className="text-[9pt] font-normal leading-tight text-slate-600">{step.description}</p>
                </div>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded border border-[#CDF7FF] bg-[#E9FCFF] px-2 py-0.5 text-[9.5px] font-bold text-[#006390]">
                {step.delay}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 text-[9.5pt]">
          <div className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF]/50 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 font-extrabold text-[#006390]">
              <Globe className="h-3.5 w-3.5 text-[#00b4ec]" />
              Diffusion
            </div>
            <p className="font-normal leading-snug text-slate-700">
              Publication sur les portails majeurs, le site iad et les réseaux sociaux du secteur, après
              reportage photo professionnel.
            </p>
          </div>
          <div className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF]/50 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 font-extrabold text-[#006390]">
              <Users className="h-3.5 w-3.5 text-[#00b4ec]" />
              Réseau iad
            </div>
            <p className="font-normal leading-snug text-slate-700">
              Les conseillers du secteur présentent le bien à leurs propres acquéreurs, déjà qualifiés et
              souvent déjà financés.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border-l-4 border-[#00b4ec] bg-[#006390] p-3 text-white">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#25CFFF]" />
          <p className="text-[9.5pt] font-semibold text-slate-100">
            Engagement : compte rendu après chaque visite, point d&apos;étape écrit toutes les deux semaines, et
            proposition d&apos;ajustement si aucune offre qualifiée n&apos;est reçue sous trois semaines.
          </p>
        </div>
      </div>
    </A4Page>
  )
}

function describeStale(listing: CompetitionListing) {
  return `${[
    listing.title ?? 'Un bien du secteur',
    listing.price !== null ? `affiché ${formatPrice(listing.price)}` : null,
    listing.daysOnMarket !== null ? `en ligne depuis ${formatNumber(listing.daysOnMarket)} jours` : null,
  ]
    .filter(Boolean)
    .join(', ')}.`
}

import { Thermometer } from 'lucide-react'

import { A4Page } from '../a4-page'
import { BLANK, formatDate, formatNumber } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { Rating } from '@/lib/avis-de-valeur/types'

const GRADES: Rating[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Couleurs réglementaires des étiquettes énergie et climat. */
const DPE_COLORS: Record<Rating, string> = {
  A: '#319834',
  B: '#33cc31',
  C: '#cbfc34',
  D: '#fbfe06',
  E: '#fbcc05',
  F: '#fc9935',
  G: '#fc0205',
}

const GES_COLORS: Record<Rating, string> = {
  A: '#f0eefb',
  B: '#dcd8f2',
  C: '#c5bee8',
  D: '#aca2de',
  E: '#8f80d3',
  F: '#6f5cc8',
  G: '#4d2fbd',
}

/**
 * Performance énergétique.
 *
 * Le classement affiché est celui du diagnostic en vigueur, et rien d'autre :
 * annoncer un « passage en C » après travaux est une promesse invérifiable, la
 * méthode de calcul laissant une marge d'appréciation d'un diagnostiqueur à
 * l'autre.
 */
export function PagePerformanceEnergetique({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { energy, property, advisor } = avis
  const isCondominium = property.propertyType.toLowerCase().includes('appartement')

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Performance énergétique"
      advisor={advisor}
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3.5">
          <ScaleCard
            title="Consommation énergétique (DPE)"
            unit="kWh/m²/an"
            colors={DPE_COLORS}
            current={energy.dpeRating}
            value={energy.dpeValue}
            darkTextUntil="D"
          />
          <ScaleCard
            title="Émissions de gaz à effet de serre"
            unit="kg CO₂/m²/an"
            colors={GES_COLORS}
            current={energy.gesRating}
            value={energy.gesValue}
            darkTextUntil="D"
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-[#CDF7FF] bg-[#E9FCFF]/60 p-3 text-[10pt] leading-snug text-slate-700">
          <Thermometer className="mt-0.5 h-4 w-4 shrink-0 text-[#00b4ec]" />
          <p>
            {energy.note ??
              'Le classement présenté est celui du diagnostic en vigueur' +
                (energy.diagnosticDate ? `, établi le ${formatDate(energy.diagnosticDate)}` : '') +
                '. Des travaux réalisés depuis vont dans le sens d’une amélioration, dont seul un diagnostic actualisé établira l’ampleur. Refaire le DPE avant la mise en vente retire un argument de négociation à l’acquéreur.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Advice
            title="Ce que l’acquéreur en fait"
            text="Le diagnostic est le premier document qu’un acquéreur regarde après le prix. Un classement bas se transforme presque toujours en demande de remise chiffrée."
          />
          <Advice
            title="Ce que dit la loi"
            text={
              isRestricted(energy.dpeRating)
                ? 'Ce classement place le logement sous restriction de mise en location. Cela ne concerne pas une vente, mais réduit le nombre d’acquéreurs investisseurs.'
                : 'Ce classement n’expose le logement à aucune restriction de mise en location, ce qui laisse le bien accessible aux acquéreurs investisseurs.'
            }
          />
          <Advice
            title="Notre conseil"
            text="Faire établir un diagnostic à jour avant la mise en vente. S’il confirme une amélioration, il retire un argument de négociation ; s’il ne la confirme pas, il vaut mieux le savoir avant les visites."
            highlighted
          />
        </div>

        <div className="rounded-lg border border-[#CDF7FF] bg-white p-3">
          <div className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
            Diagnostics à prévoir pour la vente
          </div>
          <p className="text-[9.5pt] leading-snug text-slate-700">
            Au-delà du DPE : amiante, plomb, électricité, gaz, termites, état des risques et,{' '}
            {isCondominium ? 'la copropriété étant concernée, ' : 'le cas échéant, '}
            mesurage de la surface privative. Le dossier complet est constitué avant la première visite : un
            acquéreur qui attend un diagnostic est un acquéreur qui doute.
          </p>
        </div>
      </div>
    </A4Page>
  )
}

/** Les classes F et G ferment progressivement l'accès à la location. */
function isRestricted(rating: Rating | null): boolean {
  return rating === 'F' || rating === 'G'
}

function Advice({ title, text, highlighted = false }: { title: string; text: string; highlighted?: boolean }) {
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

function ScaleCard({
  title,
  unit,
  colors,
  current,
  value,
  darkTextUntil,
}: {
  title: string
  unit: string
  colors: Record<Rating, string>
  current: Rating | null
  value: number | null
  darkTextUntil: Rating
}) {
  const darkIndex = GRADES.indexOf(darkTextUntil)

  return (
    <div className="space-y-2 rounded-xl border border-[#CDF7FF] bg-white p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">{title}</span>
        <span className="text-[9px] font-semibold text-slate-500">
          {value !== null ? `${formatNumber(value)} ${unit}` : BLANK}
        </span>
      </div>

      <div className="space-y-1">
        {GRADES.map((grade, index) => {
          const isCurrent = grade === current
          const width = 40 + index * 8
          return (
            <div key={grade} className="flex items-center gap-2">
              <div
                className="flex h-4 items-center justify-between rounded px-2 text-[9px] font-extrabold"
                style={{
                  width: `${width}%`,
                  backgroundColor: colors[grade],
                  color: index <= darkIndex ? '#1f2937' : '#ffffff',
                }}
              >
                <span>{grade}</span>
              </div>
              {isCurrent && (
                <span className="whitespace-nowrap rounded bg-[#006390] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white">
                  Votre bien
                </span>
              )}
            </div>
          )
        })}
      </div>

      {current === null && (
        <p className="text-[9px] italic text-slate-400">Diagnostic non renseigné à ce jour.</p>
      )}
    </div>
  )
}

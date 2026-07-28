import type { ReactNode } from 'react'
import { IadLogo } from './iad-logo'
import type { AdvisorData } from '@/lib/avis-de-valeur/types'

/**
 * Position d'une page dans le document.
 *
 * Numéro et total sont **toujours** transmis, jamais écrits en dur : le rapport
 * n'a pas un nombre de pages fixe, et une page optionnelle activée décalerait
 * silencieusement toute la numérotation.
 */
export interface PagePosition {
  pageNumber: number
  totalPages: number
}

/**
 * Page A4 du rapport.
 *
 * Deux corrections par rapport à la maquette d'origine, l'une et l'autre
 * invisibles à l'écran et fatales à l'impression :
 *
 *  - le pied de page est positionné en absolu à 12 mm du bas, et non poussé
 *    par `mt-auto`. Sinon sa hauteur dépend du contenu et le filet dérive
 *    d'une page à l'autre ;
 *  - le corps de page ne masque pas son débordement. Un `overflow:hidden`
 *    coupe silencieusement une ligne : la page reste belle et il manque une
 *    phrase. Ici le débordement se voit, et le garde-fou l'attrape.
 */
export function A4Page({
  pageNumber,
  totalPages,
  sectionTitle,
  heroStat,
  isDarkHeader = false,
  isCover = false,
  advisor,
  children,
}: PagePosition & {
  sectionTitle?: string
  heroStat?: { value: string; label: string }
  isDarkHeader?: boolean
  isCover?: boolean
  advisor: AdvisorData
  children: ReactNode
}) {
  const sectionNumber = String(pageNumber).padStart(2, '0')
  return (
    <section className="avv-page relative bg-white text-slate-900" data-page={pageNumber}>
      <div className="avv-frame absolute inset-[12mm] flex flex-col">
        {!isCover && (
          <header className="mb-4 w-full shrink-0" data-avv-header>
            {isDarkHeader ? (
              <div className="flex items-center justify-between rounded-lg border-b-2 border-[#00b4ec] bg-[#006390] p-3.5 text-white">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-[#00b4ec] px-2 py-1 text-xs font-black tracking-wider text-white">
                    {sectionNumber}
                  </span>
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wide text-white">{sectionTitle}</h2>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-200">
                      Avis de valeur • iad immobilier
                    </p>
                  </div>
                </div>

                {heroStat ? (
                  <div className="border-l border-white/20 pl-4 text-right">
                    <span className="avv-figure block text-lg font-black leading-none text-[#25CFFF]">
                      {heroStat.value}
                    </span>
                    <span className="text-[8.5px] font-medium uppercase tracking-widest text-slate-200">
                      {heroStat.label}
                    </span>
                  </div>
                ) : (
                  <IadLogo variant="white" size="sm" />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between border-b border-[#CDF7FF] pb-2">
                <div className="flex items-center gap-2.5">
                  {/* #006390 et non le cyan pur : sur blanc, le cyan plafonne à 2,4:1 de contraste. */}
                  <span className="rounded border border-[#CDF7FF] bg-[#E9FCFF] px-2 py-0.5 text-xs font-black tracking-wider text-[#006390]">
                    {sectionNumber}
                  </span>
                  <h2 className="text-sm font-extrabold uppercase tracking-tight text-[#006390]">
                    {sectionTitle}
                  </h2>
                </div>
                <IadLogo variant="cyan" size="sm" />
              </div>
            )}
          </header>
        )}

        {/* Réserve la bande du pied de page : il est en absolu, il ne pousse plus le contenu. */}
        <div className={`avv-body w-full flex-1 ${isCover ? '' : 'pb-[11mm]'}`} data-avv-body>
          {children}
        </div>
      </div>

      {!isCover && (
        <footer
          className="absolute bottom-[12mm] left-[12mm] right-[12mm] flex items-center justify-between border-t border-[#CDF7FF] pt-2 text-[9.5px] text-slate-600"
          data-avv-footer
        >
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#006390]">{advisor.name}</span>
            <span className="text-slate-300">•</span>
            <span>{advisor.phone}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">{advisor.email}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[8.5px] font-bold uppercase tracking-widest text-slate-400">
              Avis de valeur iad
            </span>
            <span className="rounded border border-[#CDF7FF] bg-[#E9FCFF] px-2 py-0.5 font-extrabold text-[#006390]">
              Page {pageNumber} / {totalPages}
            </span>
          </div>
        </footer>
      )}
    </section>
  )
}

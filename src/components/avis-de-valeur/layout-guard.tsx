'use client'

import { useEffect, useState } from 'react'
import { Ruler } from 'lucide-react'

import { checkPageLayout, type LayoutViolation, type PageMeasurement } from '@/lib/avis-de-valeur/layout-guards'

const PX_PER_MM = 96 / 25.4

/**
 * Contrôle de mise en page, exécuté dans la page elle-même.
 *
 * Les défauts de mise en page A4 sont invisibles à l'écran : ce panneau les
 * rend visibles là où le conseiller travaille, avant l'impression, plutôt que
 * dans un rapport de CI que personne ne lit avant un rendez-vous.
 *
 * Jamais imprimé.
 */
export function LayoutGuard() {
  const [violations, setViolations] = useState<LayoutViolation[]>([])

  useEffect(() => {
    const measure = () => setViolations(checkPageLayout(measurePages()))
    // Une frame d'attente : les polices et le graphique modifient les hauteurs.
    const timer = window.setTimeout(measure, 300)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', measure)
    }
  }, [])

  if (violations.length === 0) return null

  const errors = violations.filter((violation) => violation.severity === 'error')

  return (
    <div className="avv-no-print mx-auto max-w-[210mm] px-4 pb-3">
      <div
        className={`rounded-lg border p-3 ${
          errors.length > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-slate-600/40 bg-slate-800/60'
        }`}
      >
        <div
          className={`mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
            errors.length > 0 ? 'text-red-400' : 'text-slate-300'
          }`}
        >
          <Ruler className="h-3.5 w-3.5" />
          Mise en page ({errors.length > 0 ? `${errors.length} erreur${errors.length > 1 ? 's' : ''}` : 'à surveiller'})
        </div>
        <ul className="space-y-1 text-[11px] leading-snug text-slate-300">
          {violations.map((violation, index) => (
            <li key={`${violation.pageNumber}-${violation.rule}-${index}`} className="flex gap-1.5">
              <span
                className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
                  violation.severity === 'error' ? 'bg-red-400' : 'bg-slate-400'
                }`}
              />
              <span>
                <strong className="font-semibold text-slate-100">Page {violation.pageNumber}</strong> — {violation.rule} :{' '}
                {violation.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function measurePages(): PageMeasurement[] {
  return [...document.querySelectorAll<HTMLElement>('.avv-page')].map((page, index) => {
    const pageRect = page.getBoundingClientRect()
    const body = page.querySelector<HTMLElement>('[data-avv-body]')
    const footer = page.querySelector<HTMLElement>('[data-avv-footer]')
    const isCover = footer === null

    const limit = footer
      ? footer.getBoundingClientRect().top
      : pageRect.bottom - 12 * PX_PER_MM
    const bodyTop = body?.getBoundingClientRect().top ?? pageRect.top

    let contentBottom = bodyTop
    let minInkMargin = Number.POSITIVE_INFINITY

    body?.querySelectorAll<HTMLElement>('*').forEach((element) => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      contentBottom = Math.max(contentBottom, rect.bottom)
      minInkMargin = Math.min(
        minInkMargin,
        rect.left - pageRect.left,
        pageRect.right - rect.right,
        rect.top - pageRect.top,
      )
    })

    const usable = Math.max(1, limit - bodyTop)

    return {
      pageNumber: Number(page.dataset.page ?? index + 1),
      widthMm: pageRect.width / PX_PER_MM,
      heightMm: pageRect.height / PX_PER_MM,
      contentOverflowMm: (contentBottom - limit) / PX_PER_MM,
      fillPercent: ((contentBottom - bodyTop) / usable) * 100,
      footerOffsetMm: footer ? (pageRect.bottom - footer.getBoundingClientRect().bottom) / PX_PER_MM : null,
      minInkMarginMm: Number.isFinite(minInkMargin) ? minInkMargin / PX_PER_MM : 12,
      isCover,
    }
  })
}

'use client'

import Link from 'next/link'
import { ArrowLeft, Printer, TriangleAlert } from 'lucide-react'

/**
 * Barre d'outils écran. Jamais imprimée (`avv-no-print`).
 *
 * Les avertissements de génération sont affichés ici et non dans le rapport :
 * ils s'adressent au conseiller, pas au vendeur.
 */
export function ReportToolbar({
  opportunityId,
  title,
  warnings,
}: {
  opportunityId: string
  title: string
  warnings: string[]
}) {
  return (
    <div className="avv-no-print sticky top-0 z-20 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/admin/market/projects/${opportunityId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au projet
          </Link>

          <h1 className="truncate text-sm font-bold text-white">{title}</h1>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#00b4ec] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#008EC3]"
        >
          <Printer className="h-4 w-4" />
          Imprimer / PDF
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="mx-auto max-w-[210mm] px-4 pb-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <TriangleAlert className="h-3.5 w-3.5" />
              À compléter avant remise ({warnings.length})
            </div>
            <ul className="space-y-1 text-[11px] leading-snug text-amber-200/90">
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

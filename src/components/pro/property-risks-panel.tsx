'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/pro/empty-state'
import { Panel } from '@/components/pro/panel'
import { StatusPill } from '@/components/pro/status-pill'
import type { GeorisquesReport } from '@/lib/market/georisques'

type PropertyRisksPanelProps = {
  projectId: string
}

const PRECISION_META: Record<
  GeorisquesReport['precision'],
  { label: string; tone: 'success' | 'neutral' | 'warning' }
> = {
  adresse: { label: "Précision à l'adresse", tone: 'success' },
  commune: { label: 'Précision à la commune', tone: 'neutral' },
  incertain: { label: 'Adresse approximative', tone: 'warning' },
}

/**
 * Risques de la parcelle, pour preparer l'etat des risques (ERP).
 *
 * Purement informatif : aucune case du contexte de vente n'est cochee d'office.
 * Georisques ne couvre ni les termites ni la merule — ces zones restent a la
 * main du conseiller, sur la foi de l'arrete prefectoral de la commune.
 */
export function PropertyRisksPanel({ projectId }: PropertyRisksPanelProps) {
  const [report, setReport] = useState<GeorisquesReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/projects/${projectId}/risques`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur API')
      setReport(json.report ?? null)
    } catch (err) {
      console.error('[PropertyRisksPanel] load:', err)
      toast.error('Impossible de charger les risques du bien')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const precision = report ? PRECISION_META[report.precision] : null

  return (
    <Panel
      title="Risques du bien"
      description="Données Géorisques (service de l'État). Elles préparent l'état des risques, que le vendeur remplit lui-même."
      actions={
        report?.reportUrl ? (
          <a
            href={report.reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Rapport complet
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Interrogation de Géorisques…
        </div>
      ) : !report ? (
        <EmptyState
          title="Risques indisponibles"
          description="L'adresse du bien n'a pas pu être localisée, ou le service Géorisques est momentanément injoignable."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="brand">{report.commune.label}</StatusPill>
            {precision ? <StatusPill tone={precision.tone}>{precision.label}</StatusPill> : null}
            {report.matchedAddress ? (
              <span className="text-xs text-muted-foreground">{report.matchedAddress}</span>
            ) : null}
          </div>

          {report.risks.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun risque recensé sur cette commune.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {report.risks.map((risk) => (
                <li key={risk.key} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{risk.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {risk.addressStatus ?? risk.communeStatus ?? 'Risque recensé'}
                    </p>
                  </div>
                  <StatusPill tone={risk.family === 'naturel' ? 'neutral' : 'warning'}>
                    {risk.family === 'naturel' ? 'Naturel' : 'Technologique'}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs leading-5 text-muted-foreground">
            Géorisques ne recense ni les termites, ni la mérule, ni le bruit aérien : ces zones
            dépendent d'arrêtés préfectoraux et restent à cocher à la main dans le contexte de
            vente.
          </p>
        </>
      )}
    </Panel>
  )
}

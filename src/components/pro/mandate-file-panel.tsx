'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/pro/empty-state'
import { Panel } from '@/components/pro/panel'
import { RequirementList } from '@/components/pro/requirement-list'
import { StatusPill } from '@/components/pro/status-pill'
import type {
  ReconciledRequirement,
  RequirementSummary,
} from '@/lib/market/document-requirements'

type MandateFilePanelProps = {
  dossierId: string
  /** Change de valeur quand le contexte est reenregistre, pour relancer le chargement. */
  refreshToken?: number
  /** Notifie la fiche que des pieces ont ete creees. */
  onDocumentsChanged?: () => void
}

/**
 * Pieces du dossier de vente, deduites du contexte saisi sur la fiche projet.
 *
 * Panneau frere de `MandateActionsPanel` plutot qu'un onglet de plus dans
 * `DossierWorkspace` : la liste se lit d'un bloc, a cote des actions de
 * preparation, sans se melanger aux visites et aux offres.
 */
export function MandateFilePanel({
  dossierId,
  refreshToken = 0,
  onDocumentsChanged,
}: MandateFilePanelProps) {
  const [rows, setRows] = useState<ReconciledRequirement[]>([])
  const [summary, setSummary] = useState<RequirementSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/document-requirements`)
      const json = await res.json()

      // 409 = contexte non renseigne. Ce n'est pas une erreur mais un etat
      // normal du dossier, qui appelle un message et non un toast rouge.
      if (res.status === 409) {
        setUnavailable(json.error ?? 'Contexte de vente à renseigner')
        setRows([])
        setSummary(null)
        return
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')

      setUnavailable(null)
      setRows(json.data ?? [])
      setSummary(json.summary ?? null)
    } catch (err) {
      console.error('[MandateFilePanel] load:', err)
      toast.error('Impossible de charger les pièces du dossier')
    } finally {
      setLoading(false)
    }
  }, [dossierId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  async function createDocuments(keys?: string[]) {
    const single = keys?.length === 1 ? keys[0] : null
    if (single) setBusyKey(single)
    else setApplying(true)

    try {
      const res = await fetch(`/api/market/clients/${dossierId}/document-requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys ? { keys } : {}),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')

      setRows(json.data ?? [])
      setSummary(json.summary ?? null)
      toast.success(
        json.created > 0
          ? `${json.created} pièce${json.created > 1 ? 's' : ''} ajoutée${json.created > 1 ? 's' : ''} au dossier`
          : 'Toutes les pièces attendues sont déjà au dossier'
      )
      if (json.created > 0) onDocumentsChanged?.()
    } catch (err) {
      console.error('[MandateFilePanel] create:', err)
      toast.error(err instanceof Error ? err.message : 'Ajout impossible')
    } finally {
      setBusyKey(null)
      setApplying(false)
    }
  }

  const expected = rows.filter((row) => row.state !== 'orphan')
  const orphans = rows.filter((row) => row.state === 'orphan')

  return (
    <Panel
      title="Pièces du dossier de vente"
      description="Déduites du contexte de vente. Ajoutées en « manquant » : le vendeur ne les voit qu'une fois demandées."
      actions={
        summary ? (
          <>
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              {summary.present} / {summary.expected}
            </span>
            {summary.blockingMissing > 0 ? (
              <StatusPill tone="danger">{summary.blockingMissing} obligatoire{summary.blockingMissing > 1 ? 's' : ''}</StatusPill>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => createDocuments()}
              disabled={applying || summary.missing === 0}
            >
              {applying ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Appliquer le gabarit
            </Button>
          </>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      ) : unavailable ? (
        <EmptyState
          title="Contexte de vente à renseigner"
          description={unavailable}
        />
      ) : expected.length === 0 ? (
        <EmptyState
          title="Aucune pièce attendue"
          description="Le contexte de vente ne déclenche aucune pièce — vérifie qu'il est bien renseigné."
        />
      ) : (
        <>
          <RequirementList
            rows={expected}
            onAdd={(key) => createDocuments([key])}
            busyKey={busyKey}
          />

          {orphans.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {orphans.length} pièce{orphans.length > 1 ? 's' : ''} plus attendue
                {orphans.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs leading-5 text-amber-800">
                Le contexte de vente a changé depuis leur ajout. Elles restent au dossier — le
                vendeur a peut-être déjà déposé le fichier — et se retirent depuis l'onglet
                Documents.
              </p>
              <ul className="flex flex-col gap-1">
                {orphans.map((row) => (
                  <li key={row.key} className="text-xs text-amber-800">
                    {row.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  )
}

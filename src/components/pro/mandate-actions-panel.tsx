'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Clock, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/pro/status-pill'
import type { SellerAction, SellerActionStatus } from '@/lib/market/seller-actions'
import { cn } from '@/lib/utils'

type MandateActionsPanelProps = {
  dossierId: string
}

const RESPONSIBLE_LABEL: Record<SellerAction['responsible'], string> = {
  seller: 'Vendeur',
  advisor: 'Conseiller',
}

const STATUS_META: Record<SellerActionStatus, { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  todo: { label: 'À faire', tone: 'neutral' },
  blocked: { label: 'En attente', tone: 'warning' },
  done: { label: 'Fait', tone: 'success' },
  info: { label: 'Info', tone: 'neutral' },
}

/**
 * Preparation du mandat : DPE, diagnostics, shooting…
 *
 * Ces actions sont **paralleles** au statut du projet — elles ne suivent pas
 * l'ordre du pipeline et ne le font pas avancer. D'ou une liste cochable et non
 * un stepper : chacune vit a son rythme.
 */
export function MandateActionsPanel({ dossierId }: MandateActionsPanelProps) {
  const [actions, setActions] = useState<SellerAction[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/actions`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
      setActions(json.data ?? [])
    } catch (err) {
      console.error('[MandateActionsPanel] load:', err)
      toast.error('Impossible de charger les actions')
    } finally {
      setLoading(false)
    }
  }, [dossierId])

  useEffect(() => {
    void load()
  }, [load])

  async function applyTemplate() {
    setApplying(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/actions`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
      setActions(json.data ?? [])
      toast.success(
        json.created > 0
          ? `${json.created} action${json.created > 1 ? 's' : ''} ajoutée${json.created > 1 ? 's' : ''}`
          : 'Toutes les actions du gabarit sont déjà présentes'
      )
    } catch (err) {
      console.error('[MandateActionsPanel] applyTemplate:', err)
      toast.error("Impossible d'appliquer le gabarit")
    } finally {
      setApplying(false)
    }
  }

  async function patchAction(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      if (!res.ok) throw new Error('Erreur API')
      await load()
    } catch (err) {
      console.error('[MandateActionsPanel] patch:', err)
      toast.error('Mise à jour impossible')
    } finally {
      setBusyId(null)
    }
  }

  async function removeAction(id: string, title: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/events?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erreur API')
      toast.success(`${title} retirée`)
      await load()
    } catch (err) {
      console.error('[MandateActionsPanel] delete:', err)
      toast.error('Suppression impossible')
    } finally {
      setBusyId(null)
    }
  }

  const done = actions.filter((action) => action.status === 'done').length

  return (
    <section className="rounded-xl border bg-card p-6 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Préparation du mandat</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Actions parallèles au statut du projet : elles avancent chacune à leur rythme et
            n'entrent pas dans la chronologie affichée au vendeur.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {actions.length > 0 && (
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              {done} / {actions.length}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={applyTemplate} disabled={applying}>
            {applying ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            Gabarit standard
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      ) : actions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucune action sur ce dossier. Le gabarit propose le DPE, les diagnostics, le mesurage
          Carrez, le shooting photo et la mise en ligne des visuels.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {actions.map((action) => {
            const meta = STATUS_META[action.status]
            const isBusy = busyId === action.id
            const isDone = action.status === 'done'

            return (
              <li key={action.id} className="flex flex-wrap items-center gap-4 p-4">
                <button
                  type="button"
                  onClick={() => patchAction(action.id, { status: isDone ? 'todo' : 'done' })}
                  disabled={isBusy}
                  aria-pressed={isDone}
                  aria-label={isDone ? `Rouvrir ${action.title}` : `Marquer ${action.title} comme fait`}
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50',
                    isDone
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-transparent hover:border-primary'
                  )}
                >
                  <Check className="size-4" aria-hidden="true" />
                </button>

                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', isDone && 'text-muted-foreground line-through')}>
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {RESPONSIBLE_LABEL[action.responsible]}
                  </p>
                </div>

                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>

                <Input
                  type="date"
                  value={action.due_date ?? ''}
                  onChange={(event) =>
                    patchAction(action.id, { event_date: event.target.value || null })
                  }
                  disabled={isBusy}
                  aria-label={`Échéance de ${action.title}`}
                  className="h-8 w-40 text-xs"
                />

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  disabled={isBusy}
                  aria-label={
                    action.status === 'blocked'
                      ? `Lever l'attente sur ${action.title}`
                      : `Mettre ${action.title} en attente`
                  }
                  title={action.status === 'blocked' ? 'Lever l’attente' : 'Mettre en attente'}
                  onClick={() =>
                    patchAction(action.id, {
                      status: action.status === 'blocked' ? 'todo' : 'blocked',
                    })
                  }
                >
                  <Clock
                    className={cn('size-4', action.status === 'blocked' && 'text-amber-600')}
                  />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={isBusy}
                  aria-label={`Retirer ${action.title}`}
                  onClick={() => removeAction(action.id, action.title)}
                >
                  {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

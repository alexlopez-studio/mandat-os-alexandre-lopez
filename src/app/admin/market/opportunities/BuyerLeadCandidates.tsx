'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Inbox, Loader2, Mail, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, ErrorState, LoadingState, StatusPill } from '@/components/pro'

/**
 * File de validation des acquéreurs détectés dans la boîte mail.
 *
 * Rien n'entre dans le CRM sans un clic : le scanner propose, Alexandre
 * tranche. La carte affiche donc tout ce qui permet de décider sans rouvrir
 * Gmail — extrait du message, motif du rattachement, et le fait que
 * l'extraction ait été faite par le modèle ou par les motifs de secours.
 */

export type BuyerLeadCandidate = {
  id: string
  gmail_message_id: string
  received_at: string | null
  subject: string | null
  from_address: string | null
  portal: string | null
  body_excerpt: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  property_type: string | null
  budget_max: number | null
  communes: string[] | null
  confidence: number | null
  extracted_by: string
  matched_project_id: string | null
  match_reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  created_project_id: string | null
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'À valider' },
  { value: 'approved', label: 'Validés' },
  { value: 'rejected', label: 'Écartés' },
  { value: 'all', label: 'Tous' },
]

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function confidenceTone(confidence: number | null) {
  if (confidence === null) return 'neutral' as const
  if (confidence >= 0.75) return 'success' as const
  if (confidence >= 0.4) return 'warning' as const
  return 'danger' as const
}

function displayName(candidate: BuyerLeadCandidate) {
  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ').trim()
  return name || 'Contact non identifié'
}

export function BuyerLeadCandidates({ onPendingCountChange }: { onPendingCountChange?: (count: number) => void }) {
  const [status, setStatus] = useState('pending')
  const [candidates, setCandidates] = useState<BuyerLeadCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/market/buyer-lead-candidates?status=${status}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chargement impossible')
      setCandidates(data.candidates ?? [])
    } catch (err) {
      console.error('[BuyerLeadCandidates]', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (status === 'pending') onPendingCountChange?.(candidates.length)
  }, [status, candidates.length, onPendingCountChange])

  async function review(candidate: BuyerLeadCandidate, action: 'approve' | 'reject') {
    setBusyId(candidate.id)
    try {
      const res = await fetch('/api/market/buyer-lead-candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: candidate.id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action impossible')

      toast.success(
        action === 'approve'
          ? `Projet d'achat créé pour ${displayName(candidate)}`
          : `Demande écartée`,
      )
      // On recharge plutôt que de retirer la ligne : le statut a changé côté
      // serveur, et le filtre courant décide de ce qui reste affiché.
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action impossible')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Demandes détectées dans votre boîte Gmail. Rien n’est créé tant que vous n’avez pas validé.
        </p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44 rounded-full bg-secondary/50 border-none text-xs font-semibold">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState variant="cards" rows={3} label="Chargement des candidats" />
      ) : error ? (
        <ErrorState
          title="Chargement impossible"
          description="La file des acquéreurs détectés n’a pas pu être lue."
          onRetry={load}
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={status === 'pending' ? 'Aucune demande à valider' : 'Aucun élément'}
          description={
            status === 'pending'
              ? 'Lancez « Scanner les e-mails » pour analyser les demandes reçues depuis vos annonces.'
              : 'Changez de filtre pour voir les autres demandes.'
          }
        />
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <article
              key={candidate.id}
              className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4"
            >
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">{displayName(candidate)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {[candidate.email, candidate.phone].filter(Boolean).join(' · ') || 'Aucun contact extrait'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {candidate.portal ? <StatusPill tone="brand">{candidate.portal}</StatusPill> : null}
                  <StatusPill tone={confidenceTone(candidate.confidence)}>
                    Confiance {Math.round((candidate.confidence ?? 0) * 100)} %
                  </StatusPill>
                  {candidate.extracted_by === 'heuristics' ? (
                    <StatusPill tone="warning">Analyse dégradée</StatusPill>
                  ) : null}
                </div>
              </header>

              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-bold uppercase text-muted-foreground">Type de bien</dt>
                  <dd className="text-sm text-foreground">{candidate.property_type ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted-foreground">Budget max</dt>
                  <dd className="text-sm text-foreground">
                    {candidate.budget_max ? euro.format(candidate.budget_max) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted-foreground">Communes</dt>
                  <dd className="text-sm text-foreground">{candidate.communes?.join(', ') || '—'}</dd>
                </div>
              </dl>

              {candidate.matched_project_id ? (
                <p className="text-sm text-muted-foreground">
                  Rattaché à{' '}
                  <Link
                    href={`/admin/market/opportunities/${candidate.matched_project_id}`}
                    className="font-semibold text-primary underline underline-offset-2"
                  >
                    un de vos mandats
                  </Link>
                  {candidate.match_reason ? ` — ${candidate.match_reason}` : null}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun bien rattaché automatiquement.</p>
              )}

              <details className="rounded-lg border border-border bg-muted/35 p-4">
                <summary className="cursor-pointer text-xs font-bold uppercase text-muted-foreground">
                  E-mail d’origine
                </summary>
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{candidate.subject ?? '(Sans objet)'}</p>
                  <p className="text-sm text-muted-foreground">{candidate.from_address}</p>
                  {candidate.body_excerpt ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{candidate.body_excerpt}</p>
                  ) : null}
                </div>
              </details>

              {candidate.status === 'pending' ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => review(candidate, 'reject')}
                    disabled={busyId === candidate.id}
                    className="rounded-full font-semibold text-destructive hover:text-destructive"
                  >
                    <X className="mr-2 size-4" />
                    Écarter
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => review(candidate, 'approve')}
                    disabled={busyId === candidate.id}
                    className="rounded-full font-semibold"
                  >
                    {busyId === candidate.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Créer le projet d’achat
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-4">
                  {candidate.review_note ? (
                    <p className="mr-auto text-sm text-muted-foreground">{candidate.review_note}</p>
                  ) : null}
                  {candidate.created_project_id ? (
                    <Button asChild variant="outline" size="sm" className="rounded-full font-semibold">
                      <Link href={`/admin/market/opportunities/${candidate.created_project_id}`}>
                        <Mail className="mr-2 size-4" />
                        Voir le projet créé
                      </Link>
                    </Button>
                  ) : (
                    <StatusPill tone="neutral">
                      {candidate.status === 'approved' ? 'Validé' : 'Écarté'}
                    </StatusPill>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

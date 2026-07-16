'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Aperçu + publication de la couche de personnalisation espace client
 * (issue du R1 / Granola). Le conseiller relit ce qui a été trié côté
 * « client-facing » et bascule le statut draft → published pour l'exposer
 * dans l'espace client. L'intel interne n'apparaît jamais ici (elle vit sur
 * l'opportunité, hors de ce composant).
 */

type Personalization = {
  status?: string
  client_project?: string | null
  property_story?: string | null
  key_points?: string[]
  advisor_commitments?: string[]
  personal_note?: string | null
  [key: string]: unknown
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function PersonalizationCard({ dossierId }: { dossierId: string }) {
  const [perso, setPerso] = useState<Personalization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}`)
      const json = await res.json()
      const value = json?.data?.dossier?.personalization
      setPerso(value && typeof value === 'object' && !Array.isArray(value) ? (value as Personalization) : {})
    } catch {
      setPerso({})
    } finally {
      setLoading(false)
    }
  }, [dossierId])

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = async (status: 'draft' | 'published') => {
    if (!perso) return
    setSaving(true)
    try {
      const next: Personalization = { ...perso, status }
      const res = await fetch(`/api/market/clients/${dossierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossier: { personalization: next } }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Enregistrement impossible')
      const value = json?.data?.dossier?.personalization
      setPerso(value && typeof value === 'object' && !Array.isArray(value) ? (value as Personalization) : next)
      toast.success(status === 'published' ? 'Personnalisation publiée dans l’espace client' : 'Repassée en brouillon')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de l’enregistrement')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-white p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement de la personnalisation…
      </div>
    )
  }

  const p = perso ?? {}
  const clientProject = typeof p.client_project === 'string' ? p.client_project : null
  const propertyStory = typeof p.property_story === 'string' ? p.property_story : null
  const keyPoints = asStringArray(p.key_points)
  const commitments = asStringArray(p.advisor_commitments)
  const personalNote = typeof p.personal_note === 'string' ? p.personal_note : null
  const isEmpty = !clientProject && !propertyStory && keyPoints.length === 0 && commitments.length === 0 && !personalNote
  const published = p.status === 'published'

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Personnalisation espace client</h3>
            <p className="text-xs text-muted-foreground">Issue du R1 — visible par le client uniquement si publiée.</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            published
              ? 'rounded-full border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'rounded-full border-slate-200 bg-slate-50 text-slate-600'
          }
        >
          {published ? 'Publiée' : 'Brouillon'}
        </Badge>
      </header>

      {isEmpty ? (
        <p className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Aucune personnalisation enregistrée pour ce dossier. Elle est générée à partir du compte-rendu du rendez-vous (R1).
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {clientProject && <PreviewBlock label="Votre projet" text={clientProject} />}
          {propertyStory && <PreviewBlock label="Histoire du bien" text={propertyStory} />}
          {keyPoints.length > 0 && <PreviewList label="Points retenus" items={keyPoints} />}
          {commitments.length > 0 && <PreviewList label="Engagements du conseiller" items={commitments} />}
          {personalNote && <PreviewBlock label="Mot du conseiller" text={personalNote} />}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {published ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl px-4"
            disabled={saving}
            onClick={() => setStatus('draft')}
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <EyeOff className="mr-2 size-4" />}
            Repasser en brouillon
          </Button>
        ) : (
          <Button
            type="button"
            className="h-9 rounded-xl px-4"
            disabled={saving || isEmpty}
            onClick={() => setStatus('published')}
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Eye className="mr-2 size-4" />}
            Publier dans l’espace client
          </Button>
        )}
      </footer>
    </section>
  )
}

function PreviewBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{text}</p>
    </div>
  )
}

function PreviewList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-foreground">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

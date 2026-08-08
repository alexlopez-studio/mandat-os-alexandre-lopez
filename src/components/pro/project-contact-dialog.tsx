'use client'

import * as React from 'react'
import { Loader2, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActionBar } from './action-bar'
import { EmptyState } from './empty-state'
import { SearchInput } from './search-input'
import { cn } from '@/lib/utils'

type DirectoryContact = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

const ROLES_BY_KIND = {
  vente: ['Vendeur unique', 'Co-vendeur', 'Indivisaire', 'Mandataire'],
  achat: ['Acquéreur', 'Co-acquéreur', 'Mandataire'],
} as const

type ProjectContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  kind: 'vente' | 'achat'
  /** Contacts deja rattaches, exclus des resultats. */
  excludeIds?: string[]
  onAttached: () => void
}

/**
 * Rattache un contact de l'annuaire a un projet.
 */
function ProjectContactDialog({
  open,
  onOpenChange,
  projectId,
  kind,
  excludeIds = [],
  onAttached,
}: ProjectContactDialogProps) {
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<DirectoryContact[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [role, setRole] = React.useState<string>(ROLES_BY_KIND[kind][1])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedId(null)
      setRole(ROLES_BY_KIND[kind][1])
    }
  }, [open, kind])

  React.useEffect(() => {
    if (!open) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/market/contacts/search?q=${encodeURIComponent(search)}&limit=20`
        )
        if (!res.ok) throw new Error('search failed')
        const json = await res.json()
        if (active) setResults(json.contacts ?? [])
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [search, open])

  const visible = results.filter((contact) => !excludeIds.includes(contact.id))

  const attach = async () => {
    if (!selectedId) return
    try {
      setSaving(true)
      const res = await fetch(`/api/market/projects/${projectId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: selectedId, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      toast.success('Contact rattaché au projet')
      onOpenChange(false)
      onAttached()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de rattacher ce contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 border bg-card">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-foreground">Rattacher un contact</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sélectionnez un contact de l’annuaire à associer à ce projet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <SearchInput
            label="Rechercher un contact"
            placeholder="Nom, email, téléphone…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl"
          />

          <div className="max-h-60 overflow-y-auto rounded-xl border border-border bg-background p-1">
            {loading && visible.length === 0 ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={UserRound}
                title="Aucun contact trouvé"
                description="Affinez la recherche ou créez le contact depuis l'annuaire."
                className="min-h-0 rounded-none border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="divide-y divide-border/50">
                {visible.map((contact) => {
                  const name =
                    [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
                    'Contact sans nom'
                  const selected = selectedId === contact.id
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedId(contact.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-4 px-3.5 py-2.5 rounded-lg text-left text-sm transition-colors cursor-pointer',
                          selected ? 'bg-primary/10 font-bold text-primary' : 'hover:bg-muted/60'
                        )}
                      >
                        <span className="min-w-0 truncate font-medium">{name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground font-normal">
                          {contact.phone || contact.email || '—'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-contact-role" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rôle sur le projet
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="project-contact-role" className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES_BY_KIND[kind].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ActionBar className="pt-3 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Annuler
          </Button>
          <Button onClick={attach} disabled={!selectedId || saving} className="bg-primary hover:bg-primary/90 text-white rounded-full px-5">
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Rattacher le contact
          </Button>
        </ActionBar>
      </DialogContent>
    </Dialog>
  )
}

export { ProjectContactDialog }

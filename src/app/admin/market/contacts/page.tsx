'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Inbox, Layers, Loader2, Mail, Phone, Plus, RotateCcw, Trash2, UserRound, Archive, Star, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  BulkActionBar,
  ConfirmDialog,
  ContactTypePills,
  DataToolbar,
  EmptyState,
  LoadingState,
  PageHeader,
  PageLayout,
  PageSection,
  SearchInput,
  StatusPill,
  ToggleChip,
  ViewModeToggle,
  type ViewMode,
} from '@/components/pro'
import {
  CONTACT_TYPES,
  CONTACT_TYPE_META,
  CONTACT_STATUS_META,
  getContactStatus,
  normalizeContactTypes,
  type ContactType,
  type ContactStatus,
} from '@/lib/contact-types'
import { ContactDetailDrawer } from '@/components/admin/ContactDetailDrawer'
import { cn } from '@/lib/utils'

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  relation: string | null
  source: string | null
  types: string[] | null
  all_types: string[] | null
  projects_count: number | null
  status: string | null
  created_at?: string | null
  updated_at?: string | null
}

const ALL_TYPES_VALUE = 'all'

type StatusTab = 'qualified' | 'prospects' | 'all' | 'archived'

const STATUS_TABS: { value: StatusTab; label: string; icon: LucideIcon }[] = [
  { value: 'qualified', label: 'Qualifiés & clients', icon: Star },
  { value: 'prospects', label: 'Nouveaux prospects', icon: Inbox },
  { value: 'all', label: 'Tous', icon: Layers },
  { value: 'archived', label: 'Archivés', icon: Archive },
]

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  company: '',
  relation: '',
}

export default function ContactsListPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ContactType | typeof ALL_TYPES_VALUE>(ALL_TYPES_VALUE)
  const [statusTab, setStatusTab] = useState<StatusTab>('qualified')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [selectedDrawerContact, setSelectedDrawerContact] = useState<Contact | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formTypes, setFormTypes] = useState<ContactType[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkRunning, setBulkRunning] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  // Contacts rattaches a des projets : l'API les refuse sans `force`, on les
  // represente dans une seconde confirmation plutot que de forcer d'emblee.
  const [linkedBlockers, setLinkedBlockers] = useState<{ id: string; projects: number }[]>([])

  const loadContacts = useCallback(async (query: string, type: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ q: query, limit: '200' })
      if (type !== ALL_TYPES_VALUE) params.set('type', type)
      const res = await fetch(`/api/market/contacts/search?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch contacts')
      const json = await res.json()
      setContacts(json.contacts || [])
    } catch (err) {
      console.error(err)
      toast.error('Impossible de charger les contacts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadContacts(search, typeFilter)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, typeFilter, loadContacts])

  const handleUpdateStatus = async (contactId: string, newStatus: ContactStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setUpdatingId(contactId)
    try {
      const res = await fetch(`/api/market/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Mise à jour statut impossible')
      toast.success(newStatus === 'qualified' ? 'Contact qualifié !' : newStatus === 'archived' ? 'Contact archivé' : 'Statut mis à jour')
      await loadContacts(search, typeFilter)
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleFormType = (type: ContactType) => {
    setFormTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.first_name && !formData.last_name && !formData.email && !formData.phone) {
      toast.error('Renseignez au moins un nom, un email ou un téléphone')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch('/api/market/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, types: formTypes, status: 'qualified' }),
      })

      if (!res.ok) throw new Error('Erreur lors de la création')

      const { contact } = await res.json()
      toast.success('Contact créé')
      setIsDialogOpen(false)
      setFormData({ ...EMPTY_FORM })
      setFormTypes([])

      router.push(`/admin/market/contacts/${contact.id}`)
    } catch {
      toast.error('Erreur lors de la création du contact')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const status = getContactStatus(contact)
      if (statusTab === 'qualified') return status === 'qualified' || status === 'client'
      if (statusTab === 'prospects') return status === 'prospect'
      if (statusTab === 'archived') return status === 'archived'
      return status !== 'archived' // 'all' view shows everything except archived
    })
  }, [contacts, statusTab])

  const counts = useMemo(() => {
    return {
      qualified: contacts.filter(c => ['qualified', 'client'].includes(getContactStatus(c))).length,
      prospects: contacts.filter(c => getContactStatus(c) === 'prospect').length,
      all: contacts.filter(c => getContactStatus(c) !== 'archived').length,
      archived: contacts.filter(c => getContactStatus(c) === 'archived').length,
    }
  }, [contacts])

  // Une ligne cochée puis sortie du filtre courant ne doit pas rester dans la
  // sélection : sinon l'action groupée toucherait des contacts invisibles.
  const visibleIds = useMemo(() => filteredContacts.map((c) => c.id), [filteredContacts])
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((id) => selectedIds.includes(id)),
    [visibleIds, selectedIds]
  )
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length

  const clearSelection = useCallback(() => setSelectedIds([]), [])

  // Changer d'onglet ou de filtre remet la selection a zero : garder des cases
  // cochees invisibles rendrait l'action groupee imprevisible.
  useEffect(() => {
    clearSelection()
  }, [statusTab, search, typeFilter, clearSelection])

  const toggleSelected = (contactId: string) => {
    setSelectedIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    )
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleIds)
  }

  const applyBulkStatus = async (newStatus: ContactStatus) => {
    if (selectedVisibleIds.length === 0) return
    setBulkRunning(true)
    try {
      const results = await Promise.all(
        selectedVisibleIds.map((id) =>
          fetch(`/api/market/contacts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
            .then((res) => res.ok)
            .catch(() => false)
        )
      )
      const failed = results.filter((ok) => !ok).length
      const done = results.length - failed
      const label = CONTACT_STATUS_META[newStatus].label.toLowerCase()
      if (done > 0) toast.success(`${done} contact${done > 1 ? 's' : ''} passé${done > 1 ? 's' : ''} en ${label}`)
      if (failed > 0) toast.error(`${failed} contact${failed > 1 ? 's' : ''} n’${failed > 1 ? 'ont' : 'a'} pas pu être mis à jour`)
      clearSelection()
      await loadContacts(search, typeFilter)
    } finally {
      setBulkRunning(false)
    }
  }

  /**
   * Supprime les contacts coches. Sans `force`, l'API refuse (409) ceux qui sont
   * rattaches a des projets : ils sont remontes pour une seconde confirmation.
   */
  const deleteContacts = async (ids: string[], force: boolean) => {
    setBulkRunning(true)
    try {
      const outcomes = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(
              `/api/market/contacts/${id}${force ? '?force=true' : ''}`,
              { method: 'DELETE' }
            )
            if (res.ok) return { id, state: 'deleted' as const }
            if (res.status === 409) {
              const body = await res.json().catch(() => ({}))
              return { id, state: 'linked' as const, projects: body.project_count ?? 0 }
            }
            return { id, state: 'failed' as const }
          } catch {
            return { id, state: 'failed' as const }
          }
        })
      )

      const deleted = outcomes.filter((o) => o.state === 'deleted').length
      const linked = outcomes.filter((o) => o.state === 'linked')
      const failed = outcomes.filter((o) => o.state === 'failed').length

      if (deleted > 0) toast.success(`${deleted} contact${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''}`)
      if (failed > 0) toast.error(`${failed} contact${failed > 1 ? 's' : ''} n’${failed > 1 ? 'ont' : 'a'} pas pu être supprimé${failed > 1 ? 's' : ''}`)

      setDeleteDialogOpen(false)
      setLinkedBlockers(
        linked.map((o) => ({ id: o.id, projects: 'projects' in o ? o.projects : 0 }))
      )
      setSelectedIds(linked.map((o) => o.id))
      await loadContacts(search, typeFilter)
    } finally {
      setBulkRunning(false)
    }
  }

  const linkedProjectsTotal = linkedBlockers.reduce((sum, blocker) => sum + blocker.projects, 0)

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Annuaire"
        title="Contacts"
        description="Vendeurs, acquéreurs, partenaires pro et réseau réunis dans une seule base."
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full font-semibold shadow-xs">
                <Plus className="mr-2 size-4" />
                Nouveau contact
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl p-6 border bg-card">
              <form onSubmit={handleCreateContact}>
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-xl font-bold text-foreground">Nouveau contact</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Un contact peut cumuler plusieurs types.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="first_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prénom</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="company" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Société</Label>
                      <Input
                        id="company"
                        placeholder="Étude, cabinet, enseigne…"
                        value={formData.company}
                        onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="relation" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Relation / métier</Label>
                      <Input
                        id="relation"
                        placeholder="Notaire, courtier, ami…"
                        value={formData.relation}
                        onChange={(e) => setFormData((p) => ({ ...p, relation: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
                    <div className="flex flex-wrap gap-2">
                      {CONTACT_TYPES.map((type) => {
                        const meta = CONTACT_TYPE_META[type]
                        return (
                          <ToggleChip
                            key={type}
                            icon={meta.icon}
                            selected={formTypes.includes(type)}
                            onClick={() => toggleFormType(type)}
                          >
                            {meta.label}
                          </ToggleChip>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-3 border-t flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)} className="rounded-full">
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-white rounded-full px-5">
                    {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Créer le contact
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <PageSection>
        <Tabs
          value={statusTab}
          onValueChange={(value) => setStatusTab(value as StatusTab)}
          className="space-y-6"
        >
          <TabsList variant="pill" className="w-full justify-start lg:w-auto inline-flex">
            {STATUS_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="text-sm font-bold px-5">
                <Icon className="mr-2 h-4 w-4" /> {label}
                <StatusPill tone={statusTab === value ? 'brand' : 'neutral'} className="ml-2">
                  {counts[value]}
                </StatusPill>
              </TabsTrigger>
            ))}
          </TabsList>

          <DataToolbar
            variant="pill"
            filters={
              <>
                <div className="mr-auto w-full sm:w-auto">
                  <SearchInput
                    label="Rechercher un contact"
                    placeholder="Rechercher un nom, email, téléphone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-full bg-secondary/50 border-none h-9 w-full"
                  />
                </div>

                <Select
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(value as ContactType | typeof ALL_TYPES_VALUE)}
                >
                  <SelectTrigger className="h-9 w-48 rounded-full bg-secondary/50 border-none text-xs font-semibold" aria-label="Filtrer par type">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TYPES_VALUE} className="text-xs font-medium">Tous les types</SelectItem>
                    {CONTACT_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="text-xs font-medium">
                        {CONTACT_TYPE_META[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ViewModeToggle
                  value={viewMode}
                  onChange={(mode) => {
                    setViewMode(mode)
                    if (mode === 'cards') clearSelection()
                  }}
                />
              </>
            }
          />

          {viewMode === 'table' ? (
            <BulkActionBar
              count={selectedVisibleIds.length}
              noun="contact"
              busy={bulkRunning}
              onClear={clearSelection}
            >
              {statusTab === 'archived' || statusTab === 'all' ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkRunning}
                  onClick={() => applyBulkStatus('qualified')}
                  className="h-8 rounded-full text-xs font-semibold"
                >
                  <RotateCcw className="mr-2 size-3.5" aria-hidden="true" />
                  Restaurer
                </Button>
              ) : null}
              {statusTab !== 'archived' ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkRunning}
                  onClick={() => applyBulkStatus('archived')}
                  className="h-8 rounded-full text-xs font-semibold"
                >
                  <Archive className="mr-2 size-3.5" aria-hidden="true" />
                  Archiver
                </Button>
              ) : null}
              {statusTab === 'prospects' ? (
                <Button
                  size="sm"
                  disabled={bulkRunning}
                  onClick={() => applyBulkStatus('qualified')}
                  className="h-8 rounded-full text-xs font-semibold"
                >
                  <Star className="mr-2 size-3.5" aria-hidden="true" />
                  Qualifier
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={bulkRunning}
                onClick={() => setDeleteDialogOpen(true)}
                className="h-8 rounded-full text-xs font-semibold text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 size-3.5" aria-hidden="true" />
                Supprimer
              </Button>
            </BulkActionBar>
          ) : null}

          {loading && contacts.length === 0 ? (
            <LoadingState variant="table" rows={6} label="Chargement des contacts" />
          ) : filteredContacts.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="Aucun contact trouvé"
              description={
                search || typeFilter !== ALL_TYPES_VALUE
                  ? 'Modifiez la recherche ou le filtre de type.'
                  : 'Aucun contact correspondant dans cet onglet.'
              }
              action={
                search || typeFilter !== ALL_TYPES_VALUE ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('')
                      setTypeFilter(ALL_TYPES_VALUE)
                    }}
                    className="rounded-full"
                  >
                    Réinitialiser les filtres
                  </Button>
                ) : (
                  <Button onClick={() => setIsDialogOpen(true)} className="rounded-full">
                    <Plus className="mr-2 size-4" />
                    Nouveau contact
                  </Button>
                )
              }
            />
          ) : viewMode === 'cards' ? (
            /* Cards Grid View */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredContacts.map((contact, idx) => {
                const displayName =
                  [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
                  'Contact sans nom'
                const initials =
                  [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join('').toUpperCase() ||
                  'C'
                const types = normalizeContactTypes(contact.all_types)
                const status = getContactStatus(contact)
                const statusMeta = CONTACT_STATUS_META[status]
                const colors = [
                  'bg-sky-600 text-sky-50',
                  'bg-slate-700 text-slate-50',
                  'bg-amber-700 text-amber-50',
                  'bg-emerald-700 text-emerald-50',
                ]
                const avatarColor = colors[idx % colors.length]

                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedDrawerContact(contact)}
                    className="rounded-2xl border bg-card p-5 shadow-xs hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Header Row: Avatar + Name + Typology & Status */}
                      <div className="flex items-start gap-3">
                        <div className={cn("size-10 shrink-0 flex items-center justify-center rounded-full text-xs font-bold shadow-xs", avatarColor)}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="text-base font-bold text-foreground line-clamp-1 hover:text-primary transition-colors">
                              {displayName}
                            </h3>
                            <Badge variant="outline" className={cn("text-[10px] uppercase font-bold shrink-0", statusMeta.className)}>
                              {statusMeta.label}
                            </Badge>
                          </div>
                          {contact.company || contact.relation ? (
                            <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                              {[contact.company, contact.relation].filter(Boolean).join(' • ')}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Typology Pills */}
                      {types.length > 0 && (
                        <div className="pt-1">
                          <ContactTypePills types={types} />
                        </div>
                      )}

                      {/* Contact Info Box */}
                      <div className="rounded-xl bg-muted/40 p-3 border border-border/50 text-xs space-y-1.5">
                        {contact.phone && (
                          <a 
                            href={`tel:${contact.phone}`} 
                            onClick={(e) => e.stopPropagation()} 
                            className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                          >
                            <Phone className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{contact.phone}</span>
                          </a>
                        )}
                        {contact.email && (
                          <a 
                            href={`mailto:${contact.email}`} 
                            onClick={(e) => e.stopPropagation()} 
                            className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                          >
                            <Mail className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        )}
                        {!contact.phone && !contact.email && (
                          <span className="text-muted-foreground italic">Aucune coordonnée</span>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Quick Actions */}
                    <div className="pt-3 border-t flex items-center justify-between gap-2">
                      {status === 'prospect' ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === contact.id}
                            onClick={(e) => handleUpdateStatus(contact.id, 'qualified', e)}
                            className="h-7 text-xs font-semibold rounded-full border-primary/30 text-primary hover:bg-primary/5 flex-1"
                          >
                            <Star className="mr-1 size-3 text-amber-500 fill-amber-500" /> Qualifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updatingId === contact.id}
                            onClick={(e) => handleUpdateStatus(contact.id, 'archived', e)}
                            className="h-7 text-xs font-semibold rounded-full text-muted-foreground hover:text-destructive"
                          >
                            <Archive className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground font-medium">
                            {contact.projects_count ? `${contact.projects_count} projet${contact.projects_count > 1 ? 's' : ''}` : 'Aucun projet'}
                          </span>
                          <Button variant="ghost" size="sm" className="text-xs font-semibold text-primary hover:text-primary/80 p-0 h-auto">
                            Ouvrir <ChevronRight className="ml-0.5 size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CONTACT</TableHead>
                    <TableHead className="hidden md:table-cell text-xs font-bold uppercase tracking-wider text-muted-foreground">STATUT</TableHead>
                    <TableHead className="hidden md:table-cell text-xs font-bold uppercase tracking-wider text-muted-foreground">TYPE</TableHead>
                    <TableHead className="hidden lg:table-cell text-xs font-bold uppercase tracking-wider text-muted-foreground">COORDONNÉES</TableHead>
                    <TableHead className="hidden xl:table-cell text-xs font-bold uppercase tracking-wider text-muted-foreground">SOCIÉTÉ / RELATION</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact, idx) => {
                    const displayName =
                      [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
                      'Contact sans nom'
                    const initials =
                      [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join('').toUpperCase() ||
                      'C'
                    const types = normalizeContactTypes(contact.all_types)
                    const status = getContactStatus(contact)
                    const statusMeta = CONTACT_STATUS_META[status]
                    const colors = [
                      'bg-sky-600 text-sky-50',
                      'bg-slate-700 text-slate-50',
                      'bg-amber-700 text-amber-50',
                      'bg-emerald-700 text-emerald-50',
                    ]
                    const avatarColor = colors[idx % colors.length]

                    return (
                      <TableRow
                        key={contact.id}
                        data-state={selectedIds.includes(contact.id) ? 'selected' : undefined}
                        onClick={() => setSelectedDrawerContact(contact)}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(contact.id)}
                            onCheckedChange={() => toggleSelected(contact.id)}
                            aria-label={`Sélectionner ${displayName}`}
                          />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("size-9 shrink-0 flex items-center justify-center rounded-full text-xs font-bold shadow-xs", avatarColor)}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/admin/market/contacts/${contact.id}`}
                                className="block truncate font-bold text-foreground hover:text-primary transition-colors text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {displayName}
                              </Link>
                              <div className="mt-1 flex items-center gap-2 md:hidden">
                                <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", statusMeta.className)}>
                                  {statusMeta.label}
                                </Badge>
                                <ContactTypePills types={types} withIcon={false} />
                              </div>
                              <p className="truncate text-xs text-muted-foreground lg:hidden mt-0.5">
                                {contact.phone || contact.email || '—'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-4">
                          <Badge variant="outline" className={cn("text-xs font-bold uppercase", statusMeta.className)}>
                            {statusMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-4">
                          <ContactTypePills types={types} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell py-4">
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                            {contact.phone ? (
                              <span className="flex items-center gap-2">
                                <Phone className="size-3 text-muted-foreground" aria-hidden="true" />
                                {contact.phone}
                              </span>
                            ) : null}
                            {contact.email ? (
                              <span className="flex items-center gap-2 truncate">
                                <Mail className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="truncate">{contact.email}</span>
                              </span>
                            ) : null}
                            {!contact.phone && !contact.email ? <span>—</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell py-4">
                          <div className="text-xs">
                            <p className="font-bold text-foreground">{contact.company || '—'}</p>
                            {contact.relation ? (
                              <p className="text-muted-foreground font-medium">{contact.relation}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-right">
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <ConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title={`Supprimer ${selectedVisibleIds.length} contact${selectedVisibleIds.length > 1 ? 's' : ''} ?`}
            description="Cette action est définitive : coordonnées, typologies et journal d’activité sont perdus. Les contacts rattachés à un projet seront signalés avant d’être supprimés. Pour sortir un contact de l’annuaire actif sans rien perdre, utilisez plutôt Archiver."
            confirmLabel="Supprimer définitivement"
            destructive
            busy={bulkRunning}
            onConfirm={() => deleteContacts(selectedVisibleIds, false)}
          />

          <ConfirmDialog
            open={linkedBlockers.length > 0}
            onOpenChange={(open) => {
              if (!open) setLinkedBlockers([])
            }}
            title={`${linkedBlockers.length} contact${linkedBlockers.length > 1 ? 's' : ''} rattaché${linkedBlockers.length > 1 ? 's' : ''} à des projets`}
            description={`Ces contacts apparaissent dans ${linkedProjectsTotal} projet${linkedProjectsTotal > 1 ? 's' : ''} et n’ont pas été supprimés. Confirmer les retirera aussi de ces projets ; les projets eux-mêmes sont conservés.`}
            confirmLabel="Supprimer quand même"
            cancelLabel="Les conserver"
            destructive
            busy={bulkRunning}
            onConfirm={() => {
              const ids = linkedBlockers.map((blocker) => blocker.id)
              setLinkedBlockers([])
              deleteContacts(ids, true)
            }}
          />

          <ContactDetailDrawer
            open={Boolean(selectedDrawerContact)}
            onOpenChange={(open) => !open && setSelectedDrawerContact(null)}
            contact={selectedDrawerContact}
            onContactUpdated={(updated) => {
              setContacts((prev) =>
                prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
              )
              setSelectedDrawerContact(updated as any)
            }}
          />
        </Tabs>
      </PageSection>
    </PageLayout>
  )
}

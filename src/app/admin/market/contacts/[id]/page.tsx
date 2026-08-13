'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit,
  ExternalLink,
  History,
  Home,

  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Send,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactTypePills, ToggleChip } from '@/components/pro'
import {
  CONTACT_TYPES,
  CONTACT_TYPE_META,
  normalizeContactTypes,
  type ContactType,
} from '@/lib/contact-types'
import { cn } from '@/lib/utils'
import type { ActivityType } from '@/types/supabase'

interface Activity {
  id: string
  contact_id: string | null
  opportunity_id: string | null
  lead_id: string | null
  type: ActivityType
  title: string | null
  content: string | null
  occurred_at: string
  due_at?: string | null
  completed_at?: string | null
  created_by?: string | null
  created_at?: string
}

interface OpportunitySummary {
  id: string
  title: string
  stage: string | null
  property_city: string | null
  estimated_price_min: number | null
  created_at: string
}

interface BuyerCriteriaSummary {
  id: string
  lead_id: string
  type_bien: string | null
  budget_max: number | null
  communes: string[] | null
  active: boolean | null
  stage: string | null
  created_at: string
}

interface ContactDetailData {
  contact: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    company: string | null
    relation: string | null
    source: string
    types: string[]
    created_at: string
    updated_at: string
  }
  opportunities: OpportunitySummary[]
  buyerCriteria: BuyerCriteriaSummary[]
  activities: Activity[]
}

const EVENT_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
  note: { label: 'Note', icon: StickyNote, className: 'bg-primary/10 text-primary border-primary/20' },
  task: { label: 'Tâche', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  call: { label: 'Appel', icon: Phone, className: 'bg-sky-500/10 text-sky-700 border-sky-500/20' },
  meeting: { label: 'RDV', icon: Calendar, className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  email: { label: 'E-mail', icon: Mail, className: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  system: { label: 'Système', icon: Clock, className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function authorLabel(createdBy?: string | null): string | null {
  if (!createdBy) return null
  if (createdBy === 'admin' || createdBy === 'user') return 'Admin'
  if (createdBy === 'system') return 'Système'
  return createdBy
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<ContactDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    relation: '',
  })
  const [editTypes, setEditTypes] = useState<ContactType[]>([])

  // Activity Log Filter & Dialog State (Identique aux Fiches Projets)
  const [activityFilter, setActivityFilter] = useState<'all' | 'note' | 'task' | 'call' | 'meeting'>('all')
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [eventDraft, setEventDraft] = useState<{
    id?: string
    type: ActivityType
    title: string
    content: string
    due_at?: string
  }>({
    type: 'note',
    title: '',
    content: '',
    due_at: '',
  })
  const [submittingEvent, setSubmittingEvent] = useState(false)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/market/contacts/${params.id}`)
      if (!res.ok) {
        if (res.status === 404) setData(null)
        else throw new Error('Failed to load contact')
        return
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Erreur chargement contact:', err)
      toast.error('Erreur lors du chargement des données du contact')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const openEdit = () => {
    if (!data?.contact) return
    const c = data.contact
    setEditForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      relation: c.relation || '',
    })
    setEditTypes(normalizeContactTypes(c.types))
    setEditOpen(true)
  }

  const toggleType = (type: ContactType) => {
    setEditTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const res = await fetch(`/api/market/contacts/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, types: editTypes }),
      })
      if (!res.ok) throw new Error('Update failed')
      toast.success('Contact mis à jour')
      setEditOpen(false)
      await loadData()
    } catch {
      toast.error('Erreur lors de la mise à jour du contact')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      const res = await fetch(`/api/market/contacts/${params.id}?force=true`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Suppression impossible')
      toast.success('Contact supprimé')
      router.push('/admin/market/contacts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression du contact')
      setDeleting(false)
    }
  }

  // Activity Handlers (Identiques Fiches Projets)
  const openEventModal = (type: ActivityType) => {
    setEventDraft({
      type,
      title: '',
      content: '',
      due_at: '',
    })
    setEventDialogOpen(true)
  }

  const editEvent = (event: Activity) => {
    setEventDraft({
      id: event.id,
      type: event.type,
      title: event.title || '',
      content: event.content || '',
      due_at: event.due_at ? new Date(event.due_at).toISOString().slice(0, 16) : '',
    })
    setEventDialogOpen(true)
  }

  const handleSaveEvent = async () => {
    if (!eventDraft.title.trim() || !params?.id) return
    setSubmittingEvent(true)
    try {
      const res = await fetch(`/api/market/contacts/${params.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: eventDraft.type,
          text: eventDraft.title.trim(),
          payload: {
            content: eventDraft.content.trim(),
            due_at: eventDraft.due_at ? new Date(eventDraft.due_at).toISOString() : null,
          },
        }),
      })
      if (!res.ok) throw new Error('Erreur enregistrement activité')
      toast.success('Activité enregistrée dans le journal du contact')
      setEventDialogOpen(false)
      await loadData()
    } catch {
      toast.error('Impossible d\'enregistrer l\'activité')
    } finally {
      setSubmittingEvent(false)
    }
  }

  const handleDeleteEvent = async (event: Activity) => {
    if (!window.confirm('Supprimer cette activité du journal ?')) return
    setDeletingEventId(event.id)
    try {
      const res = await fetch(`/api/market/contacts/${params.id}/events?event_id=${event.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Suppression impossible')
      toast.success('Activité supprimée')
      await loadData()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeletingEventId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || !data.contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground font-medium">Contact introuvable.</p>
        <Button variant="outline" onClick={() => router.back()} className="rounded-full">Retour</Button>
      </div>
    )
  }

  const { contact, opportunities, buyerCriteria, activities } = data
  const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
  const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'C'

  const projectCount = opportunities.length + buyerCriteria.length
  const contactActivityCount = activities.filter((activity) => activity.contact_id === contact.id).length

  const effectiveTypes = normalizeContactTypes([
    ...(contact.types ?? []),
    ...(opportunities.length > 0 ? ['vendeur'] : []),
    ...(buyerCriteria.length > 0 ? ['acquereur'] : []),
  ])

  // Filtrage des activités pour le journal
  const filteredActivities = activities.filter((act) => {
    if (activityFilter === 'all') return true
    return act.type === activityFilter
  })

  return (
    <div className="space-y-6">
      {/* Top Navigation Link */}
      <div>
        <Link href="/admin/market/contacts" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Retour aux contacts
        </Link>
      </div>

      {/* Top Banner Card (Fiche Contact Header) */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="size-14 shrink-0 flex items-center justify-center rounded-full bg-sky-600 text-sky-50 text-lg font-bold shadow-xs">
              {initials}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                CONTACT
              </div>
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                {displayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ContactTypePills types={effectiveTypes} />
              </div>
              {contact.company || contact.relation ? (
                <p className="mt-1.5 text-sm text-muted-foreground font-medium">
                  {[contact.company, contact.relation].filter(Boolean).join(' • ')}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="font-semibold rounded-lg text-primary border-primary/30 hover:bg-primary/5"
            >
              <Link href={`/admin/market/projects/nouveau?kind=achat&contact_id=${contact.id}`}>
                <Plus className="mr-1.5 size-4" /> Projet d'achat
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="font-semibold rounded-lg text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <Link href={`/admin/market/projects/nouveau?kind=vente&contact_id=${contact.id}`}>
                <Plus className="mr-1.5 size-4" /> Projet vendeur
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={openEdit} className="font-semibold rounded-lg">
              <Edit className="mr-1.5 size-4" /> Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="font-semibold rounded-lg text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 size-4" /> Supprimer
            </Button>
          </div>
        </div>

        <Separator />

        {/* Contact Info Row */}
        <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-muted-foreground">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Phone className="size-4 text-muted-foreground" />
              <span>{contact.phone}</span>
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Mail className="size-4 text-muted-foreground" />
              <span>{contact.email}</span>
            </a>
          )}
          {contact.source && contact.source !== 'system' && (
            <span className="flex items-center gap-2 text-xs">
              <ExternalLink className="size-3.5 text-muted-foreground" />
              <span>Source : {contact.source}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (Projets Vendeur & Achats) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Card 1: PROJETS VENDEUR */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  PROJET{opportunities.length > 1 ? 'S' : ''} DE VENTE
                </h2>
                {opportunities.length > 0 && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-[10px] h-5 px-2">
                    {opportunities.length}
                  </Badge>
                )}
              </div>
            </div>

            {opportunities.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Aucun projet vendeur associé.
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/admin/market/projects/${opp.id}`}
                    className="block rounded-xl border bg-muted/40 p-4 hover:border-primary/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-xs font-bold">
                        {opp.stage || 'Inconnu'}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium flex items-center">
                        <MapPin className="mr-1 size-3" /> {opp.property_city || 'Ville non précisée'}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-foreground line-clamp-1">
                      {opp.title}
                    </h3>

                    <div className="text-xs text-muted-foreground font-medium">
                      Est. : {opp.estimated_price_min ? `${(opp.estimated_price_min/1000).toFixed()} k€` : 'Non estimé'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: PROJETS D'ACHAT */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  PROJET{buyerCriteria.length > 1 ? 'S' : ''} D'ACHAT
                </h2>
                {buyerCriteria.length > 0 && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-[10px] h-5 px-2">
                    {buyerCriteria.length}
                  </Badge>
                )}
              </div>
            </div>

            {buyerCriteria.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Aucun projet d'achat associé.
              </div>
            ) : (
              <div className="space-y-3">
                {buyerCriteria.map((bc) => (
                  <Link
                    key={bc.id}
                    href={`/admin/market/acheteurs/${bc.lead_id}`}
                    className={cn(
                      "block rounded-xl border bg-muted/40 p-4 hover:border-primary/40 transition-colors space-y-2",
                      !bc.active && "opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={bc.active ? 'default' : 'secondary'} className="text-xs font-bold rounded-full">
                        {bc.active ? (bc.stage || 'Actif') : 'Inactif'}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium flex items-center truncate">
                        <MapPin className="mr-1 size-3" /> {bc.communes?.join(', ') || 'Secteur indéfini'}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-foreground line-clamp-1">
                      Recherche {bc.type_bien?.toLowerCase() || 'bien'}
                    </h3>

                    <div className="text-xs text-muted-foreground font-medium">
                      Budget max : {bc.budget_max ? `${(bc.budget_max/1000).toFixed()} k€` : 'Non défini'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Journal d'activité strictly identical to project page) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
            {/* Header & Filter Dropdown */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  JOURNAL D'ACTIVITÉ
                </h2>
                {filteredActivities.length > 0 && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-[10px] h-5 px-2">
                    {filteredActivities.length} activité{filteredActivities.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-bold uppercase tracking-wider text-muted-foreground rounded-full px-4">
                    FILTRE : {activityFilter === 'all' ? 'TOUT' : activityFilter.toUpperCase()}
                    <ChevronDown className="ml-1 size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setActivityFilter('all')} className="text-xs font-semibold cursor-pointer">TOUT</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActivityFilter('note')} className="text-xs cursor-pointer">NOTES</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActivityFilter('task')} className="text-xs cursor-pointer">TÂCHES</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActivityFilter('call')} className="text-xs cursor-pointer">APPELS</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActivityFilter('meeting')} className="text-xs cursor-pointer">RDV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Action Buttons to Add Events */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEventModal('note')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                <StickyNote className="mr-2 size-3.5 text-primary" /> + Note
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEventModal('task')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                <CheckCircle2 className="mr-2 size-3.5 text-emerald-600" /> + Tâche
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEventModal('call')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                <Phone className="mr-2 size-3.5 text-sky-600" /> + Appel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEventModal('meeting')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                <Calendar className="mr-2 size-3.5 text-amber-600" /> + Rendez-vous

              </Button>
            </div>

            {/* Timeline Feed Identique aux Fiches Projets */}
            {filteredActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                Aucune activité enregistrée pour ce filtre.
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {filteredActivities.map((event) => {
                  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.note
                  const Icon = config.icon

                  return (
                    <div key={event.id} className="relative pl-6">
                      <div className="absolute left-0 top-2 size-2 rounded-full bg-primary" />
                      <div className="rounded-xl border bg-card p-4 space-y-2 shadow-2xs hover:bg-muted/30 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
                                <Icon className="mr-1 size-3" /> {config.label}
                              </Badge>
                              <span className="font-semibold text-sm text-foreground">
                                {event.title || config.label}
                              </span>
                            </div>
                            {event.content && (
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1">
                                {event.content}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                              {event.due_at && (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                  <Clock className="size-3" /> Échéance : {formatDateTime(event.due_at)}
                                </span>
                              )}
                              {authorLabel(event.created_by) && (
                                <span>Par : {authorLabel(event.created_by)}</span>
                              )}
                              <span>Le {formatDateTime(event.occurred_at || event.created_at || '')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              onClick={() => editEvent(event)}
                            >
                              <Edit className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteEvent(event)}
                              disabled={deletingEventId === event.id}
                            >
                              {deletingEventId === event.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de création / édition d'activité (Identique aux Fiches Projets) */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="rounded-2xl p-6 border bg-card">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold text-foreground">
              {eventDraft.id ? 'Modifier l’activité' : `Ajouter : ${EVENT_CONFIG[eventDraft.type]?.label || 'Activité'}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Consignez une activité dans le journal du contact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="event_type_select" className="text-xs font-semibold">Type d'activité</Label>
              <Select
                value={eventDraft.type}
                onValueChange={(val) => setEventDraft((prev) => ({ ...prev, type: val as ActivityType }))}
              >
                <SelectTrigger id="event_type_select" className="h-9 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note" className="text-xs">📝 Note</SelectItem>
                  <SelectItem value="task" className="text-xs">✓ Tâche</SelectItem>
                  <SelectItem value="call" className="text-xs">📞 Appel</SelectItem>
                  <SelectItem value="meeting" className="text-xs">📅 RDV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_title" className="text-xs font-semibold">Titre / Objet</Label>
              <Input
                id="event_title"
                placeholder="Ex: Compte-rendu d'appel, Remarque client..."
                value={eventDraft.title}
                onChange={(e) => setEventDraft((prev) => ({ ...prev, title: e.target.value }))}
                className="h-9 text-xs bg-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_content" className="text-xs font-semibold">Détails (optionnel)</Label>
              <textarea
                id="event_content"
                rows={3}
                placeholder="Précisez le détail des échanges ou les points clés..."
                value={eventDraft.content}
                onChange={(e) => setEventDraft((prev) => ({ ...prev, content: e.target.value }))}
                className="w-full rounded-xl border bg-card p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {(eventDraft.type === 'task' || eventDraft.type === 'meeting') && (
              <div className="space-y-2">
                <Label htmlFor="event_due_at" className="text-xs font-semibold">Date d'échéance / RDV</Label>
                <Input
                  id="event_due_at"
                  type="datetime-local"
                  value={eventDraft.due_at || ''}
                  onChange={(e) => setEventDraft((prev) => ({ ...prev, due_at: e.target.value }))}
                  className="h-9 text-xs bg-card"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)} className="rounded-full text-xs font-semibold">
              Annuler
            </Button>
            <Button onClick={handleSaveEvent} disabled={submittingEvent || !eventDraft.title.trim()} className="rounded-full text-xs font-bold px-5">
              {submittingEvent ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {eventDraft.id ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 border bg-card">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold text-foreground">Supprimer {displayName} ?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cette action est définitive.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 text-sm text-muted-foreground space-y-2">
            {projectCount > 0 ? (
              <p>
                Ce contact est rattaché à{' '}
                <span className="font-bold text-foreground">
                  {projectCount} projet{projectCount > 1 ? 's' : ''}
                </span>
                . Le rattachement sera retiré, les projets eux-mêmes sont conservés.
              </p>
            ) : (
              <p>Ce contact n’est rattaché à aucun projet.</p>
            )}
            {contactActivityCount > 0 && (
              <p>
                <span className="font-bold text-foreground">
                  {contactActivityCount} activité{contactActivityCount > 1 ? 's' : ''}
                </span>{' '}
                enregistrée{contactActivityCount > 1 ? 's' : ''} directement sur le contact
                {contactActivityCount > 1 ? ' seront supprimées' : ' sera supprimée'}. Les activités
                portées par les projets sont conservées.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-full text-xs font-semibold">
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full text-xs font-bold px-5"
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Supprimer le contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edition Contact */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-6 border bg-card">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold text-foreground">Modifier le contact</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Mettez à jour les coordonnées et rôles de {displayName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name" className="text-xs font-semibold">Prénom</Label>
                <Input
                  id="edit_first_name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="h-9 text-xs bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name" className="text-xs font-semibold">Nom</Label>
                <Input
                  id="edit_last_name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="h-9 text-xs bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_phone" className="text-xs font-semibold">Téléphone</Label>
                <Input
                  id="edit_phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="h-9 text-xs bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email" className="text-xs font-semibold">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-9 text-xs bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_company" className="text-xs font-semibold">Société (Optionnel)</Label>
                <Input
                  id="edit_company"
                  value={editForm.company}
                  onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                  className="h-9 text-xs bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_relation" className="text-xs font-semibold">Relation / Titre (Optionnel)</Label>
                <Input
                  id="edit_relation"
                  value={editForm.relation}
                  onChange={(e) => setEditForm((f) => ({ ...f, relation: e.target.value }))}
                  className="h-9 text-xs bg-card"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold">Types de contact</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {CONTACT_TYPES.map((type) => {
                  const active = editTypes.includes(type)
                  const meta = CONTACT_TYPE_META[type]
                  return (
                    <ToggleChip
                      key={type}
                      icon={meta.icon}
                      selected={active}
                      onClick={() => toggleType(type)}
                    >
                      {meta.label}
                    </ToggleChip>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-full text-xs font-semibold">
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="rounded-full text-xs font-bold px-5">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Enregistrer les modifications
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

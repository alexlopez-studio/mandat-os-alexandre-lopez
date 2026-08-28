'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit,
  Flame,
  History,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Play,
  Plus,
  Search,
  StickyNote,
  Trash2,
  User,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  ContactTypePills,
  EmptyState,
  Grid,
  LoadingState,
  PageHeader,
  PageLayout,
  Panel,
  StatusPill,
  ToggleChip,
} from '@/components/pro'
import {
  CONTACT_TYPES,
  CONTACT_TYPE_META,
  normalizeContactTypes,
  type ContactType,
} from '@/lib/contact-types'
import {
  formatFrenchDate,
  generateSalutation,
  parseContactMeta,
  serializeContactMeta,
  type ContactProfileMeta,
} from '@/lib/contact-profile'
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
    status?: string | null
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
  system: { label: 'Système', icon: Clock, className: 'bg-muted text-muted-foreground border-border' },
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
    civilite: '',
    salutation: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    company: '',
    birth_date: '',
    transaction_date: '',
    review_request: '',
    recommendation_request: '',
  })
  const [editTypes, setEditTypes] = useState<ContactType[]>([])

  // Activity Log Filter & Dialog State
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
    const m = parseContactMeta(c.relation)
    setEditForm({
      civilite: m.civilite || '',
      salutation: m.salutation || generateSalutation(c.first_name, m.civilite),
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      address: m.address || '',
      company: c.company || '',
      birth_date: m.birth_date || '',
      transaction_date: m.transaction_date || '',
      review_request: m.review_request || '',
      recommendation_request: m.recommendation_request || '',
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
      const currentMeta = parseContactMeta(data?.contact.relation)
      const nextMeta: ContactProfileMeta = {
        ...currentMeta,
        civilite: (editForm.civilite as 'M.' | 'Mme' | '') || null,
        salutation: editForm.salutation || null,
        address: editForm.address || null,
        birth_date: editForm.birth_date || null,
        transaction_date: editForm.transaction_date || null,
        review_request: editForm.review_request || null,
        recommendation_request: editForm.recommendation_request || null,
      }

      const res = await fetch(`/api/market/contacts/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || null,
          phone: editForm.phone || null,
          company: editForm.company || null,
          relation: serializeContactMeta(nextMeta),
          types: editTypes,
        }),
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

  const toggleFutureSeller = async () => {
    if (!data?.contact) return
    const m = parseContactMeta(data.contact.relation)
    const nextMeta: ContactProfileMeta = {
      ...m,
      is_future_seller: !m.is_future_seller,
    }
    await fetch(`/api/market/contacts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relation: serializeContactMeta(nextMeta) }),
    })
    await loadData()
    toast.success(nextMeta.is_future_seller ? 'Marqué futur vendeur' : 'Retiré des futurs vendeurs')
  }

  const toggleDoNotContact = async () => {
    if (!data?.contact) return
    const m = parseContactMeta(data.contact.relation)
    const nextMeta: ContactProfileMeta = {
      ...m,
      do_not_contact: !m.do_not_contact,
    }
    await fetch(`/api/market/contacts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relation: serializeContactMeta(nextMeta) }),
    })
    await loadData()
    toast.success(nextMeta.do_not_contact ? 'Marqué Ne pas contacter' : 'Contact réactivé')
  }

  const toggleWishes = async () => {
    if (!data?.contact) return
    const m = parseContactMeta(data.contact.relation)
    const nextMeta: ContactProfileMeta = {
      ...m,
      wishes_enabled: !(m.wishes_enabled ?? true),
    }
    await fetch(`/api/market/contacts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relation: serializeContactMeta(nextMeta) }),
    })
    await loadData()
    toast.success(nextMeta.wishes_enabled ? 'Vœux activés' : 'Vœux désactivés')
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

  // Activity Handlers
  const openNewEvent = (type: ActivityType = 'note') => {
    setEventDraft({
      type,
      title: '',
      content: '',
      due_at: '',
    })
    setEventDialogOpen(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventDraft.title.trim()) {
      toast.error('Le titre est requis')
      return
    }

    try {
      setSubmittingEvent(true)
      const res = await fetch(`/api/market/contacts/${params.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: eventDraft.type,
          title: eventDraft.title.trim(),
          content: eventDraft.content.trim() || null,
          due_at: eventDraft.due_at ? new Date(eventDraft.due_at).toISOString() : null,
        }),
      })

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement de l'activité")

      toast.success('Activité ajoutée au journal')
      setEventDialogOpen(false)
      await loadData()
    } catch (err) {
      console.error(err)
      toast.error("Impossible d'ajouter l'activité")
    } finally {
      setSubmittingEvent(false)
    }
  }

  const handleToggleTaskCompleted = async (activity: Activity) => {
    try {
      const isCompleted = !!activity.completed_at
      const res = await fetch(`/api/market/contacts/${params.id}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activity.id,
          completed: !isCompleted,
        }),
      })
      if (!res.ok) throw new Error('Mise à jour impossible')
      toast.success(isCompleted ? 'Tâche rouverte' : 'Tâche terminée')
      await loadData()
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la mise à jour de la tâche')
    }
  }

  const handleDeleteEvent = async (activityId: string) => {
    try {
      setDeletingEventId(activityId)
      const res = await fetch(`/api/market/contacts/${params.id}/events?activity_id=${activityId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Suppression impossible')
      toast.success('Activité supprimée')
      await loadData()
    } catch (err) {
      console.error(err)
      toast.error("Impossible de supprimer l'activité")
    } finally {
      setDeletingEventId(null)
    }
  }

  if (loading) {
    return (
      <PageLayout width="wide">
        <LoadingState label="Chargement du contact..." />
      </PageLayout>
    )
  }

  if (!data || !data.contact) {
    return (
      <PageLayout width="wide">
        <EmptyState
          icon={User}
          title="Contact introuvable"
          description="Le contact demandé n'existe pas ou a été supprimé."
          action={
            <Button variant="outline" onClick={() => router.back()} className="rounded-full">
              Retour
            </Button>
          }
        />
      </PageLayout>
    )
  }

  const { contact, opportunities, buyerCriteria, activities } = data
  const meta = parseContactMeta(contact.relation)
  const displayName = `${contact.first_name || ''} ${(contact.last_name || '').toUpperCase()}`.trim() || 'Contact'

  const effectiveTypes = normalizeContactTypes([
    ...(contact.types ?? []),
    ...(opportunities.length > 0 ? ['vendeur'] : []),
    ...(buyerCriteria.length > 0 ? ['acquereur'] : []),
  ])

  const filteredActivities = activities.filter((act) => {
    if (activityFilter === 'all') return true
    return act.type === activityFilter
  })

  // Calculate Last contact and Next action
  const lastActivity = activities.find(
    (a) => new Date(a.occurred_at) <= new Date() && a.type !== 'system'
  )
  const lastContactFormatted = lastActivity
    ? formatFrenchDate(lastActivity.occurred_at)
    : 'Jamais'

  const nextTask = activities.find(
    (a) => a.type === 'task' && !a.completed_at
  )
  const nextActionFormatted = nextTask
    ? `${nextTask.title || 'Tâche planifiée'} ${nextTask.due_at ? `(${formatFrenchDate(nextTask.due_at)})` : ''}`
    : 'Aucune'

  const isFutureSeller = Boolean(meta.is_future_seller)
  const doNotContact = Boolean(meta.do_not_contact)
  const wishesEnabled = meta.wishes_enabled ?? true

  return (
    <PageLayout width="wide">
      {/* Top Navigation Link */}
      <div>
        <Link
          href="/admin/market/contacts"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> Retour aux contacts
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title={displayName}
        description={
          contact.email || contact.phone
            ? [contact.email, contact.phone].filter(Boolean).join(' • ')
            : 'Fiche contact'
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleFutureSeller}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors shadow-xs',
                isFutureSeller
                  ? 'bg-amber-600 text-primary-foreground hover:bg-amber-700'
                  : 'bg-amber-600/90 text-primary-foreground hover:bg-amber-700'
              )}
            >
              <Flame className="size-4 fill-current" />
              {isFutureSeller ? 'Futur vendeur (Actif)' : 'Marquer futur vendeur'}
            </button>

            <button
              type="button"
              onClick={toggleDoNotContact}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                doNotContact
                  ? 'border-destructive bg-destructive/10 text-destructive'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <Ban className="size-4" />
              {doNotContact ? 'Bloqué' : 'Ne pas contacter'}
            </button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="font-semibold rounded-lg text-primary border-primary/30 hover:bg-primary/5 gap-2"
            >
              <Link href={`/admin/market/projects/nouveau?kind=achat&contact_id=${contact.id}`}>
                <Plus className="size-4" /> Projet d'achat
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="font-semibold rounded-lg text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-2"
            >
              <Link href={`/admin/market/projects/nouveau?kind=vente&contact_id=${contact.id}`}>
                <Plus className="size-4" /> Projet vendeur
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={openEdit} className="font-semibold rounded-lg gap-2">
              <Edit className="size-4" /> Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="font-semibold rounded-lg text-destructive hover:text-destructive gap-2"
            >
              <Trash2 className="size-4" /> Supprimer
            </Button>
          </div>
        }
      />

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <ContactTypePills types={effectiveTypes} />
        <StatusPill tone={doNotContact ? 'danger' : 'success'}>
          {doNotContact ? 'Ne pas contacter' : 'Actif'}
        </StatusPill>
      </div>

      {/* Top 2 Metric Cards */}
      <div className="grid grid-cols-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-0 pr-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Dernier contact
          </p>
          <p className="text-base font-bold text-foreground">{lastContactFormatted}</p>
        </div>
        <div className="space-y-0 pl-4 border-l border-border">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Prochaine action
          </p>
          <p className="text-base font-bold text-foreground">{nextActionFormatted}</p>
        </div>
      </div>

      {/* Main Grid */}
      <Grid cols={2}>
        {/* Left Column (Coordonnées, Automatisations & Projets) */}
        <div className="space-y-6">
          {/* Card 1: COORDONNÉES */}
          <Panel
            title="Coordonnées"
            actions={
              <button
                type="button"
                onClick={openEdit}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Modifier
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Civilité</p>
                <p className="font-semibold text-foreground">{meta.civilite || '—'}</p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Dans les messages</p>
                <p className="font-semibold text-foreground">
                  {meta.salutation || generateSalutation(contact.first_name, meta.civilite)}
                </p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Prénom</p>
                <p className="font-semibold text-foreground">{contact.first_name || '—'}</p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Nom</p>
                <p className="font-semibold text-foreground">
                  {(contact.last_name || '').toUpperCase() || '—'}
                </p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Email</p>
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="font-semibold text-primary hover:underline line-clamp-1"
                  >
                    {contact.email}
                  </a>
                ) : (
                  <p className="font-semibold text-muted-foreground">—</p>
                )}
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Téléphone</p>
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  <p className="font-semibold text-muted-foreground">—</p>
                )}
              </div>
              <div className="col-span-2 space-y-0 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">Adresse de domicile</p>
                <p className="font-semibold text-foreground">{meta.address || '—'}</p>
              </div>
            </div>
          </Panel>

          {/* Card 2: AUTOMATISATIONS ACTIVES */}
          <Panel title="Automatisations actives">
            <div className="space-y-4">
              {/* Anniversaire client */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Anniversaire">🎂</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Anniversaire client</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.birth_date ? formatFrenchDate(meta.birth_date) : 'Date de naissance non renseignée'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEdit}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30"
                >
                  {meta.birth_date ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {meta.birth_date ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>

              {/* Vœux de fin d'année */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Vœux">🎉</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Vœux de fin d'année</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Envoyés entre le 28 et le 31 décembre
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleWishes}
                  className={cn(
                    'size-8 rounded-full flex items-center justify-center transition-colors',
                    wishesEnabled
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                  title={wishesEnabled ? 'Désactiver les vœux' : 'Activer les vœux'}
                >
                  <Play className="size-4 fill-current ml-0.5" />
                </button>
              </div>

              {/* Date de transaction */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Transaction">🏠</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Date de transaction</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.transaction_date ? formatFrenchDate(meta.transaction_date) : 'Aucune transaction'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEdit}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30"
                >
                  {meta.transaction_date ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {meta.transaction_date ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>

              {/* Demande d'avis */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Avis">⭐</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Demande d'avis</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.review_request || 'Aucune demande programmée'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEdit}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30"
                >
                  {meta.review_request ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {meta.review_request ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>

              {/* Recommandation */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Recommandation">🤝</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Recommandation</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.recommendation_request || 'Aucune demande programmée'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEdit}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30"
                >
                  {meta.recommendation_request ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {meta.recommendation_request ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </Panel>

          {/* Card 3: RÉSUMÉ RELATIONNEL */}
          <Panel
            title="Résumé relationnel"
            actions={
              <button
                type="button"
                onClick={openEdit}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Modifier
              </button>
            }
          >
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <User className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs uppercase font-bold text-muted-foreground">Profil</p>
                  <p className="font-semibold text-foreground">
                    {effectiveTypes.map((t) => CONTACT_TYPE_META[t]?.label || t).join(', ') || 'Vendeur'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-border pt-4">
                <UserCheck className="size-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Dans la base depuis le {formatFrenchDate(contact.created_at)}
                </p>
              </div>
            </div>
          </Panel>

          {/* Card 4: PROJETS DE VENTE */}
          <Panel
            title={`PROJET${opportunities.length > 1 ? 'S' : ''} DE VENTE`}
            actions={
              opportunities.length > 0 ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-xs">
                  {opportunities.length}
                </Badge>
              ) : undefined
            }
          >
            <div>
              {opportunities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Aucun projet vendeur associé.
                </div>
              ) : (
                <div className="space-y-4">
                  {opportunities.map((opp) => (
                    <Link
                      key={opp.id}
                      href={`/admin/market/projects/${opp.id}`}
                      className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors space-y-2"
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
          </Panel>

          {/* Card 5: PROJETS D'ACHAT */}
          <Panel
            title={`PROJET${buyerCriteria.length > 1 ? 'S' : ''} D'ACHAT`}
            actions={
              buyerCriteria.length > 0 ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-xs">
                  {buyerCriteria.length}
                </Badge>
              ) : undefined
            }
          >
            <div>
              {buyerCriteria.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Aucun projet d'achat associé.
                </div>
              ) : (
                <div className="space-y-4">
                  {buyerCriteria.map((bc) => (
                    <Link
                      key={bc.id}
                      href={`/admin/market/acheteurs/${bc.lead_id}`}
                      className={cn(
                        "block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors space-y-2",
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
          </Panel>
        </div>

        {/* Right Column (Journal d'activité) */}
        <div className="space-y-6">
          <Panel
            title="JOURNAL D'ACTIVITÉ"
            actions={
              <div className="flex items-center gap-2">
                {filteredActivities.length > 0 && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-xs">
                    {filteredActivities.length} activité{filteredActivities.length > 1 ? 's' : ''}
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground rounded-full px-4">
                      FILTRE : {activityFilter === 'all' ? 'TOUT' : activityFilter.toUpperCase()}
                      <ChevronDown className="ml-1 size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setActivityFilter('all')} className="text-xs font-semibold cursor-pointer">TOUT</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActivityFilter('note')} className="text-xs cursor-pointer">NOTES</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActivityFilter('task')} className="text-xs cursor-pointer">TÂCHES</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActivityFilter('call')} className="text-xs cursor-pointer">APPELS</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActivityFilter('meeting')} className="text-xs cursor-pointer">RDV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          >
            {/* Quick Activity Creator Bar */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openNewEvent('note')}
                className="justify-start gap-2 h-8 text-xs font-semibold rounded-xl border-dashed hover:border-primary/50"
              >
                <StickyNote className="size-4 text-primary" /> Note
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openNewEvent('call')}
                className="justify-start gap-2 h-8 text-xs font-semibold rounded-xl border-dashed hover:border-sky-500/50"
              >
                <Phone className="size-4 text-sky-600" /> Appel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openNewEvent('meeting')}
                className="justify-start gap-2 h-8 text-xs font-semibold rounded-xl border-dashed hover:border-amber-500/50"
              >
                <Calendar className="size-4 text-amber-600" /> RDV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openNewEvent('task')}
                className="justify-start gap-2 h-8 text-xs font-semibold rounded-xl border-dashed hover:border-emerald-500/50"
              >
                <CheckCircle2 className="size-4 text-emerald-600" /> Tâche
              </Button>
            </div>

            {/* Activities List */}
            <div>
              {filteredActivities.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="Aucune activité enregistrée"
                  description="Utilisez les boutons ci-dessus pour consigner une note, un appel téléphonique ou planifier une tâche."
                />
              ) : (
                <div className="relative space-y-4 before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-border/60">
                  {filteredActivities.map((act) => {
                    const cfg = EVENT_CONFIG[act.type] || EVENT_CONFIG.system
                    const Icon = cfg.icon
                    const isTask = act.type === 'task'
                    const isCompleted = !!act.completed_at
                    const author = authorLabel(act.created_by)

                    return (
                      <div key={act.id} className="relative flex items-start gap-4 pl-0 group">
                        {/* Left Icon Pill */}
                        <div className={cn(
                          "size-8 rounded-full border flex items-center justify-center shrink-0 z-10 bg-card transition-transform",
                          cfg.className,
                          isTask && isCompleted && "bg-emerald-500 text-primary-foreground border-emerald-500"
                        )}>
                          <Icon className="size-4" />
                        </div>

                        {/* Content Card */}
                        <div className="flex-1 rounded-xl border border-border bg-card p-4 shadow-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-foreground">
                                  {act.title || cfg.label}
                                </span>
                                <Badge variant="outline" className={cn("text-xs font-semibold py-0", cfg.className)}>
                                  {cfg.label}
                                </Badge>
                                {isTask && (
                                  <Badge
                                    variant={isCompleted ? "default" : "secondary"}
                                    className={cn(
                                      "text-xs font-bold",
                                      isCompleted ? "bg-emerald-600 text-primary-foreground" : "bg-amber-100 text-amber-800"
                                    )}
                                  >
                                    {isCompleted ? 'Terminée' : 'À faire'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                <span>{formatDateTime(act.occurred_at)}</span>
                                {author && <span>• par {author}</span>}
                                {act.due_at && (
                                  <span className={cn(
                                    "font-semibold",
                                    new Date(act.due_at) < new Date() && !isCompleted ? "text-destructive" : "text-primary"
                                  )}>
                                    • Échéance : {formatDateTime(act.due_at)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isTask && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleTaskCompleted(act)}
                                  className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                                >
                                  {isCompleted ? 'Rouvrir' : 'Terminer'}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteEvent(act.id)}
                                disabled={deletingEventId === act.id}
                                className="size-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>

                          {act.content && (
                            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed pt-2 border-t border-border/50">
                              {act.content}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </Grid>

      {/* Modal Ajout Événement / Activité */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="bg-card">
          <form onSubmit={handleSaveEvent}>
            <DialogHeader>
              <DialogTitle>Ajouter une activité</DialogTitle>
              <DialogDescription>
                Consignez un appel, un rendez-vous, une note ou créez une tâche planifiée.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="event_type" className="text-xs font-semibold">Type d'activité</Label>
                <Select
                  value={eventDraft.type}
                  onValueChange={(val: ActivityType) => setEventDraft((d) => ({ ...d, type: val }))}
                >
                  <SelectTrigger id="event_type" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note libre</SelectItem>
                    <SelectItem value="call">Appel téléphonique</SelectItem>
                    <SelectItem value="meeting">Rendez-vous</SelectItem>
                    <SelectItem value="task">Tâche à faire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_title" className="text-xs font-semibold">Titre / Objet</Label>
                <Input
                  id="event_title"
                  value={eventDraft.title}
                  onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder={eventDraft.type === 'call' ? 'Ex: Point d’avancement estimation' : 'Titre de l’activité'}
                  className="h-8 text-xs"
                  required
                />
              </div>

              {eventDraft.type === 'task' && (
                <div className="space-y-2">
                  <Label htmlFor="event_due" className="text-xs font-semibold">Date d'échéance</Label>
                  <Input
                    id="event_due"
                    type="datetime-local"
                    value={eventDraft.due_at}
                    onChange={(e) => setEventDraft((d) => ({ ...d, due_at: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="event_content" className="text-xs font-semibold">Détails / Notes</Label>
                <textarea
                  id="event_content"
                  rows={3}
                  value={eventDraft.content}
                  onChange={(e) => setEventDraft((d) => ({ ...d, content: e.target.value }))}
                  placeholder="Compte-rendu, notes ou informations importantes..."
                  className="w-full rounded-md border border-border bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEventDialogOpen(false)} className="rounded-full text-xs font-semibold">
                Annuler
              </Button>
              <Button type="submit" disabled={submittingEvent} className="rounded-full text-xs font-bold px-4">
                {submittingEvent ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmation Suppression Contact */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="text-destructive font-bold">Supprimer le contact</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement <strong>{displayName}</strong> ?
              Cette action supprimera également toutes ses activités associées.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-full text-xs font-semibold">
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full text-xs font-bold px-4"
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirmer la suppression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Édition Contact Complète */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="overflow-y-auto bg-card">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Modifier la fiche contact</DialogTitle>
              <DialogDescription>
                Mettez à jour les coordonnées, salutations et automatisations du contact.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Civilité</Label>
                  <Select
                    value={editForm.civilite}
                    onValueChange={(val) =>
                      setEditForm((prev) => ({
                        ...prev,
                        civilite: val,
                        salutation: generateSalutation(prev.first_name, val),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M.">M.</SelectItem>
                      <SelectItem value="Mme">Mme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dans les messages</Label>
                  <Input
                    value={editForm.salutation}
                    onChange={(e) => setEditForm((f) => ({ ...f, salutation: e.target.value }))}
                    placeholder="« Bonjour Dupont, »"
                    className="h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        first_name: e.target.value,
                        salutation: generateSalutation(e.target.value, f.civilite),
                      }))
                    }
                    className="h-8"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="h-8"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="06 12 34 56 78"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="contact@exemple.fr"
                    className="h-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Adresse de domicile</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="12 rue de la Paix, 83110 Sanary"
                  className="h-8"
                />
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Automatisations & Dates clés
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Anniversaire client</Label>
                    <Input
                      type="date"
                      value={editForm.birth_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, birth_date: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de transaction</Label>
                    <Input
                      type="date"
                      value={editForm.transaction_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, transaction_date: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Demande d'avis</Label>
                    <Input
                      value={editForm.review_request}
                      onChange={(e) => setEditForm((f) => ({ ...f, review_request: e.target.value }))}
                      placeholder="Ex: Avis Google 5 étoiles reçu"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Recommandation</Label>
                    <Input
                      value={editForm.recommendation_request}
                      onChange={(e) => setEditForm((f) => ({ ...f, recommendation_request: e.target.value }))}
                      placeholder="Ex: Relance parrainage dans 6 mois"
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold">Types de contact</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {CONTACT_TYPES.map((type) => {
                    const active = editTypes.includes(type)
                    const metaType = CONTACT_TYPE_META[type]
                    return (
                      <ToggleChip
                        key={type}
                        icon={metaType.icon}
                        selected={active}
                        onClick={() => toggleType(type)}
                      >
                        {metaType.label}
                      </ToggleChip>
                    )
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-full text-xs font-semibold">
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="rounded-full text-xs font-bold px-4">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Enregistrer les modifications
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

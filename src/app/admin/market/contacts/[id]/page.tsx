'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  Home,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
  due_at: string | null
  occurred_at: string
  completed_at: string | null
  metadata: Record<string, unknown>
  created_by: string | null
}

interface Opportunity {
  id: string
  title: string | null
  stage: string | null
  property_city: string | null
  property_type: string | null
  estimated_price_min: number | null
  estimated_price_max: number | null
  created_at: string
}

interface BuyerCriteria {
  id: string
  lead_id: string
  type_bien: string | null
  communes: string[] | null
  budget_max: number | null
  stage: string | null
  active: boolean
  created_at: string
}

interface ContactData {
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    company: string | null
    relation: string | null
    source: string | null
    types: string[] | null
    created_at: string
  }
  opportunities: Opportunity[]
  buyerCriteria: BuyerCriteria[]
  activities: Activity[]
}

const EVENT_CONFIG: Record<ActivityType, { label: string; icon: typeof StickyNote; className: string }> = {
  note: { label: 'Note', icon: StickyNote, className: 'bg-slate-100 text-slate-700 border-slate-200' },
  task: { label: 'Tâche', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  call: { label: 'Appel', icon: Phone, className: 'bg-sky-50 text-sky-700 border-sky-200' },
  meeting: { label: 'Rendez-vous', icon: Calendar, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  email: { label: 'Email', icon: Mail, className: 'bg-sky-50 text-sky-700 border-sky-200' },
  stage_change: { label: 'Étape', icon: ArrowLeft, className: 'bg-orange-50 text-orange-700 border-orange-200' },
  estimation: { label: 'Estimation', icon: Home, className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  system: { label: 'Système', icon: Clock, className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default function ContactPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<ContactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    relation: '',
  })
  const [editTypes, setEditTypes] = useState<ContactType[]>([])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/market/contacts/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch contact')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openEdit = () => {
    if (!data?.contact) return
    setEditForm({
      first_name: data.contact.first_name ?? '',
      last_name: data.contact.last_name ?? '',
      email: data.contact.email ?? '',
      phone: data.contact.phone ?? '',
      company: data.contact.company ?? '',
      relation: data.contact.relation ?? '',
    })
    setEditTypes(normalizeContactTypes(data.contact.types))
    setEditOpen(true)
  }

  const toggleEditType = (type: ContactType) => {
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

  /**
   * La suppression est cascadante : elle emporte les rattachements aux projets
   * et les activités du contact. `force` n'est envoyé qu'après confirmation
   * explicite dans la popup, qui annonce ce qui sera perdu.
   */
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
  // Seules les activités portant directement `contact_id` disparaissent avec le
  // contact ; celles rattachées à un projet lui survivent.
  const contactActivityCount = activities.filter((activity) => activity.contact_id === contact.id).length

  const effectiveTypes = normalizeContactTypes([
    ...(contact.types ?? []),
    ...(opportunities.length > 0 ? ['vendeur'] : []),
    ...(buyerCriteria.length > 0 ? ['acquereur'] : []),
  ])

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

          <div className="flex items-center gap-2 shrink-0">
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                PROJET{opportunities.length > 1 ? 'S' : ''} DE VENTE
              </h2>
              <Badge variant="outline" className="text-[10px] font-bold">
                {opportunities.length}
              </Badge>
            </div>

            {opportunities.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Aucun projet de vente rattaché.
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/admin/market/opportunities/${opp.id}`}
                    className="block rounded-xl border bg-muted/40 p-4 hover:border-primary/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-none rounded-full px-2.5 py-0.5 text-xs font-bold">
                        {opp.stage || 'Nouveau'}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium flex items-center">
                        <MapPin className="mr-1 size-3" /> {opp.property_city || 'Brignoles'}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-foreground line-clamp-1">
                      {opp.title || 'Projet de vente'}
                    </h3>

                    <div className="text-xs text-muted-foreground font-medium">
                      💰 {(opp.estimated_price_max && opp.estimated_price_min) 
                        ? `${(opp.estimated_price_min/1000).toFixed()}k - ${(opp.estimated_price_max/1000).toFixed()}k €` 
                        : 'Prix à estimer'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: RECHERCHES ACQUÉREUR */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                PROJET{buyerCriteria.length > 1 ? 'S' : ''} D’ACHAT
              </h2>
              <Badge variant="outline" className="text-[10px] font-bold">
                {buyerCriteria.length}
              </Badge>
            </div>

            {buyerCriteria.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Aucun projet d’achat rattaché.
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
                      💰 Budget max : {bc.budget_max ? `${(bc.budget_max/1000).toFixed()} k€` : 'Non défini'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Historique Global) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                HISTORIQUE GLOBAL
              </h2>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                {activities.length} ACTIVITÉ{activities.length > 1 ? 'S' : ''}
              </Badge>
            </div>

            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
                Aucune activité enregistrée pour ce contact.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((event) => {
                  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.system
                  const Icon = config.icon
                  const isTask = event.type === 'task'
                  const isDone = isTask && !!event.completed_at

                  return (
                    <div key={event.id} className="relative pl-6">
                      <div className="absolute left-0 top-2 size-2 rounded-full bg-primary" />
                      <div className="absolute bottom-[-18px] left-[3px] top-4 w-px bg-border last:hidden" />
                      
                      <div className="rounded-xl border p-3 bg-muted/40 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn('text-[10px]', config.className)}>
                              <Icon className="mr-1 size-3" /> {config.label}
                            </Badge>
                            <span className={cn("text-sm font-bold text-foreground", isDone && "line-through text-muted-foreground")}>
                              {event.title || config.label}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">
                            {new Date(event.occurred_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {event.content && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap font-medium">
                            {event.content}
                          </p>
                        )}

                        <div className="flex gap-2 pt-1">
                          {event.opportunity_id && (
                            <Badge variant="secondary" className="text-[10px] rounded-full">Projet de vente</Badge>
                          )}
                          {event.lead_id && (
                            <Badge variant="secondary" className="text-[10px] rounded-full">Projet d’achat</Badge>
                          )}
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

      {/* Delete Dialog */}
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

          <DialogFooter className="pt-3 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting} className="rounded-full">
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-full px-5">
              {deleting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Trash2 className="mr-1.5 size-4" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 border bg-card">
          <form onSubmit={handleSave}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">Modifier le contact</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Un contact peut cumuler plusieurs types.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit_first_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prénom</Label>
                  <Input
                    id="edit_first_name"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_last_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom</Label>
                  <Input
                    id="edit_last_name"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit_email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</Label>
                  <Input
                    id="edit_phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit_company" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Société</Label>
                  <Input
                    id="edit_company"
                    placeholder="Étude, cabinet, enseigne…"
                    value={editForm.company}
                    onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_relation" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Relation / métier</Label>
                  <Input
                    id="edit_relation"
                    placeholder="Notaire, courtier, ami…"
                    value={editForm.relation}
                    onChange={(e) => setEditForm((p) => ({ ...p, relation: e.target.value }))}
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
                        selected={editTypes.includes(type)}
                        onClick={() => toggleEditType(type)}
                      >
                        {meta.label}
                      </ToggleChip>
                    )
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="pt-3 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-full">
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white rounded-full px-5">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

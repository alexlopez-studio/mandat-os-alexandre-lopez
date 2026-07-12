'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/supabase'

/**
 * Espace de suivi post-mandat d'un dossier client (Documents / Plan de vente /
 * Visites / Offres), autonome : il charge ses propres données via l'API dossier
 * et peut être monté partout où l'on dispose d'un `dossierId` (fiche client,
 * fiche opportunité/mandat...).
 */

type ClientDocument = {
  id: string
  label: string
  category: string
  status: string
  file_name: string | null
  signed_url: string | null
  notes: string | null
  uploaded_at: string | null
  validated_at: string | null
}

type ClientEvent = {
  id: string
  type: string
  title: string
  description: string | null
  status: string
  event_date: string | null
  payload: Json
  visible_to_client: boolean
}

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  missing: 'Manquant',
  requested: 'Demandé',
  uploaded: 'Reçu',
  validated: 'Validé',
  rejected: 'Rejeté',
}

const EVENT_STATUS_OPTIONS = [
  { value: 'todo', label: 'À venir' },
  { value: 'pending', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'blocked', label: 'Bloqué' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'declined', label: 'Refusé' },
]
const MILESTONE_TYPE_OPTIONS = ['Estimation', 'Signature mandat', 'Préparation dossier', 'Shooting photo', 'Visite virtuelle', 'Diffusion annonce', 'Visites', 'Offres', 'Compromis', 'Acte authentique']
const VISIT_STATUS_OPTIONS = [
  { value: 'planned', label: 'Programmée' },
  { value: 'done', label: 'Effectuée' },
  { value: 'cancelled', label: 'Annulée' },
  { value: 'postponed', label: 'Reportée' },
]
const BUYER_PROFILE_OPTIONS = ['Résidence principale', 'Résidence secondaire', 'Investisseur', 'Mutation professionnelle', 'Retraite', 'Projet familial']
const FINANCING_OPTIONS = ['Non vérifié', 'Budget déclaré', 'Courtier validé', 'Accord bancaire', 'Comptant', 'À confirmer']
const OFFER_STATUS_OPTIONS = [
  { value: 'new', label: 'Nouvelle' },
  { value: 'pending', label: 'En analyse' },
  { value: 'accepted', label: 'Acceptée' },
  { value: 'counter', label: 'Contre-proposition' },
  { value: 'declined', label: 'Refusée' },
  { value: 'expired', label: 'Expirée' },
  { value: 'withdrawn', label: 'Retirée' },
]
const OFFER_CONDITION_OPTIONS = ['Sans condition suspensive', 'Sous condition de prêt', 'Sous condition de vente', 'Sous condition urbanisme', 'Paiement comptant']
const OFFER_STRENGTH_OPTIONS = ['À vérifier', 'Correct', 'Solide', 'Très solide']
const DOCUMENT_CATEGORY_OPTIONS = ['Propriété', 'Identité', 'Diagnostics', 'Fiscalité', 'Urbanisme', 'Copropriété', 'Travaux', 'Assainissement', 'Mandat']
const REJECTION_REASON_OPTIONS = ['Illisible', 'Document incomplet', 'Document expiré', 'Mauvais document', 'Informations incohérentes', 'À rescanner']

const ADMIN_INPUT_CLASS = 'h-10 rounded-xl px-3 text-sm'
const ADMIN_SELECT_CLASS = 'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm'
const ADMIN_TEXTAREA_CLASS = 'rounded-xl px-3 py-2 text-sm'
const ADMIN_PRIMARY_ACTION_CLASS = 'h-10 rounded-xl px-4'
const ADMIN_SECONDARY_ACTION_CLASS = 'h-9 rounded-xl px-3'
const ADMIN_ICON_ACTION_CLASS = 'size-9 rounded-xl'

export function DossierWorkspace({ dossierId }: { dossierId: string }) {
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [newDoc, setNewDoc] = useState({ label: '', category: 'Autre' })
  const [newEvent, setNewEvent] = useState(emptyEventDraft())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [clientAccessSent, setClientAccessSent] = useState(false)
  const [openingClientLink, setOpeningClientLink] = useState(false)
  const [tab, setTab] = useState('documents')

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/market/clients/${dossierId}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      toast.error(json.error ?? 'Chargement du suivi impossible')
      return
    }
    setDocuments(json.data.documents ?? [])
    setEvents(json.data.events ?? [])
  }, [dossierId])

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [fetchDetail])

  async function addDocument() {
    if (!newDoc.label.trim()) return
    const res = await fetch(`/api/market/clients/${dossierId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDoc),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return toast.error(json.error ?? 'Ajout impossible')
    setNewDoc({ label: '', category: 'Autre' })
    await fetchDetail()
  }

  async function updateDocument(documentId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/market/clients/${dossierId}/documents`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: documentId, ...patch }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return toast.error(json.error ?? 'Mise à jour impossible')
    await fetchDetail()
  }

  async function deleteDocument(documentId: string) {
    const res = await fetch(`/api/market/clients/${dossierId}/documents?id=${encodeURIComponent(documentId)}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok || !json.success) return toast.error(json.error ?? 'Suppression impossible')
    await fetchDetail()
  }

  async function uploadDocument(document: ClientDocument | null, file: File | null) {
    if (!file) return
    setUploadingId(document?.id ?? 'new')
    try {
      const body = new FormData()
      if (document) body.set('document_id', document.id)
      body.set('label', document?.label ?? file.name)
      body.set('category', document?.category ?? 'general')
      body.set('file', file)
      const res = await fetch(`/api/market/clients/${dossierId}/documents/upload`, { method: 'POST', body })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Upload impossible')
      await fetchDetail()
      toast.success('Document ajouté')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload impossible')
    } finally {
      setUploadingId(null)
    }
  }

  async function addEvent(type: string) {
    if (!newEvent.title.trim()) return
    const res = await fetch(`/api/market/clients/${dossierId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newEvent.title,
        description: newEvent.description,
        type,
        status: normalizedEventStatus(type, newEvent.status),
        event_date: newEvent.event_date,
        visible_to_client: newEvent.visible_to_client,
        payload: normalizeEventPayload(newEvent),
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return toast.error(json.error ?? 'Ajout impossible')
    setNewEvent(emptyEventDraft())
    await fetchDetail()
  }

  async function updateEvent(eventId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/market/clients/${dossierId}/events`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, ...patch }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return toast.error(json.error ?? 'Mise à jour impossible')
    await fetchDetail()
  }

  async function deleteEvent(eventId: string) {
    const res = await fetch(`/api/market/clients/${dossierId}/events?id=${encodeURIComponent(eventId)}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok || !json.success) return toast.error(json.error ?? 'Suppression impossible')
    await fetchDetail()
  }

  async function inviteClient() {
    setInviting(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/invite`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Invitation impossible')
      if (json.data?.action_link) {
        await navigator.clipboard?.writeText(json.data.action_link)
        toast.success('Lien d’invitation copié')
      } else {
        toast.success('Invitation envoyée')
      }
      setClientAccessSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invitation impossible')
    } finally {
      setInviting(false)
    }
  }

  async function openClientPortalLink() {
    setOpeningClientLink(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/preview-link`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.preview_url) throw new Error(json.error ?? 'Ouverture impossible')
      const href = json.data.preview_url
      await navigator.clipboard?.writeText(href)
      window.open(href, '_blank', 'noopener,noreferrer')
      toast.success('Aperçu client ouvert et lien copié')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ouverture impossible')
    } finally {
      setOpeningClientLink(false)
    }
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">Chargement du suivi mandat...</p>

  const planEvents = events.filter((event) => !['visit', 'offer'].includes(event.type))
  const visitEvents = events.filter((event) => event.type === 'visit')
  const offerEvents = events.filter((event) => event.type === 'offer')
  const missingDocuments = documents.filter((document) => ['missing', 'requested', 'rejected'].includes(document.status)).length
  const validatedDocuments = documents.filter((document) => document.status === 'validated').length
  const visibleEvents = events.filter((event) => event.visible_to_client).length

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Portail client</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Estimation, documents, plan de vente, visites et offres — administrés ici, visualisés côté client.</p>
          <Badge variant="outline" className={clientAccessSent ? 'mt-2 border-emerald-200 bg-emerald-50 text-emerald-700' : 'mt-2 border-amber-200 bg-amber-50 text-amber-700'}>
            {clientAccessSent ? 'Accès envoyé' : 'Accès à envoyer'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={inviteClient} disabled={inviting}>
            {inviting ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Send className="mr-1 size-4" />}
            Donner accès au client
          </Button>
          <Button variant="outline" size="sm" onClick={openClientPortalLink} disabled={openingClientLink}>
            {openingClientLink ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Eye className="mr-1 size-4" />}
            Prévisualiser l’espace client
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalKpi icon={FileText} label="Documents validés" value={`${validatedDocuments}/${documents.length}`} helper={missingDocuments > 0 ? `${missingDocuments} à traiter` : 'Dossier à jour'} />
        <PortalKpi icon={BookOpen} label="Plan publié" value={String(planEvents.length)} helper={`${visibleEvents} élément(s) visibles client`} />
        <PortalKpi icon={CalendarDays} label="Visites" value={String(visitEvents.length)} helper={visitEvents.some((event) => event.status === 'planned') ? 'Visite programmée' : 'Historique visites'} />
        <PortalKpi icon={CheckCircle2} label="Offres" value={String(offerEvents.length)} helper={offerEvents.some((event) => ['new', 'pending', 'counter'].includes(event.status)) ? 'À suivre' : 'Suivi commercial'} />
      </section>

      <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl border bg-white p-1 shadow-sm">
        <WorkspaceTab value="documents" icon={FileText} label="Documents" />
        <WorkspaceTab value="plan" icon={BookOpen} label="Plan de vente" />
        <WorkspaceTab value="visites" icon={CalendarDays} label="Visites" />
        <WorkspaceTab value="offres" icon={CheckCircle2} label="Offres" />
      </TabsList>

      <TabsContent value="documents" className="space-y-6">
        <Section title="Ajouter une pièce demandée" icon={FileText}>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input value={newDoc.label} onChange={(event) => setNewDoc({ ...newDoc, label: event.target.value })} placeholder="Ex. Diagnostic amiante" className={ADMIN_INPUT_CLASS} />
            <SelectWithOther label="Catégorie" value={newDoc.category} options={DOCUMENT_CATEGORY_OPTIONS} onChange={(value) => setNewDoc({ ...newDoc, category: value })} compact />
            <Button onClick={addDocument} className={ADMIN_PRIMARY_ACTION_CLASS}><Plus className="mr-2 size-4" /> Ajouter</Button>
          </div>
        </Section>
        <Section title="Checklist et fichiers vendeur" icon={FileText}>
          <div className="space-y-3">
            {documents.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                uploadingId={uploadingId}
                onUpdate={updateDocument}
                onDelete={deleteDocument}
                onUpload={uploadDocument}
              />
            ))}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-white p-5 text-sm font-semibold text-primary hover:bg-accent/50">
              {uploadingId === 'new' ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Ajouter un fichier libre
              <input type="file" className="sr-only" onChange={(event) => uploadDocument(null, event.target.files?.[0] ?? null)} />
            </label>
          </div>
        </Section>
      </TabsContent>

      <TabsContent value="plan" className="space-y-6">
        <EventEditor title="Ajouter une étape au plan de vente" type="milestone" onAdd={addEvent} newEvent={newEvent} setNewEvent={setNewEvent} />
        <EventList title="Plan de vente publié" events={planEvents} onUpdate={updateEvent} onDelete={deleteEvent} />
      </TabsContent>

      <TabsContent value="visites" className="space-y-6">
        <EventEditor title="Ajouter une visite physique" type="visit" onAdd={addEvent} newEvent={newEvent} setNewEvent={setNewEvent} />
        <EventList title="Comptes-rendus de visites" events={visitEvents} onUpdate={updateEvent} onDelete={deleteEvent} />
      </TabsContent>

      <TabsContent value="offres" className="space-y-6">
        <EventEditor title="Ajouter une offre d'achat" type="offer" onAdd={addEvent} newEvent={newEvent} setNewEvent={setNewEvent} />
        <EventList title="Offres transmises" events={offerEvents} onUpdate={updateEvent} onDelete={deleteEvent} />
      </TabsContent>
    </Tabs>
  )
}

function PortalKpi({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof FileText
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold uppercase text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-extrabold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</p>
    </div>
  )
}

function WorkspaceTab({ value, icon: Icon, label }: { value: string; icon: typeof FileText; label: string }) {
  return (
    <TabsTrigger value={value} className="gap-2 rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
      <Icon className="size-4" />
      {label}
    </TabsTrigger>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 border-b pb-4 text-lg font-extrabold text-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-extrabold uppercase text-slate-500">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className={ADMIN_INPUT_CLASS} />
    </label>
  )
}

function SelectWithOther({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  compact?: boolean
}) {
  const isPreset = !value || options.includes(value)
  const selectValue = isPreset ? value : '__other__'

  return (
    <label className={`block ${compact ? 'space-y-0' : 'space-y-1'}`}>
      {!compact && <span className="text-xs font-extrabold uppercase text-slate-500">{label}</span>}
      <select
        value={selectValue}
        onChange={(event) => onChange(event.target.value === '__other__' ? 'Autre' : event.target.value)}
        className={ADMIN_SELECT_CLASS}
        aria-label={compact ? label : undefined}
      >
        <option value="">Sélectionner</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value="__other__">Autre</option>
      </select>
      {(!isPreset || selectValue === '__other__') && (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`${label} personnalisé`}
          className={cn('mt-2', ADMIN_INPUT_CLASS)}
        />
      )}
    </label>
  )
}

function SelectValue({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={ADMIN_SELECT_CLASS}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function DocumentRow({
  document,
  uploadingId,
  onUpdate,
  onDelete,
  onUpload,
}: {
  document: ClientDocument
  uploadingId: string | null
  onUpdate: (documentId: string, patch: Record<string, unknown>) => void
  onDelete: (documentId: string) => void
  onUpload: (document: ClientDocument | null, file: File | null) => void
}) {
  return (
    <div className="grid gap-3 rounded-2xl border bg-background p-4 lg:grid-cols-[1fr_180px_160px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="font-semibold text-foreground">{document.label}</div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{document.category}</span>
          {document.file_name && <span>{document.file_name}</span>}
          {document.validated_at && <span>Validé le {formatDate(document.validated_at)}</span>}
        </div>
        {document.status === 'rejected' && document.notes && (
          <p className="mt-2 text-xs font-semibold text-red-600">Motif : {document.notes}</p>
        )}
      </div>
      <SelectWithOther label="Catégorie" value={document.category} options={DOCUMENT_CATEGORY_OPTIONS} onChange={(value) => onUpdate(document.id, { category: value })} compact />
      <SelectValue
        value={document.status}
        options={Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        onChange={(value) => onUpdate(document.id, { status: value })}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {document.signed_url && (
          <Button asChild variant="outline" size="sm" className={ADMIN_SECONDARY_ACTION_CLASS}><a href={document.signed_url} target="_blank" rel="noreferrer"><Download className="mr-1 size-4" /> Ouvrir</a></Button>
        )}
        <label className={cn('inline-flex cursor-pointer items-center border text-sm font-semibold hover:bg-accent', ADMIN_SECONDARY_ACTION_CLASS)}>
          {uploadingId === document.id ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Upload className="mr-1 size-4" />}
          Upload
          <input type="file" className="sr-only" onChange={(event) => onUpload(document, event.target.files?.[0] ?? null)} />
        </label>
        <Button variant="outline" size="sm" className={ADMIN_SECONDARY_ACTION_CLASS} onClick={() => onUpdate(document.id, { status: 'validated' })}><CheckCircle2 className="mr-1 size-4" /> Valider</Button>
        <Button variant="ghost" size="icon-sm" className={ADMIN_ICON_ACTION_CLASS} onClick={() => onDelete(document.id)}><Trash2 className="size-4" /></Button>
      </div>
      {document.status === 'rejected' && (
        <div className="lg:col-span-4">
          <SelectWithOther label="Motif de rejet" value={document.notes ?? ''} options={REJECTION_REASON_OPTIONS} onChange={(value) => onUpdate(document.id, { notes: value })} />
        </div>
      )}
    </div>
  )
}

function EventEditor({
  title,
  type,
  newEvent,
  setNewEvent,
  onAdd,
}: {
  title: string
  type: string
  newEvent: ReturnType<typeof emptyEventDraft>
  setNewEvent: (event: ReturnType<typeof emptyEventDraft>) => void
  onAdd: (type: string) => void
}) {
  const statusOptions = type === 'visit' ? VISIT_STATUS_OPTIONS : type === 'offer' ? OFFER_STATUS_OPTIONS : EVENT_STATUS_OPTIONS
  const currentStatus = statusOptions.some((option) => option.value === newEvent.status) ? newEvent.status : statusOptions[0]?.value ?? newEvent.status
  return (
    <Section title={title} icon={CalendarDays}>
      <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
        <Input value={newEvent.title} onChange={(event) => setNewEvent({ ...newEvent, title: event.target.value })} placeholder="Titre" className={ADMIN_INPUT_CLASS} />
        <Input type="date" value={newEvent.event_date} onChange={(event) => setNewEvent({ ...newEvent, event_date: event.target.value })} className={ADMIN_INPUT_CLASS} />
        <SelectValue value={currentStatus} options={statusOptions} onChange={(value) => setNewEvent({ ...newEvent, status: value })} />
      </div>
      {type === 'milestone' && (
        <div className="mt-3">
          <SelectWithOther label="Type d'étape" value={newEvent.milestone_kind} options={MILESTONE_TYPE_OPTIONS} onChange={(value) => setNewEvent({ ...newEvent, milestone_kind: value })} />
        </div>
      )}
      <Textarea className={cn('mt-3', ADMIN_TEXTAREA_CLASS)} value={newEvent.description} onChange={(event) => setNewEvent({ ...newEvent, description: event.target.value })} placeholder="Description visible client" rows={3} />
      {type !== 'milestone' && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Acheteur / visiteur" value={newEvent.buyer_name} onChange={(value) => setNewEvent({ ...newEvent, buyer_name: value })} />
          {type === 'offer' && <Field label="Montant offre" value={newEvent.amount} onChange={(value) => setNewEvent({ ...newEvent, amount: value })} />}
          {type === 'visit' && <SelectWithOther label="Intérêt visite" value={newEvent.rating} options={['1', '2', '3', '4', '5']} onChange={(value) => setNewEvent({ ...newEvent, rating: value })} />}
        </div>
      )}
      {type === 'visit' && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <SelectWithOther label="Profil acquéreur" value={newEvent.buyer_profile} options={BUYER_PROFILE_OPTIONS} onChange={(value) => setNewEvent({ ...newEvent, buyer_profile: value })} />
          <SelectWithOther label="Financement" value={newEvent.financing} options={FINANCING_OPTIONS} onChange={(value) => setNewEvent({ ...newEvent, financing: value })} />
        </div>
      )}
      {type === 'offer' && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <SelectWithOther label="Condition principale" value={newEvent.offer_condition} options={OFFER_CONDITION_OPTIONS} onChange={(value) => setNewEvent({ ...newEvent, offer_condition: value })} />
          <SelectWithOther label="Solidité" value={newEvent.offer_strength} options={OFFER_STRENGTH_OPTIONS} onChange={(value) => setNewEvent({ ...newEvent, offer_strength: value })} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="block w-full max-w-xs space-y-1">
          <span className="text-xs font-extrabold uppercase text-slate-500">Visibilité</span>
          <select
            value={newEvent.visible_to_client ? 'client' : 'internal'}
            onChange={(event) => setNewEvent({ ...newEvent, visible_to_client: event.target.value === 'client' })}
            className={ADMIN_SELECT_CLASS}
          >
            <option value="client">Visible client</option>
            <option value="internal">Interne uniquement</option>
          </select>
        </label>
        <Button onClick={() => onAdd(type)} className={ADMIN_PRIMARY_ACTION_CLASS}><Plus className="mr-2 size-4" /> Ajouter</Button>
      </div>
    </Section>
  )
}

function EventList({
  title,
  events,
  onUpdate,
  onDelete,
}: {
  title: string
  events: ClientEvent[]
  onUpdate: (eventId: string, patch: Record<string, unknown>) => void
  onDelete: (eventId: string) => void
}) {
  return (
    <Section title={title} icon={BookOpen}>
      <div className="space-y-3">
        {events.length === 0 && <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Aucune donnée pour le moment.</p>}
        {events.map((event) => (
          <div key={event.id} className="grid gap-3 rounded-2xl border bg-background p-4 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{event.title}</span>
                <Badge variant="outline">{event.status}</Badge>
                <Badge variant="outline">{event.type}</Badge>
                {!event.visible_to_client && <Badge variant="outline">Interne</Badge>}
              </div>
              {event.description && <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>}
              {event.event_date && <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.event_date)}</p>}
              {summarizeEventPayload(event.payload) && <p className="mt-1 text-xs font-semibold text-foreground">{summarizeEventPayload(event.payload)}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" className={ADMIN_SECONDARY_ACTION_CLASS} onClick={() => onUpdate(event.id, { status: event.status === 'done' ? 'todo' : 'done' })}>
                {event.status === 'done' ? 'À faire' : 'Terminer'}
              </Button>
              <Button variant="ghost" size="icon-sm" className={ADMIN_ICON_ACTION_CLASS} onClick={() => onDelete(event.id)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function emptyEventDraft() {
  return {
    title: '',
    description: '',
    status: 'todo',
    event_date: '',
    visible_to_client: true,
    milestone_kind: '',
    buyer_name: '',
    amount: '',
    rating: '',
    buyer_profile: '',
    financing: '',
    offer_condition: '',
    offer_strength: '',
  }
}

function normalizeEventPayload(event: ReturnType<typeof emptyEventDraft>) {
  return {
    milestone_kind: event.milestone_kind.trim() || null,
    buyer_name: event.buyer_name.trim() || null,
    amount: nullableNumber(event.amount),
    rating: nullableNumber(event.rating),
    buyer_profile: event.buyer_profile.trim() || null,
    financing: event.financing.trim() || null,
    offer_condition: event.offer_condition.trim() || null,
    offer_strength: event.offer_strength.trim() || null,
  }
}

function normalizedEventStatus(type: string, status: string) {
  const options = type === 'visit' ? VISIT_STATUS_OPTIONS : type === 'offer' ? OFFER_STATUS_OPTIONS : EVENT_STATUS_OPTIONS
  return options.some((option) => option.value === status) ? status : options[0]?.value ?? status
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function nullableNumber(value: string) {
  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null
}

function stringify(value: unknown) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function summarizeEventPayload(value: Json) {
  const payload = asRecord(value)
  const buyer = stringify(payload.buyer_name)
  const amount = nullableNumber(stringify(payload.amount))
  const rating = nullableNumber(stringify(payload.rating))
  const milestone = stringify(payload.milestone_kind)
  const profile = stringify(payload.buyer_profile)
  const financing = stringify(payload.financing)
  const condition = stringify(payload.offer_condition)
  const strength = stringify(payload.offer_strength)
  return [
    milestone || null,
    buyer || null,
    amount ? `${amount.toLocaleString('fr-FR')} €` : null,
    rating ? `Intérêt ${rating}/5` : null,
    profile || null,
    financing || null,
    condition || null,
    strength || null,
  ].filter(Boolean).join(' · ')
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

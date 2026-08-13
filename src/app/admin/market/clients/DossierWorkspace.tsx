'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileClock,
  FileText,
  FileUp,
  FileX,
  FolderUp,
  Footprints,
  Handshake,
  Key,
  Loader2,
  Pencil,
  PenTool,
  Plus,
  Rocket,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { AudienceTrackingPanel } from '../opportunities/[id]/AudienceTrackingPanel'
import { PersonalizationCard } from './PersonalizationCard'
import { MilestoneStepper } from '@/components/pro'
import type { Json } from '@/types/supabase'

/**
 * Espace de suivi client post-estimation/post-mandat (Documents / Plan de vente /
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
const DOCUMENT_CATEGORY_OPTIONS = ['Propriété', 'Identité', 'Diagnostics', 'Fiscalité', 'Urbanisme', 'Copropriété', 'Travaux', 'Assainissement', 'Mandat', 'Autre']
const REJECTION_REASON_OPTIONS = ['Illisible', 'Document incomplet', 'Document expiré', 'Mauvais document', 'Informations incohérentes', 'À rescanner']

const ADMIN_INPUT_CLASS = 'h-10 rounded-xl px-3 text-sm'
const ADMIN_SELECT_CLASS = 'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm'
const ADMIN_TEXTAREA_CLASS = 'rounded-xl px-3 py-2 text-sm'
const ADMIN_PRIMARY_ACTION_CLASS = 'h-10 rounded-xl px-4'
const ADMIN_SECONDARY_ACTION_CLASS = 'h-9 rounded-xl px-3'
const ADMIN_ICON_ACTION_CLASS = 'size-9 rounded-xl'

export function DossierWorkspace({ dossierId, opportunityId }: { dossierId: string; opportunityId?: string }) {
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [newDoc, setNewDoc] = useState({ label: '', category: 'Autre' })
  const [newEvent, setNewEvent] = useState(emptyEventDraft())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [clientAccessSent, setClientAccessSent] = useState(false)
  const [estimationPublished, setEstimationPublished] = useState(false)
  const [publishingEstimation, setPublishingEstimation] = useState(false)
  const [openingClientLink, setOpeningClientLink] = useState(false)
  const [copyingClientLink, setCopyingClientLink] = useState(false)
  const [tab, setTab] = useState('documents')
  const [mandateSignedAt, setMandateSignedAt] = useState<string | null>(null)
  const [savingMandateDate, setSavingMandateDate] = useState(false)
  const [opportunityData, setOpportunityData] = useState<any>(null)
  const [showDocForm, setShowDocForm] = useState(false)

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/market/clients/${dossierId}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      toast.error(json.error ?? 'Chargement du suivi impossible')
      return
    }
    setDocuments(json.data.documents ?? [])
    setEvents(json.data.events ?? [])
    setEstimationPublished(Boolean(json.data.dossier?.professional_opinion?.client_portal_published))
    setMandateSignedAt(json.data.dossier?.mandate_signed_at ?? null)
    setOpportunityData(json.data.opportunity ?? null)
  }, [dossierId])

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [fetchDetail])

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submittingDoc, setSubmittingDoc] = useState(false)

  async function handleAddDocument() {
    if (!newDoc.label.trim() && !selectedFile) {
      toast.error('Veuillez indiquer le nom de la pièce ou joindre un fichier')
      return
    }

    const label = newDoc.label.trim() || selectedFile?.name || 'Document'
    setSubmittingDoc(true)
    try {
      if (selectedFile) {
        const body = new FormData()
        body.set('label', label)
        body.set('category', newDoc.category)
        body.set('file', selectedFile)
        const res = await fetch(`/api/market/clients/${dossierId}/documents/upload`, { method: 'POST', body })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Upload impossible')
        toast.success('Document et fichier ajoutés')
      } else {
        const res = await fetch(`/api/market/clients/${dossierId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, category: newDoc.category }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Ajout impossible')
        toast.success('Demande de pièce ajoutée pour le vendeur')
      }
      setNewDoc({ label: '', category: 'Autre' })
      setSelectedFile(null)
      await fetchDetail()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ajout impossible')
    } finally {
      setSubmittingDoc(false)
    }
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

  const [submittingEvent, setSubmittingEvent] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

  function startEditingEvent(event: ClientEvent) {
    const payload = asRecord(event.payload)
    setEditingEventId(event.id)
    setNewEvent({
      title: event.title,
      description: event.description ?? '',
      status: event.status,
      event_date: event.event_date ?? '',
      visible_to_client: event.visible_to_client,
      milestone_kind: stringify(payload.milestone_kind) || event.title,
      buyer_name: stringify(payload.buyer_name) || event.title,
      amount: stringify(payload.amount),
      rating: stringify(payload.rating),
      buyer_profile: stringify(payload.buyer_profile),
      financing: stringify(payload.financing),
      offer_condition: stringify(payload.offer_condition),
      offer_strength: stringify(payload.offer_strength),
    })
  }

  function cancelEditingEvent() {
    setEditingEventId(null)
    setNewEvent(emptyEventDraft())
  }

  async function addEvent(type: string) {
    const effectiveTitle = newEvent.title.trim() || newEvent.buyer_name.trim() || (type === 'visit' ? 'Visite' : type === 'offer' ? 'Offre d’achat' : '')
    if (!effectiveTitle) {
      toast.error('Veuillez indiquer le nom des visiteurs ou un intitulé')
      return
    }

    setSubmittingEvent(true)
    try {
      const isEditing = Boolean(editingEventId)
      const res = await fetch(`/api/market/clients/${dossierId}/events`, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEditing ? { id: editingEventId } : {}),
          title: effectiveTitle,
          description: newEvent.description,
          type,
          status: normalizedEventStatus(type, newEvent.status),
          event_date: newEvent.event_date || new Date().toISOString().split('T')[0],
          visible_to_client: newEvent.visible_to_client,
          payload: normalizeEventPayload({ ...newEvent, title: effectiveTitle, buyer_name: newEvent.buyer_name || effectiveTitle }),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? (isEditing ? 'Modification impossible' : 'Ajout impossible'))
      setEditingEventId(null)
      setNewEvent(emptyEventDraft())
      await fetchDetail()
      toast.success(
        isEditing
          ? (type === 'visit' ? 'Visite modifiée' : type === 'offer' ? 'Offre modifiée' : 'Étape modifiée')
          : (type === 'visit' ? 'Visite enregistrée' : type === 'offer' ? 'Offre ajoutée' : 'Étape ajoutée')
      )
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action impossible')
      return false
    } finally {
      setSubmittingEvent(false)
    }
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
      window.open(href, '_blank', 'noopener,noreferrer')
      toast.success('Aperçu client ouvert')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ouverture impossible')
    } finally {
      setOpeningClientLink(false)
    }
  }

  async function copyClientPortalUrl() {
    setCopyingClientLink(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/client-link`)
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.client_url) throw new Error(json.error ?? 'Lien client impossible')
      await navigator.clipboard?.writeText(json.data.client_url)
      toast.success('Lien client copié')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lien client impossible')
    } finally {
      setCopyingClientLink(false)
    }
  }

  async function publishEstimation() {
    setPublishingEstimation(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/publish-estimation`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Publication impossible")
      setEstimationPublished(true)
      toast.success("Estimation publiée dans l’espace client")
      await fetchDetail()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publication impossible")
    } finally {
      setPublishingEstimation(false)
    }
  }

  async function updateMandateSignedAt(date: string | null) {
    setSavingMandateDate(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/mandate-signed-at`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate_signed_at: date }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Mise à jour impossible")
      setMandateSignedAt(date)
      toast.success("Date de signature mise à jour")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible")
    } finally {
      setSavingMandateDate(false)
    }
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">Chargement du suivi client...</p>

  const planEvents = events.filter((event) => !['visit', 'offer'].includes(event.type))
  const visitEvents = events.filter((event) => event.type === 'visit')
  const offerEvents = events.filter((event) => event.type === 'offer')
  const missingDocuments = documents.filter((document) => ['missing', 'requested', 'rejected'].includes(document.status)).length
  const validatedDocuments = documents.filter((document) => document.status === 'validated').length
  const visibleEvents = events.filter((event) => event.visible_to_client).length

  const isEstimationDone = Boolean(
    estimationPublished ||
    opportunityData?.estimated_price_min ||
    opportunityData?.estimated_price_max ||
    (opportunityData?.professional_opinion && Object.keys(opportunityData.professional_opinion).length > 0)
  )

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      {/* Header section: Suivi Client */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-foreground">Suivi client</h2>
            {isEstimationDone ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold gap-1 px-2.5 py-0.5 text-xs">
                <CheckCircle2 className="size-3.5 text-emerald-600" /> Estimation réalisée
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold gap-1 px-2.5 py-0.5 text-xs">
                <Clock className="size-3.5 text-amber-600" /> Estimation en attente
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Espace dédié au vendeur pour consulter l’estimation, le plan de vente et suivre l’avancement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="default" size="sm" onClick={copyClientPortalUrl} disabled={copyingClientLink} className="h-9 font-semibold rounded-xl">
            {copyingClientLink ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Copy className="mr-1.5 size-4" />}
            Copier le lien client
          </Button>
          <Button variant="outline" size="sm" onClick={openClientPortalLink} disabled={openingClientLink} className="h-9 font-semibold rounded-xl">
            {openingClientLink ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <ExternalLink className="mr-1.5 size-4" />}
            Accéder à l’espace client
          </Button>
        </div>
      </section>

      {/* Menubar d'onglets secondaires */}
      <TabsList variant="pill" className="w-full justify-start border bg-card p-1.5 shadow-xs rounded-2xl gap-1 overflow-x-auto">
        <WorkspaceTab value="documents" icon={FileText} label="Documents" count={`${validatedDocuments}/${documents.length}`} />
        <WorkspaceTab value="plan" icon={BookOpen} label="Plan de vente" count={planEvents.length} />
        <WorkspaceTab value="visites" icon={CalendarDays} label="Visites" count={visitEvents.length} />
        <WorkspaceTab value="offres" icon={CheckCircle2} label="Offres" count={offerEvents.length} />
        {opportunityId && <WorkspaceTab value="diffusion" icon={BarChart3} label="Diffusion & statistiques" />}
      </TabsList>

      <TabsContent value="documents" className="space-y-6">
        <Section
          title="Documents du dossier"
          subtitle="Centralisez les pièces justificatives et les demandes de documents envoyées au vendeur."
          icon={FileText}
          action={
            <Button
              size="sm"
              onClick={() => setShowDocForm(!showDocForm)}
              className="h-10 font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs px-4 text-xs shrink-0"
            >
              {showDocForm ? <X className="mr-1.5 size-4" /> : <Plus className="mr-1.5 size-4" />}
              {showDocForm ? 'Fermer' : 'Demander une pièce'}
            </Button>
          }
        >
          {/* Top Form: Add document or upload file */}
          {showDocForm && (
            <div className="rounded-2xl border border-primary/30 bg-muted/40 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Ajouter une pièce ou une demande
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Sans fichier = demande envoyée au vendeur sur son portail client
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                {/* Libellé */}
                <div className="lg:col-span-4">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Nom / Libellé de la pièce
                  </label>
                  <Input
                    value={newDoc.label}
                    onChange={(event) => setNewDoc({ ...newDoc, label: event.target.value })}
                    placeholder="Ex. Taxe foncière, Diagnostic DPE, Titre de propriété..."
                    className={ADMIN_INPUT_CLASS}
                  />
                </div>

                {/* Catégorie */}
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Catégorie
                  </label>
                  <SelectWithOther
                    label="Catégorie"
                    value={newDoc.category}
                    options={DOCUMENT_CATEGORY_OPTIONS}
                    onChange={(value) => setNewDoc({ ...newDoc, category: value })}
                    compact
                  />
                </div>

                {/* Fichier joint */}
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Fichier (optionnel)
                  </label>
                  {selectedFile ? (
                    <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-600">
                      <span className="truncate max-w-[140px]">{selectedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="hover:text-emerald-800 p-0.5 rounded-md"
                        title="Retirer le fichier"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <UploadCloud className="size-4 shrink-0 text-primary" />
                      <span className="truncate">Joindre un fichier</span>
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>

                {/* Submit Button */}
                <div className="lg:col-span-2">
                  <Button
                    onClick={handleAddDocument}
                    disabled={submittingDoc}
                    className="w-full h-10 font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
                  >
                    {submittingDoc ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 size-4" />
                    )}
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Document list below */}
          <div className="mt-5 space-y-3">
            {documents.length > 0 ? (
              documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  uploadingId={uploadingId}
                  onUpdate={updateDocument}
                  onDelete={deleteDocument}
                  onUpload={uploadDocument}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-8 text-center bg-card/40 space-y-2">
                <FolderUp className="size-9 text-muted-foreground/50 mb-1" />
                <p className="text-sm font-bold text-foreground">Aucun document dans ce dossier</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Utilisez le formulaire ci-dessus pour demander une pièce au vendeur ou ajouter directement un document.
                </p>
              </div>
            )}
          </div>
        </Section>
      </TabsContent>

      <TabsContent value="plan" className="space-y-6">
        <UnifiedEventWorkspace
          title="Plan de vente"
          type="milestone"
          icon={BookOpen}
          events={planEvents}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          submitting={submittingEvent}
          editingEventId={editingEventId}
          onAdd={addEvent}
          onEdit={startEditingEvent}
          onCancelEdit={cancelEditingEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
        />
      </TabsContent>

      <TabsContent value="visites" className="space-y-6">
        <UnifiedEventWorkspace
          title="Visites et comptes-rendus"
          type="visit"
          icon={CalendarDays}
          events={visitEvents}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          submitting={submittingEvent}
          editingEventId={editingEventId}
          onAdd={addEvent}
          onEdit={startEditingEvent}
          onCancelEdit={cancelEditingEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
        />
      </TabsContent>

      <TabsContent value="offres" className="space-y-6">
        <UnifiedEventWorkspace
          title="Offres d'achat"
          type="offer"
          icon={CheckCircle2}
          events={offerEvents}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          submitting={submittingEvent}
          editingEventId={editingEventId}
          onAdd={addEvent}
          onEdit={startEditingEvent}
          onCancelEdit={cancelEditingEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
        />
      </TabsContent>
      {opportunityId && (
        <TabsContent value="diffusion" className="space-y-6">
          <AudienceTrackingPanel opportunityId={opportunityId} />
        </TabsContent>
      )}
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
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{helper}</p>
    </div>
  )
}

function WorkspaceTab({
  value,
  icon: Icon,
  label,
  count,
}: {
  value: string
  icon: typeof FileText
  label: string
  count?: string | number
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:text-foreground"
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
      {count !== undefined && (
        <span className="ml-1 rounded-full bg-muted-foreground/15 px-2 py-0.5 text-[10px] font-bold">
          {count}
        </span>
      )}
    </TabsTrigger>
  )
}

function Section({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string
  subtitle?: string
  icon: typeof FileText
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-2xs space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-extrabold uppercase text-slate-500">{label}</span>
      <Input type={type} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className={ADMIN_INPUT_CLASS} />
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
  const hasAutreInOptions = options.some((opt) => opt.toLowerCase() === 'autre')
  const baseOptions = hasAutreInOptions ? options.filter((opt) => opt.toLowerCase() !== 'autre') : options

  const isStandardPreset = !value || baseOptions.includes(value) || value === 'Autre'
  const selectValue = isStandardPreset ? (value || '') : '__custom__'

  return (
    <label className={`block ${compact ? 'space-y-0' : 'space-y-1'}`}>
      {!compact && <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>}
      <select
        value={selectValue}
        onChange={(event) => {
          const selected = event.target.value
          if (selected === '__custom__') {
            onChange('Autre')
          } else {
            onChange(selected)
          }
        }}
        className={ADMIN_SELECT_CLASS}
        aria-label={compact ? label : undefined}
      >
        <option value="">Sélectionner</option>
        {baseOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
        <option value="Autre">Autre</option>
      </select>
      {selectValue === '__custom__' && (
        <Input
          value={value === 'Autre' ? '' : value}
          onChange={(event) => onChange(event.target.value || 'Autre')}
          placeholder={`${label} personnalisé`}
          className={cn('mt-1.5', ADMIN_INPUT_CLASS)}
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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold gap-1.5 px-2.5 py-0.5 text-xs">
            <FileCheck className="size-3.5 text-emerald-600" /> Validé
          </Badge>
        )
      case 'uploaded':
        return (
          <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 font-semibold gap-1.5 px-2.5 py-0.5 text-xs">
            <UploadCloud className="size-3.5 text-sky-600" /> Reçu du client
          </Badge>
        )
      case 'rejected':
        return (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive font-semibold gap-1.5 px-2.5 py-0.5 text-xs">
            <FileX className="size-3.5 text-destructive" /> Rejeté
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold gap-1.5 px-2.5 py-0.5 text-xs">
            <FileClock className="size-3.5 text-amber-600" /> En attente vendeur
          </Badge>
        )
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-2xs transition-all hover:border-border/80 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[1fr_180px_160px_auto] lg:items-center lg:gap-4">
      {/* Left Col: Label, Status badge, File details */}
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm text-foreground">{document.label}</span>
          {getStatusBadge(document.status)}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-medium">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {document.category}
          </span>
          {document.file_name && (
            <span className="truncate max-w-[200px] text-foreground/80 font-medium">
              📎 {document.file_name}
            </span>
          )}
          {document.validated_at && (
            <span>Validé le {formatDate(document.validated_at)}</span>
          )}
        </div>
        {document.status === 'rejected' && document.notes && (
          <p className="mt-1 text-xs font-semibold text-destructive">Motif de rejet : {document.notes}</p>
        )}
      </div>

      {/* Category selector */}
      <SelectWithOther
        label="Catégorie"
        value={document.category}
        options={DOCUMENT_CATEGORY_OPTIONS}
        onChange={(value) => onUpdate(document.id, { category: value })}
        compact
      />

      {/* Status dropdown */}
      <SelectValue
        value={document.status}
        options={Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        onChange={(value) => onUpdate(document.id, { status: value })}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {document.signed_url && (
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg px-2.5">
            <a href={document.signed_url} target="_blank" rel="noreferrer">
              <Download className="mr-1 size-3.5" /> Ouvrir
            </a>
          </Button>
        )}
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors">
          {uploadingId === document.id ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1 size-3.5 text-muted-foreground" />
          )}
          <span className="ml-1">{document.file_name ? 'Remplacer' : 'Fichier'}</span>
          <input type="file" className="sr-only" onChange={(event) => onUpload(document, event.target.files?.[0] ?? null)} />
        </label>
        {document.status !== 'validated' && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold rounded-lg px-2.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => onUpdate(document.id, { status: 'validated' })}
          >
            <CheckCircle2 className="mr-1 size-3.5 text-emerald-600" /> Valider
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
          onClick={() => onDelete(document.id)}
          title="Supprimer la pièce"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {document.status === 'rejected' && (
        <div className="lg:col-span-4 pt-2 border-t border-border/40">
          <SelectWithOther label="Motif de rejet" value={document.notes ?? ''} options={REJECTION_REASON_OPTIONS} onChange={(value) => onUpdate(document.id, { notes: value })} />
        </div>
      )}
    </div>
  )
}

function getMilestoneIcon(title: string) {
  const t = title.toLowerCase()
  if (t.includes('estimation') || t.includes('avis')) return { icon: BarChart3, colorClass: 'text-purple-600 border-purple-500/30 bg-purple-500/10' }
  if (t.includes('mandat') || t.includes('signature')) return { icon: PenTool, colorClass: 'text-indigo-600 border-indigo-500/30 bg-indigo-500/10' }
  if (t.includes('photo') || t.includes('shooting')) return { icon: Camera, colorClass: 'text-pink-600 border-pink-500/30 bg-pink-500/10' }
  if (t.includes('virtuelle') || t.includes('3d')) return { icon: Eye, colorClass: 'text-cyan-600 border-cyan-500/30 bg-cyan-500/10' }
  if (t.includes('diffusion') || t.includes('annonce') || t.includes('mise en ligne')) return { icon: Rocket, colorClass: 'text-sky-600 border-sky-500/30 bg-sky-500/10' }
  if (t.includes('visite')) return { icon: Footprints, colorClass: 'text-amber-600 border-amber-500/30 bg-amber-500/10' }
  if (t.includes('offre')) return { icon: Handshake, colorClass: 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10' }
  if (t.includes('compromis') || t.includes('promesse')) return { icon: FileCheck, colorClass: 'text-teal-600 border-teal-500/30 bg-teal-500/10' }
  if (t.includes('acte') || t.includes('clé') || t.includes('cles') || t.includes('authentique')) return { icon: Key, colorClass: 'text-amber-500 border-amber-500/30 bg-amber-500/10' }
  return { icon: Sparkles, colorClass: 'text-primary border-primary/30 bg-primary/10' }
}

function EventPayloadDetails({ payload }: { payload: Json }) {
  const p = asRecord(payload)
  const rating = nullableNumber(stringify(p.rating))
  const profile = stringify(p.buyer_profile)
  const financing = stringify(p.financing)
  const amount = nullableNumber(stringify(p.amount))
  const condition = stringify(p.offer_condition)
  const strength = stringify(p.offer_strength)

  if (!rating && !profile && !financing && !amount && !condition && !strength) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {rating != null && rating >= 1 && (
        <div className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 shadow-2xs">
          <div className="flex items-center gap-0.5 text-amber-500">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={star <= rating ? "text-amber-500" : "text-amber-500/25"}>
                ★
              </span>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">({rating}/5)</span>
        </div>
      )}

      {profile && (
        <Badge variant="outline" className="border-border/60 bg-muted/60 text-foreground font-medium text-xs rounded-xl">
          👤 {profile}
        </Badge>
      )}

      {financing && (
        <Badge variant="outline" className="border-border/60 bg-muted/60 text-foreground font-medium text-xs rounded-xl">
          💳 {financing}
        </Badge>
      )}

      {amount != null && (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-bold text-xs rounded-xl">
          💰 {amount.toLocaleString('fr-FR')} €
        </Badge>
      )}

      {condition && (
        <Badge variant="outline" className="border-border/60 bg-muted/60 text-foreground font-medium text-xs rounded-xl">
          📜 {condition}
        </Badge>
      )}

      {strength && (
        <Badge variant="outline" className="border-border/60 bg-muted/60 text-foreground font-medium text-xs rounded-xl">
          💪 {strength}
        </Badge>
      )}
    </div>
  )
}

function UnifiedEventWorkspace({
  title,
  type,
  icon: Icon,
  events,
  newEvent,
  setNewEvent,
  submitting = false,
  editingEventId,
  onAdd,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  title: string
  type: string
  icon: typeof BookOpen
  events: ClientEvent[]
  newEvent: ReturnType<typeof emptyEventDraft>
  setNewEvent: (event: ReturnType<typeof emptyEventDraft>) => void
  submitting?: boolean
  editingEventId?: string | null
  onAdd: (type: string) => Promise<boolean | void> | boolean | void
  onEdit: (event: ClientEvent) => void
  onCancelEdit: () => void
  onUpdate: (eventId: string, patch: Record<string, unknown>) => void
  onDelete: (eventId: string) => void
}) {
  const isEditing = Boolean(editingEventId)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (editingEventId) {
      setIsOpen(true)
    }
  }, [editingEventId])

  const handleCancel = () => {

    onCancelEdit()
    setIsOpen(false)
  }

  const handleAdd = async () => {
    const success = await onAdd(type)
    if (success !== false) {
      setIsOpen(false)
    }
  }

  const statusOptions = type === 'visit' ? VISIT_STATUS_OPTIONS : type === 'offer' ? OFFER_STATUS_OPTIONS : EVENT_STATUS_OPTIONS
  const currentStatus = statusOptions.some((option) => option.value === newEvent.status) ? newEvent.status : statusOptions[0]?.value ?? newEvent.status

  const actionButtonText = type === 'milestone'
    ? 'Nouvelle étape'
    : type === 'visit'
    ? 'Nouvelle visite'
    : 'Nouvelle offre'

  const sectionSubtitle = type === 'milestone'
    ? 'Suivez l’avancement et l’historique des étapes du plan de vente'
    : type === 'visit'
    ? 'Consignez les visites d’acquéreurs, les retours et les impressions'
    : 'Gérez et suivez les propositions d’achat reçues'

  const actionButton = !isOpen ? (
    <Button
      size="sm"
      onClick={() => setIsOpen(true)}
      className="h-10 font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs px-4 text-xs shrink-0"
    >
      <Plus className="mr-1.5 size-4" />
      {actionButtonText}
    </Button>
  ) : null

  return (
    <Section title={title} subtitle={sectionSubtitle} icon={Icon} action={actionButton}>
      {/* Collapsible Form Card */}
      {isOpen && (
        <div className={cn(
          "rounded-2xl border p-5 space-y-4 shadow-2xs transition-all",
          isEditing ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30" : "border-border bg-muted/40"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {isEditing
                  ? (type === 'visit' ? 'Modifier la visite' : type === 'offer' ? 'Modifier l’offre' : 'Modifier l’étape')
                  : (type === 'milestone' ? 'Ajouter une étape au plan de vente' : type === 'visit' ? 'Ajouter ou planifier une visite' : 'Ajouter une offre d’achat')
                }
              </h3>
            </div>
            {isEditing && (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-semibold text-xs">
                Mode modification
              </Badge>
            )}
          </div>
            {/* Row 1: Title / Milestone dropdown, Date, Status */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
              {type === 'milestone' ? (
                <div className="lg:col-span-6">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Étape du plan de vente
                  </label>
                  <SelectWithOther
                    label="Étape"
                    value={newEvent.title}
                    options={MILESTONE_TYPE_OPTIONS}
                    onChange={(value) => setNewEvent({ ...newEvent, title: value, milestone_kind: value })}
                    compact
                  />
                </div>
              ) : (
                <div className="lg:col-span-6">
                  <Field
                    label={type === 'visit' ? 'Nom du visiteur / Titre' : 'Nom des acquéreurs'}
                    value={newEvent.title}
                    onChange={(value) => setNewEvent({ ...newEvent, title: value, buyer_name: value })}
                    placeholder={type === 'visit' ? 'Ex. M. et Mme Dupont' : 'Ex. Offre M. Martin'}
                  />
                </div>
              )}

              <div className="lg:col-span-3">
                <Field
                  label="Date"
                  type="date"
                  value={newEvent.event_date}
                  onChange={(value) => setNewEvent({ ...newEvent, event_date: value })}
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Statut
                </label>
                <SelectValue
                  value={currentStatus}
                  options={statusOptions}
                  onChange={(value) => setNewEvent({ ...newEvent, status: value })}
                />
              </div>
            </div>

            {/* Extra fields for visit or offer */}
            {type === 'visit' && (
              <div className="space-y-3 pt-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                  <div className="lg:col-span-4">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Niveau d’intérêt
                    </label>
                    <div className="flex items-center gap-1">
                      {['1', '2', '3', '4', '5'].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, rating: newEvent.rating === star ? '' : star })}
                          className={cn(
                            "h-10 flex-1 rounded-xl border text-xs font-bold transition-all",
                            newEvent.rating === star
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 shadow-2xs"
                              : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          ★ {star}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Profil acquéreur
                    </label>
                    <SelectWithOther
                      label="Profil acquéreur"
                      value={newEvent.buyer_profile}
                      options={BUYER_PROFILE_OPTIONS}
                      onChange={(value) => setNewEvent({ ...newEvent, buyer_profile: value })}
                      compact
                    />
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Financement
                    </label>
                    <SelectWithOther
                      label="Financement"
                      value={newEvent.financing}
                      options={FINANCING_OPTIONS}
                      onChange={(value) => setNewEvent({ ...newEvent, financing: value })}
                      compact
                    />
                  </div>
                </div>
              </div>
            )}

            {type === 'offer' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Montant de l’offre (€)" value={newEvent.amount} onChange={(value) => setNewEvent({ ...newEvent, amount: value })} />
                <SelectWithOther label="Condition principale" value={newEvent.offer_condition} options={OFFER_CONDITION_OPTIONS} onChange={(value) => setNewEvent({ ...newEvent, offer_condition: value })} />
                <SelectWithOther label="Solidité dossier" value={newEvent.offer_strength} options={OFFER_STRENGTH_OPTIONS} onChange={(value) => setNewEvent({ ...newEvent, offer_strength: value })} />
              </div>
            )}

            {/* Description textarea */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Compte-rendu / Description
              </label>
              <Textarea
                className={cn(ADMIN_TEXTAREA_CLASS, "bg-card border-input resize-none")}
                value={newEvent.description}
                onChange={(event) => setNewEvent({ ...newEvent, description: event.target.value })}
                placeholder="Description ou détails..."
                rows={2}
              />
            </div>

            {/* Bottom bar: Visibility toggle & Submit button */}
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-muted-foreground shrink-0">Visibilité :</label>
                <select
                  value={newEvent.visible_to_client ? 'client' : 'internal'}
                  onChange={(event) => setNewEvent({ ...newEvent, visible_to_client: event.target.value === 'client' })}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground"
                >
                  <option value="client">👁️ Visible sur le portail client</option>
                  <option value="internal">🔒 Interne uniquement (Privé agent)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-10 font-medium rounded-xl border-input hover:bg-accent px-4 text-xs"
                >
                  <X className="mr-1.5 size-4" />
                  Annuler
                </Button>

                <Button
                  onClick={handleAdd}
                  disabled={submitting}
                  className="h-10 font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs px-5 text-xs"
                >

                  {submitting ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : isEditing ? (
                    <CheckCircle2 className="mr-1.5 size-4" />
                  ) : (
                    <Plus className="mr-1.5 size-4" />
                  )}
                  {isEditing
                    ? 'Enregistrer les modifications'
                    : (type === 'milestone' ? 'Ajouter l’étape' : type === 'visit' ? 'Ajouter la visite' : 'Ajouter l’offre')
                  }
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Progress Bar for Plan de vente */}
        {type === 'milestone' ? (
          events.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-8 text-center bg-card/40 space-y-2">
              <Icon className="size-9 text-muted-foreground/50 mb-1" />
              <p className="text-sm font-bold text-foreground">Aucune étape pour le moment</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Utilisez le formulaire ci-dessus pour ajouter des jalons au plan de vente.
              </p>
            </div>
          ) : (
            <MilestoneStepper
              items={events}
              editingId={editingEventId}
              onUpdateStatus={(id, status) => onUpdate(id, { status })}
              onEdit={(item) => {
                const ev = events.find((e) => e.id === item.id)
                if (ev) onEdit(ev)
              }}
              onDelete={onDelete}
              formatDate={formatDate}
            />
          )
        ) : (
          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-8 text-center bg-card/40 space-y-2">
                <Icon className="size-9 text-muted-foreground/50 mb-1" />
                <p className="text-sm font-bold text-foreground">Aucune donnée pour le moment</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Utilisez le formulaire ci-dessus pour ajouter des éléments à cette section.
                </p>
              </div>
            ) : (
          events.map((event) => {
            const isDone = event.status === 'done' || event.status === 'accepted'
            const isBeingEdited = editingEventId === event.id
            return (
              <div
                key={event.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-2xs transition-all hover:border-border/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                  isBeingEdited && "ring-2 ring-primary/40 border-primary bg-primary/5"
                )}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{event.title}</span>
                    <Badge variant="outline" className={isDone ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold" : "border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold"}>
                      {isDone ? 'Terminé' : event.status}
                    </Badge>
                    {event.visible_to_client ? (
                      <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 font-semibold">
                        👁️ Visible client
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground font-semibold">
                        🔒 Interne
                      </Badge>
                    )}
                  </div>

                  {event.description && <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>}

                  <EventPayloadDetails payload={event.payload} />

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-medium pt-0.5">
                    {event.event_date && (
                      <span>📅 {formatDate(event.event_date)}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs font-semibold rounded-lg px-3",
                      isDone ? "text-muted-foreground" : "text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    )}
                    onClick={() => onUpdate(event.id, { status: isDone ? 'todo' : 'done' })}
                  >
                    <CheckCircle2 className="mr-1.5 size-3.5" />
                    {isDone ? 'Marquer à faire' : 'Terminer'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg",
                      isBeingEdited && "bg-primary/10 text-primary"
                    )}
                    onClick={() => onEdit(event)}
                    title="Modifier"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                    onClick={() => onDelete(event.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    )}
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

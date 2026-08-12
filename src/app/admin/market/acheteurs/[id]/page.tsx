'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Edit,
  FileCheck,
  FileText,
  FileUp,
  FolderOpen,
  History,
  Home,
  LayoutDashboard,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Save,
  Search,
  StickyNote,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  PageLayout,
  DeadlineCalendar,
  ProjectContactDialog,
  type DeadlineItem,
} from '@/components/pro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { buildProjectTitle } from '@/lib/project-stages'
import communesData from '@/data/communes.json'

type CommuneEntry = {
  name: string
  postalCode: string
  department: string
  region: string
}

const COMMUNES: CommuneEntry[] = (communesData as CommuneEntry[]).sort((a, b) =>
  a.name.localeCompare(b.name, 'fr')
)

const BUYER_STAGES = [
  'Nouveau contact',
  'Recherche qualifiée',
  'Matching à faire',
  'Biens proposés',
  'Visites',
  'Offre en cours',
  'Mandat de recherche signé',
  'Achat conclu',
  'Pause / Perdu',
]

const PROPERTY_TYPES = [
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'autre', label: 'Autre' },
]

const STANDARD_DOCUMENTS = [
  { value: "Pièce d'identité (CNI / Passeport)", category: 'Identité' },
  { value: "Justificatif de domicile (< 3 mois)", category: 'Identité' },
  { value: 'Attestation de financement / Accord bancaire', category: 'Financement' },
  { value: "Attestation d'apport personnel", category: 'Financement' },
  { value: '3 derniers bulletins de salaire', category: 'Revenus' },
  { value: 'Dernier avis d’imposition', category: 'Revenus' },
  { value: 'Compromis / Offre d’achat signée', category: 'Contrat' },
  { value: 'Autre justificatif (à préciser)', category: 'Autre' },
]

const EVENT_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
  note: { label: 'Note', icon: StickyNote, className: 'border-primary/30 bg-primary/10 text-primary' },
  task: { label: 'Tâche', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  call: { label: 'Appel', icon: Phone, className: 'border-sky-200 bg-sky-50 text-sky-700' },
  meeting: { label: 'RDV', icon: Calendar, className: 'border-amber-200 bg-amber-50 text-amber-700' },
}

type ActivityType = 'note' | 'task' | 'call' | 'meeting'

type EventDraft = {
  id?: string
  type: ActivityType
  title: string
  content: string
  due_at: string
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price)
}

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function authorLabel(createdBy: string | null | undefined): string | null {
  if (!createdBy) return null
  if (createdBy === 'admin' || createdBy === 'telegram') return 'Alexandre'
  if (createdBy.startsWith('assistant')) return 'Assistant IA'
  return createdBy
}

function getDocStatusBadge(status: string) {
  switch (status) {
    case 'validated':
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">✓ Validé</Badge>
    case 'rejected':
      return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">✕ Refusé</Badge>
    case 'requested':
    case 'uploaded':
    default:
      return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">⏳ Demandé</Badge>
  }
}

export default function BuyerProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const idParam = typeof params?.id === 'string' ? params.id : ''

  const [loading, setLoading] = useState(true)
  const [savingCriteria, setSavingCriteria] = useState(false)
  const [savingStage, setSavingStage] = useState(false)
  const [savingProperty, setSavingProperty] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  const [buyer, setBuyer] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [property, setProperty] = useState<any>(null)
  const [clientDossier, setClientDossier] = useState<any>(null)

  // Buyer requested documents state & form
  const [requestedDocuments, setRequestedDocuments] = useState<any[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [selectedDocPreset, setSelectedDocPreset] = useState("Pièce d'identité (CNI / Passeport)")
  const [customDocLabel, setCustomDocLabel] = useState('')
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null)
  const [docInitialStatus, setDocInitialStatus] = useState('validated')
  const [submittingDoc, setSubmittingDoc] = useState(false)

  // Property search for linking
  const [propertySearch, setPropertySearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchingProperties, setSearchingProperties] = useState(false)
  const [showPropertySearch, setShowPropertySearch] = useState(false)

  // Activity filter & modal state (Identique Fiche Projet Vente)
  const [activityFilter, setActivityFilter] = useState<'all' | ActivityType>('all')
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [eventDraft, setEventDraft] = useState<EventDraft>({
    type: 'note',
    title: '',
    content: '',
    due_at: '',
  })
  const [savingEvent, setSavingEvent] = useState(false)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)

  // Criteria form state
  const [form, setForm] = useState({
    type_bien: '',
    communes: [] as string[],
    budget_max: '',
    surface_min: '',
    pieces_min: '',
    criteres: [] as string[],
    next_action: '',
    due_date: '',
  })

  const [communeSearch, setCommuneSearch] = useState('')

  const loadProject = useCallback(async () => {
    if (!idParam) return
    try {
      const res = await fetch(`/api/market/buyers/${idParam}`)
      if (!res.ok) {
        toast.error('Projet d’achat non trouvé')
        router.push('/admin/market/opportunities?tab=acquereurs')
        return
      }

      const data = await res.json()
      const b = data.buyer
      setBuyer(b)
      setContacts(data.contacts ?? b.project_contacts ?? [])
      setEvents(data.events ?? [])
      setProperty(data.property ?? null)
      setClientDossier(data.client_dossier ?? null)

      setForm({
        type_bien: b.type_bien || '',
        communes: b.communes || [],
        budget_max: b.budget_max?.toString() || '',
        surface_min: b.surface_min?.toString() || '',
        pieces_min: b.pieces_min?.toString() || '',
        criteres: b.criteres || [],
        next_action: b.next_action || '',
        due_date: b.due_date || '',
      })
    } catch (e) {
      console.error('Erreur chargement projet d’achat:', e)
      toast.error('Erreur lors du chargement du projet')
    } finally {
      setLoading(false)
    }
  }, [idParam, router])

  const loadBuyerDocuments = useCallback(async () => {
    if (!idParam) return
    setLoadingDocuments(true)
    try {
      const res = await fetch(`/api/market/buyers/${idParam}/documents`)
      if (res.ok) {
        const data = await res.json()
        setRequestedDocuments(data.documents || [])
      }
    } catch (e) {
      console.error('Erreur chargement documents acquéreur:', e)
    } finally {
      setLoadingDocuments(false)
    }
  }, [idParam])

  useEffect(() => {
    void loadProject()
    void loadBuyerDocuments()
  }, [loadProject, loadBuyerDocuments])

  // Submit Document Form (Selection Liste Déroulante + File Upload + Validation)
  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idParam) return

    const isCustom = selectedDocPreset === 'Autre justificatif (à préciser)'
    const finalLabel = isCustom ? customDocLabel.trim() : selectedDocPreset

    if (!finalLabel) {
      toast.error('Veuillez sélectionner ou préciser un justificatif')
      return
    }

    const presetMatch = STANDARD_DOCUMENTS.find((d) => d.value === selectedDocPreset)
    const category = presetMatch?.category || 'Autre'

    setSubmittingDoc(true)
    try {
      const formData = new FormData()
      formData.append('label', finalLabel)
      formData.append('category', category)
      formData.append('status', docInitialStatus)

      if (selectedDocFile) {
        formData.append('file', selectedDocFile)
      }

      const res = await fetch(`/api/market/buyers/${idParam}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de l’enregistrement')
      }

      const data = await res.json()
      setRequestedDocuments(data.documents || [])
      toast.success(`Justificatif enregistré : ${finalLabel}`)

      // Reset form
      setCustomDocLabel('')
      setSelectedDocFile(null)
      setSelectedDocPreset("Pièce d'identité (CNI / Passeport)")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d’enregistrer le justificatif')
    } finally {
      setSubmittingDoc(false)
    }
  }

  // Upload file for existing document item
  const handleFileUploadForDoc = async (documentId: string, file: File) => {
    if (!idParam || !file) return
    try {
      const formData = new FormData()
      formData.append('document_id', documentId)
      formData.append('status', 'validated')
      formData.append('file', file)

      const res = await fetch(`/api/market/buyers/${idParam}/documents`, {
        method: 'PATCH',
        body: formData,
      })

      if (!res.ok) throw new Error('Erreur téléversement fichier')
      const data = await res.json()
      setRequestedDocuments(data.documents || [])
      toast.success(`Fichier ${file.name} ajouté`)
    } catch (e) {
      toast.error('Impossible d’ajouter le fichier')
    }
  }

  const handleUpdateDocStatus = async (documentId: string, status: string) => {
    if (!idParam) return
    try {
      const res = await fetch(`/api/market/buyers/${idParam}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId, status }),
      })
      if (!res.ok) throw new Error('Erreur mise à jour statut')
      const data = await res.json()
      setRequestedDocuments(data.documents || [])
      toast.success('Statut mis à jour')
    } catch (e) {
      toast.error('Impossible de modifier le statut')
    }
  }

  const handleDeleteDoc = async (documentId: string) => {
    if (!idParam) return
    try {
      const res = await fetch(`/api/market/buyers/${idParam}/documents?document_id=${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erreur suppression pièce')
      const data = await res.json()
      setRequestedDocuments(data.documents || [])
      toast.success('Demande de pièce retirée')
    } catch (e) {
      toast.error('Impossible de supprimer la pièce')
    }
  }

  // Property search handler
  const handleSearchProperties = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearchingProperties(true)
    try {
      const res = await fetch(`/api/market/properties?q=${encodeURIComponent(query)}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.properties || [])
      }
    } catch (e) {
      console.error('Erreur recherche biens:', e)
    } finally {
      setSearchingProperties(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (propertySearch) void handleSearchProperties(propertySearch)
      else setSearchResults([])
    }, 300)
    return () => clearTimeout(timer)
  }, [propertySearch, handleSearchProperties])

  // Link property to buyer project
  const handleAttachProperty = async (propertyId: string | null) => {
    if (!buyer?.id) return
    setSavingProperty(true)
    try {
      const res = await fetch(`/api/market/buyers/${buyer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_property_id: propertyId }),
      })
      if (!res.ok) throw new Error('Erreur rattachement bien')
      toast.success(propertyId ? 'Bien rattaché au projet d’achat' : 'Bien détaché du projet')
      setShowPropertySearch(false)
      setPropertySearch('')
      setSearchResults([])
      await loadProject()
    } catch (e) {
      toast.error('Impossible de modifier le bien rattaché')
    } finally {
      setSavingProperty(false)
    }
  }

  // Computed values
  const projectId = buyer?.id || idParam
  const currentStage = buyer?.stage || 'Nouveau contact'

  const formattedTitle = useMemo(() => {
    if (!buyer) return 'Chargement...'
    const contactNames = contacts.map((c) => c.last_name || c.name)
    const mainContactName = contacts[0]?.name || null
    return (
      buyer.display_title ||
      buildProjectTitle({
        contactLastNames: contactNames,
        contactName: mainContactName,
        propertyType: buyer.type_bien,
      }) ||
      'Recherche acquéreur'
    )
  }, [buyer, contacts])

  const sectorLabel = useMemo(() => {
    if (form.communes.length > 0) return form.communes.join(', ')
    return 'Sectorisation non définie'
  }, [form.communes])

  // Activity filter logic (Identique Projet Vente)
  const filteredActivityEvents = useMemo(() => {
    if (activityFilter === 'all') return events
    return events.filter((evt) => evt.type === activityFilter)
  }, [events, activityFilter])

  // Activity Dialog Handlers (Identique Projet Vente)
  const openEventModal = (type: ActivityType = 'note') => {
    setEventDraft({
      type,
      title: '',
      content: '',
      due_at: '',
    })
    setEventDialogOpen(true)
  }

  const editEvent = (evt: any) => {
    setEventDraft({
      id: evt.id,
      type: evt.type || 'note',
      title: evt.title || '',
      content: evt.content || '',
      due_at: evt.due_at ? evt.due_at.slice(0, 16) : '',
    })
    setEventDialogOpen(true)
  }

  const handleSaveEvent = async () => {
    if (!projectId) return
    setSavingEvent(true)
    try {
      const isEditing = Boolean(eventDraft.id)
      const url = isEditing
        ? `/api/market/opportunities/${projectId}/events/${eventDraft.id}`
        : `/api/market/opportunities/${projectId}/events`
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: eventDraft.type,
          title: eventDraft.title.trim() || undefined,
          content: eventDraft.content.trim() || undefined,
          due_at: eventDraft.due_at || null,
        }),
      })

      if (!res.ok) throw new Error('Erreur lors de l’enregistrement')
      toast.success(isEditing ? 'Activité modifiée' : 'Activité ajoutée')
      setEventDialogOpen(false)
      await loadProject()
    } catch (e) {
      toast.error('Impossible d’enregistrer l’activité')
    } finally {
      setSavingEvent(false)
    }
  }

  const handleDeleteEvent = async (evt: any) => {
    if (!projectId || !evt?.id) return
    setDeletingEventId(evt.id)
    try {
      const res = await fetch(`/api/market/opportunities/${projectId}/events/${evt.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erreur suppression')
      toast.success('Activité supprimée')
      await loadProject()
    } catch (e) {
      toast.error('Impossible de supprimer l’activité')
    } finally {
      setDeletingEventId(null)
    }
  }

  // Commune search filter
  const filteredCommunes = communeSearch
    ? COMMUNES.filter(
        (c) =>
          c.name.toLowerCase().includes(communeSearch.toLowerCase()) ||
          c.postalCode.includes(communeSearch)
      ).slice(0, 20)
    : []

  const addCommune = (commune: string) => {
    if (!form.communes.includes(commune)) {
      setForm((prev) => ({ ...prev, communes: [...prev.communes, commune] }))
    }
    setCommuneSearch('')
  }

  const removeCommune = (commune: string) => {
    setForm((prev) => ({ ...prev, communes: prev.communes.filter((c) => c !== commune) }))
  }

  // Stage update handler
  const handleUpdateStage = async (newStage: string) => {
    if (!projectId) return
    setSavingStage(true)
    try {
      const res = await fetch(`/api/market/buyers/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur changement étape')
      }
      toast.success(`Étape mise à jour : ${newStage}`)
      await loadProject()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur modification étape')
    } finally {
      setSavingStage(false)
    }
  }

  const handleSaveCriteria = async () => {
    if (!projectId) return
    setSavingCriteria(true)
    try {
      const res = await fetch(`/api/market/buyers/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_bien: form.type_bien || null,
          communes: form.communes.length > 0 ? form.communes : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          surface_min: form.surface_min ? Number(form.surface_min) : null,
          pieces_min: form.pieces_min ? Number(form.pieces_min) : null,
          criteres: form.criteres.length > 0 ? form.criteres : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur enregistrement')
      }

      toast.success('Critères d’achat enregistrés')
      await loadProject()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur sauvegarde')
    } finally {
      setSavingCriteria(false)
    }
  }

  const handleDuplicate = async () => {
    if (!buyer) return
    setDuplicating(true)
    try {
      const contactIds = contacts.map((c) => c.id).filter(Boolean)
      const payload = {
        type_bien: form.type_bien || null,
        communes: form.communes.length > 0 ? form.communes : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        surface_min: form.surface_min ? Number(form.surface_min) : null,
        pieces_min: form.pieces_min ? Number(form.pieces_min) : null,
        criteres: form.criteres.length > 0 ? form.criteres : null,
        stage: buyer.stage || 'Nouveau contact',
        contact_ids: contactIds,
      }

      const res = await fetch('/api/market/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la duplication')
      }

      const data = await res.json()
      toast.success('Projet d’achat dupliqué avec succès')
      const newId = data.buyer?.id || data.id
      if (newId) {
        router.push(`/admin/market/acheteurs/${newId}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de dupliquer ce projet d’achat')
    } finally {
      setDuplicating(false)
    }
  }

  const handleDelete = async () => {
    if (!projectId) return
    if (!confirm('Voulez-vous vraiment supprimer ce projet d’achat ? Cette action est irréversible.')) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/market/buyers/${projectId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur suppression')
      toast.success('Projet d’achat supprimé')
      router.push('/admin/market/opportunities?tab=acquereurs')
    } catch (e) {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  // Deadlines calculation
  const deadlines: DeadlineItem[] = useMemo(() => {
    const list: DeadlineItem[] = []
    if (form.next_action && form.due_date) {
      list.push({
        id: 'next_action',
        label: form.next_action,
        date: form.due_date,
        tone: 'default',
      })
    }
    for (const evt of (events ?? [])) {
      if (evt.type === 'task' && evt.due_at && !evt.completed_at) {
        const date = new Date(evt.due_at)
        const isOverdue = !Number.isNaN(date.getTime()) && date.getTime() < Date.now()
        list.push({
          id: evt.id,
          label: evt.title || evt.content || 'Tâche',
          date: evt.due_at,
          tone: isOverdue ? 'overdue' : 'default',
        })
      }
    }
    return list
  }, [form.next_action, form.due_date, events])

  if (loading) {
    return (
      <PageLayout width="wide">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Chargement du projet d'achat...
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout width="wide">
      <div className="space-y-6">
        {/* Navigation retour */}
        <div>
          <Link
            href="/admin/market/opportunities?tab=acquereurs"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Retour aux projets
          </Link>
        </div>

        {/* Top Banner Card (Fiche Projet Header identique au projet de vente) */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
          {/* Top Header Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                PROJET ACHAT
              </div>
              <div className="text-2xl font-bold text-foreground leading-tight">
                {formattedTitle}
              </div>
              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                {sectorLabel}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-9 rounded-lg" aria-label="Options du projet">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="cursor-pointer font-medium"
                  >
                    {duplicating ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Copy className="mr-2 size-4" />
                    )}
                    Dupliquer le projet
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-destructive font-medium cursor-pointer"
                  >
                    {deleting ? (
                      <Loader2 className="mr-2 size-4 animate-spin text-destructive" />
                    ) : (
                      <Trash2 className="mr-2 size-4 text-destructive" />
                    )}
                    Supprimer le projet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Separator />

          {/* Stage Navigation Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                ÉTAPE
              </span>
              <span className="text-lg font-bold text-primary">
                {currentStage}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={savingStage}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 h-9 text-sm shadow-xs"
                  >
                    {savingStage ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Modifier l’étape
                    <ChevronDown className="ml-2 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {BUYER_STAGES.map((stg) => (
                    <DropdownMenuItem
                      key={stg}
                      onClick={() => handleUpdateStage(stg)}
                      className={cn(
                        'cursor-pointer font-medium text-sm flex items-center justify-between py-2',
                        stg === currentStage && 'bg-primary/10 font-bold text-primary'
                      )}
                    >
                      <span>{stg}</span>
                      {stg === currentStage && <CheckCircle2 className="size-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabs Bar avec Onglet Documents */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList variant="pill" className="w-full justify-start">
            <TabsTrigger value="overview" className="flex-1">
              <LayoutDashboard className="mr-2 size-4" /> Vue d’ensemble
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">
              <FolderOpen className="mr-2 size-4" /> Documents ({requestedDocuments.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History className="mr-2 size-4" /> Historique
            </TabsTrigger>
          </TabsList>

          {/* ================= Onglet 1: Vue d'ensemble (Design Fiche Projet Vente Identique) ================= */}
          <TabsContent value="overview">
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column (5 cols) */}
              <div className="space-y-6 lg:col-span-5">
                {/* Card: CONTACTS RATTACHÉS */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      CONTACTS RATTACHÉS
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setContactDialogOpen(true)}
                      className="text-primary hover:text-primary/80 font-bold text-xs p-0 h-auto"
                    >
                      + Ajouter
                    </Button>
                  </div>

                  {contacts.length > 0 ? (
                    <div className="space-y-4">
                      {contacts.map((c, idx) => {
                        const name = c.name || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Contact'
                        const initials = [c.name?.[0], c.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'C'
                        const roleLabel = c.role ? c.role.toLowerCase() : 'acquéreur'

                        const colors = [
                          'bg-sky-600 text-primary-foreground',
                          'bg-primary/80 text-primary-foreground',
                          'bg-amber-700 text-primary-foreground',
                          'bg-emerald-700 text-primary-foreground',
                        ]
                        const avatarColor = colors[idx % colors.length]

                        const contactHref = c.id ? `/admin/market/contacts/${c.id}` : null

                        return (
                          <div key={c.id || idx} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              {contactHref ? (
                                <Link href={contactHref} className="shrink-0 group">
                                  <div className={cn('size-9 flex items-center justify-center rounded-full text-xs font-bold shadow-xs group-hover:opacity-85 transition-opacity', avatarColor)}>
                                    {initials}
                                  </div>
                                </Link>
                              ) : (
                                <div className={cn('size-9 shrink-0 flex items-center justify-center rounded-full text-xs font-bold shadow-xs', avatarColor)}>
                                  {initials}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-foreground truncate">
                                  {contactHref ? (
                                    <Link href={contactHref} className="hover:underline hover:text-primary transition-colors">
                                      {name}
                                    </Link>
                                  ) : (
                                    name
                                  )}{' '}
                                  <span className="text-xs font-normal italic text-muted-foreground">• {roleLabel}</span>
                                </div>
                                {c.phone && (
                                  <a href={`tel:${c.phone}`} className="text-xs text-muted-foreground hover:text-primary font-medium block truncate">
                                    {c.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground space-y-2">
                      <p>Aucun contact rattaché à ce projet.</p>
                      <Button variant="outline" size="sm" onClick={() => setContactDialogOpen(true)} className="text-xs font-medium">
                        + Rattacher un contact
                      </Button>
                    </div>
                  )}
                </div>

                {/* Card: BIEN RATTACHÉ (VENTE EN COURS) */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      BIEN RATTACHÉ (VENTE EN COURS)
                    </h2>
                    {property && !showPropertySearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPropertySearch(true)}
                        className="text-primary hover:text-primary/80 font-bold text-xs p-0 h-auto"
                      >
                        Changer
                      </Button>
                    )}
                  </div>

                  {property && !showPropertySearch ? (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">
                            {property.title || property.property_type || 'Bien en vente'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAttachProperty(null)}
                            disabled={savingProperty}
                            className="text-xs text-destructive hover:text-destructive h-auto p-0"
                          >
                            Détacher
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                          {property.city && <div>📍 {property.city} ({property.zipcode})</div>}
                          {property.price && <div className="font-bold text-primary">💰 {formatPrice(property.price)}</div>}
                          {property.surface && <div>📏 {property.surface} m²</div>}
                          {property.rooms && <div>🚪 {property.rooms} pièces</div>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!property && !showPropertySearch && (
                        <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground space-y-2">
                          <p>Aucun bien rattaché à cet acquéreur.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPropertySearch(true)}
                            className="text-xs font-medium"
                          >
                            + Rattacher un bien en vente
                          </Button>
                        </div>
                      )}

                      {showPropertySearch && (
                        <div className="space-y-4 rounded-xl border p-4 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">Rechercher un bien en vente</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setShowPropertySearch(false)
                                setPropertySearch('')
                                setSearchResults([])
                              }}
                            >
                              Annuler
                            </Button>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                            <Input
                              placeholder="Rechercher par commune, titre, code postal..."
                              className="pl-8 text-xs"
                              value={propertySearch}
                              onChange={(e) => setPropertySearch(e.target.value)}
                            />
                          </div>

                          {searchingProperties ? (
                            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                              <Loader2 className="mr-2 size-4 animate-spin" /> Recherche en cours...
                            </div>
                          ) : searchResults.length > 0 ? (
                            <div className="divide-y divide-border rounded-lg border bg-card max-h-56 overflow-y-auto">
                              {searchResults.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between p-4 text-xs hover:bg-muted/50 transition-colors"
                                >
                                  <div className="space-y-1">
                                    <div className="font-semibold text-foreground">
                                      {p.title || p.property_type || 'Bien'}
                                    </div>
                                    <div className="text-muted-foreground flex gap-4">
                                      {p.city && <span>{p.city} ({p.zipcode})</span>}
                                      {p.price && <span>{formatPrice(p.price)}</span>}
                                      {p.surface && <span>{p.surface} m²</span>}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleAttachProperty(p.id)}
                                    disabled={savingProperty}
                                  >
                                    Rattacher
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : propertySearch ? (
                            <div className="py-4 text-center text-xs text-muted-foreground">
                              Aucun bien trouvé pour cette recherche.
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card: CRITÈRES D'ACHAT */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    CRITÈRES D'ACHAT
                  </h2>

                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="type_bien" className="text-xs">Type de bien</Label>
                        <Select
                          value={form.type_bien}
                          onValueChange={(val) => setForm((prev) => ({ ...prev, type_bien: val }))}
                        >
                          <SelectTrigger id="type_bien" className="h-9 text-xs">
                            <SelectValue placeholder="Tous types" />
                          </SelectTrigger>
                          <SelectContent>
                            {PROPERTY_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value} className="text-xs">
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="budget_max" className="text-xs">Budget max (€)</Label>
                        <Input
                          id="budget_max"
                          type="number"
                          placeholder="Ex: 350000"
                          className="h-9 text-xs"
                          value={form.budget_max}
                          onChange={(e) => setForm((prev) => ({ ...prev, budget_max: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Communes recherchées</Label>
                      <div className="relative">
                        <Input
                          placeholder="Ajouter une commune..."
                          className="h-9 text-xs"
                          value={communeSearch}
                          onChange={(e) => setCommuneSearch(e.target.value)}
                        />
                        {communeSearch && filteredCommunes.length > 0 && (
                          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-xs">
                            {filteredCommunes.map((c) => (
                              <button
                                key={`${c.postalCode}-${c.name}`}
                                type="button"
                                className="w-full text-left px-4 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between"
                                onClick={() => addCommune(c.name)}
                              >
                                <span>{c.name}</span>
                                <span className="text-muted-foreground">{c.postalCode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {form.communes.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {form.communes.map((c) => (
                            <Badge key={c} variant="secondary" className="inline-flex items-center gap-2 px-4 py-1 text-xs">
                              {c}
                              <button type="button" onClick={() => removeCommune(c)} className="hover:text-destructive">×</button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="surface_min" className="text-xs">Surface min (m²)</Label>
                        <Input
                          id="surface_min"
                          type="number"
                          placeholder="Ex: 80"
                          className="h-9 text-xs"
                          value={form.surface_min}
                          onChange={(e) => setForm((prev) => ({ ...prev, surface_min: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pieces_min" className="text-xs">Pièces min</Label>
                        <Input
                          id="pieces_min"
                          type="number"
                          placeholder="Ex: 4"
                          className="h-9 text-xs"
                          value={form.pieces_min}
                          onChange={(e) => setForm((prev) => ({ ...prev, pieces_min: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button size="sm" onClick={handleSaveCriteria} disabled={savingCriteria} className="text-xs font-semibold">
                        {savingCriteria && <Loader2 className="mr-2 size-3 animate-spin" />}
                        <Save className="mr-2 size-3.5" /> Enregistrer les critères
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Card: ÉCHÉANCES */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    ÉCHÉANCES
                  </h2>
                  <DeadlineCalendar items={deadlines} />
                </div>
              </div>

              {/* Right Column (Journal d'activité strictly identical to seller page) */}
              <div className="space-y-6 lg:col-span-7">
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
                  {/* Header & Filter Dropdown */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      JOURNAL D'ACTIVITÉ
                    </h2>
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
                      <Calendar className="mr-2 size-3.5 text-amber-600" /> + RDV
                    </Button>
                  </div>

                  {/* Timeline Feed Identique au Projet de Vente */}
                  {filteredActivityEvents.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Aucune activité enregistrée pour ce filtre.
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      {filteredActivityEvents.map((event) => {
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
                                    <span>Le {formatDateTime(event.created_at)}</span>
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
          </TabsContent>

          {/* ================= Onglet 2: Documents à demander à l'acquéreur ================= */}
          <TabsContent value="documents" className="space-y-6">
            {/* Carte de demande & téléversement de pièces justificatives */}
            <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    PIÈCES JUSTIFICATIVES DEMANDÉES À L'ACQUÉREUR
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sélectionnez un justificatif dans la liste, joignez le fichier si disponible et validez l'enregistrement.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {requestedDocuments.length} document(s)
                  </Badge>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                    {requestedDocuments.filter((d) => d.status === 'validated' || d.status === 'uploaded').length} reçu(s) / validé(s)
                  </Badge>
                </div>
              </div>

              {/* Formulaire Sélection Liste Déroulante + Upload Fichier + Enregistrement */}
              <form onSubmit={handleSubmitDocument} className="rounded-xl border p-4 bg-muted/20 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Liste déroulante des justificatifs */}
                  <div className="space-y-2">
                    <Label htmlFor="doc_preset_select" className="text-xs font-semibold">
                      1. Sélectionner le justificatif
                    </Label>
                    <Select value={selectedDocPreset} onValueChange={setSelectedDocPreset}>
                      <SelectTrigger id="doc_preset_select" className="h-9 text-xs bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STANDARD_DOCUMENTS.map((doc) => (
                          <SelectItem key={doc.value} value={doc.value} className="text-xs">
                            {doc.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Saisie personnalisée si "Autre" */}
                  {selectedDocPreset === 'Autre justificatif (à préciser)' ? (
                    <div className="space-y-2">
                      <Label htmlFor="custom_doc_name" className="text-xs font-semibold">
                        Préciser le nom du justificatif
                      </Label>
                      <Input
                        id="custom_doc_name"
                        placeholder="Ex: Attestation d'apport personnel, Kbis..."
                        className="h-9 text-xs bg-card"
                        value={customDocLabel}
                        onChange={(e) => setCustomDocLabel(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="doc_status_select" className="text-xs font-semibold">
                        Statut initial
                      </Label>
                      <Select value={docInitialStatus} onValueChange={setDocInitialStatus}>
                        <SelectTrigger id="doc_status_select" className="h-9 text-xs bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requested" className="text-xs">⏳ Demandé au client</SelectItem>
                          <SelectItem value="validated" className="text-xs">✓ Validé directement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Upload du fichier & validation */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4 pt-2 border-t border-border/60">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="file_upload_input" className="text-xs font-semibold flex items-center gap-2">
                      <Upload className="size-3.5 text-primary" /> 2. Upload du fichier (PDF, image - optionnel)
                    </Label>
                    <Input
                      id="file_upload_input"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="h-9 text-xs bg-card file:text-xs file:font-semibold file:text-primary hover:file:bg-muted"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setSelectedDocFile(file)
                        if (file && docInitialStatus === 'requested') {
                          setDocInitialStatus('validated')
                        }
                      }}
                    />
                    {selectedDocFile && (
                      <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                        ✓ Fichier sélectionné : {selectedDocFile.name} ({(selectedDocFile.size / 1024).toFixed(0)} Ko)
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingDoc}
                    className="h-9 text-xs font-semibold px-6 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-xs"
                  >
                    {submittingDoc ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <FileCheck className="mr-2 size-4" />
                    )}
                    Valider et enregistrer
                  </Button>
                </div>
              </form>

              {/* Liste des pièces demandées */}
              {loadingDocuments ? (
                <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Chargement des documents...
                </div>
              ) : requestedDocuments.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                  <FileText className="mb-2 size-6 opacity-40" />
                  Aucune pièce justificative n'a encore été enregistrée pour cet acquéreur.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border bg-card">
                  {requestedDocuments.map((doc) => (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{doc.label}</span>
                          {doc.category && (
                            <Badge variant="secondary" className="text-xs">
                              {doc.category}
                            </Badge>
                          )}
                          {getDocStatusBadge(doc.status)}
                        </div>
                        {doc.file_name ? (
                          <div className="text-muted-foreground text-xs flex items-center gap-2 pt-0.5">
                            <span className="font-medium text-emerald-700">📄 Fichier joint : {doc.file_name}</span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-xs italic">
                            Aucun fichier téléversé pour le moment.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {/* Bouton rapide upload de fichier si absent */}
                        {!doc.file_name && (
                          <label className="cursor-pointer inline-flex items-center gap-1 px-4 py-2 rounded-lg border text-xs font-semibold bg-muted/40 hover:bg-muted transition-colors">
                            <Upload className="size-3.5 text-primary" />
                            <span>Ajouter un fichier</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) void handleFileUploadForDoc(doc.id, file)
                              }}
                            />
                          </label>
                        )}

                        {/* Changement de statut */}
                        <Select
                          value={doc.status}
                          onValueChange={(val) => handleUpdateDocStatus(doc.id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="requested" className="text-xs">⏳ Demandé</SelectItem>
                            <SelectItem value="validated" className="text-xs">✓ Validé</SelectItem>
                            <SelectItem value="rejected" className="text-xs">✕ Refusé</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Supprimer la demande"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ================= Onglet 3: Historique ================= */}
          <TabsContent value="history" className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                HISTORIQUE DU PROJET
              </h2>
              {events.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Aucun événement dans l'historique pour le moment.
                </div>
              ) : (
                <div className="relative border-l border-border pl-4 space-y-4 my-2">
                  {events.map((evt) => (
                    <div key={evt.id} className="relative space-y-1">
                      <div className="absolute -left-5 top-1 size-2 rounded-full bg-primary" />
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span>{evt.title || evt.type}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {new Date(evt.occurred_at || evt.created_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      {evt.content && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {evt.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de création / édition d'activité (Identique Fiche Projet Vente) */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="rounded-2xl p-6 border bg-card">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold text-foreground">
              {eventDraft.id ? 'Modifier l’activité' : `Ajouter : ${EVENT_CONFIG[eventDraft.type]?.label || 'Activité'}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Consignez une activité dans le journal du projet d'achat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-2">
              <Label className="text-xs">Type d'activité</Label>
              <div className="flex flex-wrap gap-2">
                {(['note', 'task', 'call', 'meeting'] as ActivityType[]).map((t) => {
                  const cfg = EVENT_CONFIG[t]
                  const Icon = cfg.icon
                  return (
                    <Button
                      key={t}
                      type="button"
                      variant={eventDraft.type === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEventDraft((d) => ({ ...d, type: t }))}
                      className="h-8 text-xs"
                    >
                      <Icon className="mr-2 size-3.5" />
                      {cfg.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_title" className="text-xs">Titre (optionnel)</Label>
              <Input
                id="event_title"
                placeholder="Ex: Proposer appartement Brignoles, Relancer acquéreur..."
                className="h-9 text-xs"
                value={eventDraft.title}
                onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_content" className="text-xs">Description / Contenu</Label>
              <Textarea
                id="event_content"
                placeholder="Détail de la note, de l'appel ou de la tâche..."
                rows={3}
                className="text-xs"
                value={eventDraft.content}
                onChange={(e) => setEventDraft((d) => ({ ...d, content: e.target.value }))}
              />
            </div>

            {['task', 'call', 'meeting'].includes(eventDraft.type) && (
              <div className="space-y-2">
                <Label htmlFor="event_due" className="text-xs">Date & heure d'échéance / rendez-vous</Label>
                <Input
                  id="event_due"
                  type="datetime-local"
                  className="h-9 text-xs"
                  value={eventDraft.due_at}
                  onChange={(e) => setEventDraft((d) => ({ ...d, due_at: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEventDialogOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSaveEvent} disabled={savingEvent || (!eventDraft.title.trim() && !eventDraft.content.trim())}>
              {savingEvent && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              {eventDraft.id ? 'Enregistrer les modifications' : 'Ajouter l’activité'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal d'ajout / rattachement contact */}
      <ProjectContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        projectId={projectId}
        kind="achat"
        onAttached={loadProject}
      />
    </PageLayout>
  )
}

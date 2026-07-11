'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Star,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  Home,
  ArrowUpRight,
  Loader2,
  Phone,
  MapPin,
  Euro,
  Search,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { cn } from '@/lib/utils'

type Priority = 'low' | 'medium' | 'high' | 'critical'
type SignalType = 'price_drop' | 'new_listing' | 'undervalued' | 'expired' | 'manual'

interface Opportunity {
  id: string
  marketPropertyId: string | null
  leadId: string | null
  title: string
  description: string
  stage: string
  priority: Priority
  type: SignalType
  sellerName: string | null
  sellerPhone: string | null
  sellerEmail: string | null
  sourceChannel: string | null
  propertyAddress: string | null
  propertyCity: string | null
  propertyZipcode: string | null
  propertyType: string | null
  propertySurface: number | null
  propertyLandSurface: number | null
  propertyRooms: number | null
  estimatedPriceMin: number | null
  estimatedPriceMax: number | null
  sellingTimeline: string | null
  preEstimationDoneAt: string | null
  visitAt: string | null
  reportDeliveredAt: string | null
  followUpAt: string | null
  linkedPropertyTitle: string | null
  linkedPropertyCity: string | null
  linkedPropertyPrice: number | null
  nextAction: string | null
  dueDate: string | null
  note: string | null
  created_at: string
}

interface OpportunityRow {
  id: string
  market_property_id: string | null
  lead_id: string | null
  title: string | null
  description: string | null
  stage: string | null
  priority: string | null
  signal_type: string | null
  next_action: string | null
  due_date: string | null
  note: string | null
  seller_name: string | null
  seller_phone: string | null
  seller_email: string | null
  source_channel: string | null
  property_address: string | null
  property_city: string | null
  property_zipcode: string | null
  property_type: string | null
  property_surface: number | null
  property_land_surface: number | null
  property_rooms: number | null
  estimated_price_min: number | null
  estimated_price_max: number | null
  selling_timeline: string | null
  pre_estimation_done_at: string | null
  visit_at: string | null
  report_delivered_at: string | null
  follow_up_at: string | null
  created_at: string
  property: { title: string | null; city: string | null; price: number | null } | null
}

type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_due'

type KanbanBoardProps = {
  search: string
  stageFilter: string
  dueFilter: DueFilter
}

const STAGES = [
  { id: 'Veille annonce', label: 'Veille annonce', color: 'bg-zinc-500' },
  { id: 'Nouveau contact', label: 'Nouveau contact', color: 'bg-slate-500' },
  { id: 'Pré-estimation', label: 'Pré-estimation', color: 'bg-blue-500' },
  { id: "Visite d'estimation", label: "Visite d'estimation", color: 'bg-indigo-500' },
  { id: "Remise de l'estimation", label: "Remise de l'estimation", color: 'bg-cyan-500' },
  { id: 'Décision vendeur', label: 'Décision vendeur', color: 'bg-amber-500' },
  { id: 'Suivi moyen terme', label: 'Suivi moyen terme', color: 'bg-purple-500' },
  { id: 'Mandat signé', label: 'Mandat signé', color: 'bg-emerald-600' },
  { id: 'Vendu', label: 'Vendu', color: 'bg-teal-600' },
  { id: 'Perdu / Écarté', label: 'Perdu / Écarté', color: 'bg-gray-400' },
]

const LEGACY_STAGE_MAP: Record<string, string> = {
  'À qualifier': 'Nouveau contact',
  'Annonce à surveiller': 'Veille annonce',
  'À analyser': 'Pré-estimation',
  'À contacter': 'Nouveau contact',
  Contacté: 'Pré-estimation',
  'Rendez-vous à préparer': "Visite d'estimation",
  'RDV / Visite': "Visite d'estimation",
  'Rapport remis': "Remise de l'estimation",
  'En suivi': 'Suivi moyen terme',
  'Mandat potentiel': 'Décision vendeur',
  Converti: 'Mandat signé',
  Écarté: 'Perdu / Écarté',
}

const PIPELINE_STAGES = STAGES
const FOOTER_STAGES: typeof STAGES = []
const DEFAULT_STAGE = STAGES[0].id

const PRIORITY_CONFIG: Record<Priority, { label: string; class: string }> = {
  low: { label: 'Basse', class: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Moyenne', class: 'bg-blue-100 text-blue-600' },
  high: { label: 'Haute', class: 'bg-orange-100 text-orange-600' },
  critical: { label: 'Urgente', class: 'bg-red-100 text-red-600' },
}

const TYPE_CONFIG: Record<SignalType, { label: string; icon: typeof AlertTriangle; class: string }> = {
  price_drop: { label: 'Baisse de prix', icon: AlertTriangle, class: 'bg-red-50 text-red-700 border-red-200' },
  new_listing: { label: 'Annonce', icon: Home, class: 'bg-blue-50 text-blue-700 border-blue-200' },
  undervalued: { label: 'Sous-évalué', icon: Star, class: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expiré', icon: Clock, class: 'bg-gray-50 text-gray-700 border-gray-200' },
  manual: { label: 'Vendeur', icon: User, class: 'bg-purple-50 text-purple-700 border-purple-200' },
}

const SOURCE_OPTIONS = [
  { value: 'estimation_site', label: 'Estimation site' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'porte_a_porte', label: 'Porte-à-porte' },
  { value: 'appel_entrant', label: 'Appel entrant' },
  { value: 'prospection', label: 'Prospection' },
  { value: 'recommandation', label: 'Recommandation' },
  { value: 'annonce_particulier', label: 'Annonce particulier' },
  { value: 'annonce_agence', label: 'Annonce agence' },
  { value: 'autre', label: 'Autre' },
]

const PROPERTY_TYPE_OPTIONS = [
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'autre', label: 'Autre' },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDaysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  return `Il y a ${days}j`
}

function dueBucket(value: string | null | undefined): DueFilter | 'later' {
  if (!value) return 'no_due'
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return 'no_due'
  const today = new Date()
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((dueDay.getTime() - todayDay.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'later'
}

function normalizePriority(value: string | null): Priority {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : 'medium'
}

function normalizeType(value: string | null): SignalType {
  return value === 'price_drop' || value === 'new_listing' || value === 'undervalued' || value === 'expired' || value === 'manual'
    ? value
    : 'manual'
}

function normalizeStage(value: string | null) {
  if (!value) return DEFAULT_STAGE
  const mapped = LEGACY_STAGE_MAP[value] ?? value
  return STAGES.some((s) => s.id === mapped) ? mapped : DEFAULT_STAGE
}

function optionLabel(options: Array<{ value: string; label: string }>, value: string | null) {
  if (!value) return null
  return options.find((option) => option.value === value)?.label ?? value
}

function buildOpportunityTitle(draft: Pick<CreateDraft, 'sellerName' | 'sellerPhone' | 'propertyCity' | 'propertyType'>) {
  const propertyType = optionLabel(PROPERTY_TYPE_OPTIONS, draft.propertyType)
  const place = [propertyType, draft.propertyCity.trim()].filter(Boolean).join(' ')
  if (draft.sellerName.trim()) return [draft.sellerName.trim(), place].filter(Boolean).join(' - ')
  if (place) return `Vendeur - ${place}`
  if (draft.sellerPhone.trim()) return `Vendeur - ${draft.sellerPhone.trim()}`
  return 'Opportunité vendeur'
}

function mapRow(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    marketPropertyId: row.market_property_id,
    leadId: row.lead_id,
    title: row.title ?? 'Opportunité',
    description: row.description ?? '',
    stage: normalizeStage(row.stage),
    priority: normalizePriority(row.priority),
    type: normalizeType(row.signal_type),
    sellerName: row.seller_name,
    sellerPhone: row.seller_phone,
    sellerEmail: row.seller_email,
    sourceChannel: row.source_channel,
    propertyAddress: row.property_address,
    propertyCity: row.property_city,
    propertyZipcode: row.property_zipcode,
    propertyType: row.property_type,
    propertySurface: row.property_surface,
    propertyLandSurface: row.property_land_surface,
    propertyRooms: row.property_rooms,
    estimatedPriceMin: row.estimated_price_min,
    estimatedPriceMax: row.estimated_price_max,
    sellingTimeline: row.selling_timeline,
    preEstimationDoneAt: row.pre_estimation_done_at,
    visitAt: row.visit_at,
    reportDeliveredAt: row.report_delivered_at,
    followUpAt: row.follow_up_at,
    linkedPropertyTitle: row.property?.title ?? null,
    linkedPropertyCity: row.property?.city ?? null,
    linkedPropertyPrice: row.property?.price ?? null,
    nextAction: row.next_action,
    dueDate: row.due_date,
    note: row.note,
    created_at: row.created_at,
  }
}

function SortableOpportunityCard({
  opportunity,
}: {
  opportunity: Opportunity
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const typeCfg = TYPE_CONFIG[opportunity.type]
  const priorityCfg = PRIORITY_CONFIG[opportunity.priority]
  const TypeIcon = typeCfg.icon
  const city = opportunity.propertyCity ?? opportunity.linkedPropertyCity
  const propertyType = optionLabel(PROPERTY_TYPE_OPTIONS, opportunity.propertyType)
  const source = optionLabel(SOURCE_OPTIONS, opportunity.sourceChannel)
  const headline = opportunity.sellerName || opportunity.title
  const estimate = opportunity.estimatedPriceMin || opportunity.estimatedPriceMax
    ? [opportunity.estimatedPriceMin, opportunity.estimatedPriceMax].filter((value): value is number => value != null).map(formatPrice).join(' - ')
    : null
  function openCard() {
    if (isDragging) return
    router.push(`/app/opportunities/${opportunity.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      title="Ouvrir la fiche opportunité"
      onClick={openCard}
      onKeyUp={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        openCard()
      }}
      className={cn(
        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing',
        isDragging && 'cursor-grabbing',
      )}
    >
      <Card className="hover:shadow-md transition-shadow pointer-events-none">
        <CardContent className="p-3">
          <div className="mb-2 flex items-start justify-end gap-2">
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge variant="outline" className={cn('h-5 px-1.5 py-0 text-[10px]', typeCfg.class)}>
                <TypeIcon className="mr-1 h-3 w-3" />
                {typeCfg.label}
              </Badge>
              <Badge variant="outline" className={cn('h-5 px-1.5 py-0 text-[10px]', priorityCfg.class)}>
                {priorityCfg.label}
              </Badge>
            </div>
          </div>

          <p className="mb-1 text-sm font-medium leading-tight">{headline}</p>
          {headline !== opportunity.title && (
            <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">{opportunity.title}</p>
          )}

          <div className="mb-3 space-y-1.5 text-xs text-muted-foreground">
            {(city || propertyType) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{[propertyType, city].filter(Boolean).join(' · ')}</span>
              </div>
            )}
            {opportunity.sellerPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{opportunity.sellerPhone}</span>
              </div>
            )}
            {estimate && (
              <div className="flex items-center gap-1.5">
                <Euro className="h-3 w-3 shrink-0" />
                <span className="truncate">{estimate}</span>
              </div>
            )}
          </div>

          {opportunity.linkedPropertyTitle && (
            <div className="mb-3 rounded-md bg-muted/30 p-2">
              <p className="truncate text-xs font-medium">{opportunity.linkedPropertyTitle}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-muted-foreground">{opportunity.linkedPropertyCity ?? ''}</span>
                {opportunity.linkedPropertyPrice != null && (
                  <span className="text-xs font-medium">{formatPrice(opportunity.linkedPropertyPrice)}</span>
                )}
              </div>
            </div>
          )}

          {opportunity.nextAction && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{opportunity.nextAction}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>{source ?? formatDaysAgo(opportunity.created_at)}</span>
            {(opportunity.dueDate || opportunity.followUpAt) && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(opportunity.dueDate ?? opportunity.followUpAt as string)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OpportunityCardOverlay({ opportunity }: { opportunity: Opportunity }) {
  const typeCfg = TYPE_CONFIG[opportunity.type]
  const priorityCfg = PRIORITY_CONFIG[opportunity.priority]
  const TypeIcon = typeCfg.icon

  return (
    <Card className="w-72 rotate-3 shadow-xl opacity-90">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Badge variant="outline" className={cn('h-5 px-1.5 py-0 text-[10px]', typeCfg.class)}>
            <TypeIcon className="mr-1 h-3 w-3" />
            {typeCfg.label}
          </Badge>
          <Badge variant="outline" className={cn('h-5 px-1.5 py-0 text-[10px]', priorityCfg.class)}>
            {priorityCfg.label}
          </Badge>
        </div>
        <p className="mb-1 text-sm font-medium leading-tight">{opportunity.sellerName || opportunity.title}</p>
        {(opportunity.propertyCity || opportunity.linkedPropertyCity) && (
          <p className="truncate text-xs text-muted-foreground">{opportunity.propertyCity ?? opportunity.linkedPropertyCity}</p>
        )}
      </CardContent>
    </Card>
  )
}

function DroppableColumn({ stage, children }: { stage: typeof STAGES[0]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-3 min-h-[200px] rounded-lg p-2 transition-colors',
        isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/20',
      )}
    >
      {children}
    </div>
  )
}

interface CreateDraft {
  mode: 'existing' | 'new'
  leadId: string
  marketPropertyId: string
  sellerName: string
  sellerPhone: string
  sellerEmail: string
  sourceChannel: string
  propertyCity: string
  propertyType: string
  priority: Priority
  nextAction: string
  dueDate: string
  stage: string
}

function emptyDraft(stage: string): CreateDraft {
  return {
    mode: 'existing',
    leadId: '',
    marketPropertyId: '',
    sellerName: '',
    sellerPhone: '',
    sellerEmail: '',
    sourceChannel: 'flyer',
    propertyCity: '',
    propertyType: '',
    priority: 'medium',
    nextAction: '',
    dueDate: '',
    stage,
  }
}

interface LeadOption {
  id: string
  commune: string | null
  source_channel: string | null
  priority: Priority
  next_action: string | null
  prospect: {
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
  }
  seller_property: {
    type_bien: string | null
    surface: number | null
    prix_estime: number | null
  } | null
  opportunity: { id: string; title: string; stage: string | null } | null
}

interface PropertyOption {
  id: string
  title: string | null
  city: string | null
  zipcode: string | null
  price: number | null
  surface: number | null
  property_type: string | null
  status: string | null
  seller_type: string | null
  thumbnail_url: string | null
  opportunity: { id: string; title: string; stage: string | null; priority: string | null } | null
}

export function KanbanBoard({ search, stageFilter, dueFilter }: KanbanBoardProps) {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [leadSearch, setLeadSearch] = useState('')
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([])
  const [propertySearch, setPropertySearch] = useState('')
  const [propertyLoading, setPropertyLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<CreateDraft>(emptyDraft(DEFAULT_STAGE))
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market/opportunities?limit=100')
      const data = await res.json()
      const rows: OpportunityRow[] = data.opportunities ?? []
      setOpportunities(rows.map(mapRow))
    } catch (err) {
      console.error('Erreur chargement opportunités', err)
      toast.error('Impossible de charger les opportunités')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLeads = useCallback(async (q = '') => {
    try {
      const params = new URLSearchParams({ page_size: '50', tool: 'vendre' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch('/api/leads/list?' + params.toString())
      const data = await res.json()
      if (data.success) setLeadOptions(data.data ?? [])
    } catch (err) {
      console.error('Erreur chargement leads', err)
    }
  }, [])

  const loadProperties = useCallback(async (q = '') => {
    setPropertyLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', sort: 'last_seen_at.desc' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch('/api/market/properties?' + params.toString())
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setPropertyOptions(data.properties ?? [])
    } catch (err) {
      console.error('Erreur chargement biens', err)
      toast.error('Impossible de charger les biens')
    } finally {
      setPropertyLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (dialogOpen) void loadLeads(leadSearch) }, [dialogOpen, leadSearch, loadLeads])
  useEffect(() => { if (dialogOpen) void loadProperties(propertySearch) }, [dialogOpen, propertySearch, loadProperties])

  const filteredOpportunities = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return opportunities.filter((opportunity) => {
      const matchesSearch = !normalizedSearch || [
        opportunity.title,
        opportunity.sellerName,
        opportunity.sellerPhone,
        opportunity.sellerEmail,
        opportunity.propertyCity,
        opportunity.propertyAddress,
        opportunity.propertyType,
        opportunity.linkedPropertyTitle,
        opportunity.linkedPropertyCity,
        opportunity.nextAction,
        opportunity.sourceChannel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
      const matchesStage = stageFilter === 'all' || opportunity.stage === stageFilter
      const dueValue = opportunity.dueDate ?? opportunity.followUpAt
      const matchesDue = dueFilter === 'all' || dueBucket(dueValue) === dueFilter
      return matchesSearch && matchesStage && matchesDue
    })
  }, [dueFilter, opportunities, search, stageFilter])

  const activeOpportunity = activeId ? opportunities.find((o) => o.id === activeId) ?? null : null
  const getStageOpps = (stageId: string) => filteredOpportunities.filter((o) => o.stage === stageId)
  const findStageByOppId = (id: string) => opportunities.find((o) => o.id === id)?.stage

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  async function persistStage(id: string, stage: string, previousStage: string) {
    try {
      const res = await fetch(`/api/market/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      if (!res.ok) throw new Error('Erreur API')
    } catch (err) {
      console.error('Erreur persistance stage:', err)
      setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, stage: previousStage } : o)))
      toast.error('Déplacement non enregistré')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    const targetStage = STAGES.find((s) => s.id === overIdStr)?.id ?? findStageByOppId(overIdStr)
    if (!targetStage) return

    const current = opportunities.find((o) => o.id === activeIdStr)
    if (!current || current.stage === targetStage) return

    const previousStage = current.stage
    setOpportunities((prev) => prev.map((o) => (o.id === activeIdStr ? { ...o, stage: targetStage } : o)))
    void persistStage(activeIdStr, targetStage, previousStage)
  }

  function openCreate(stage: string = DEFAULT_STAGE) {
    setDraft(emptyDraft(stage))
    setLeadSearch('')
    setPropertySearch('')
    setDialogOpen(true)
  }

  async function submitCreate() {
    const hasSelectedProperty = Boolean(draft.marketPropertyId)
    if (draft.mode === 'existing' && !draft.leadId && !hasSelectedProperty) {
      toast.error('Choisis un contact ou un bien à rattacher')
      return
    }
    if (draft.mode === 'new' && !draft.sellerName.trim() && !draft.sellerPhone.trim() && !draft.sellerEmail.trim() && !hasSelectedProperty) {
      toast.error('Ajoute un contact vendeur ou sélectionne un bien')
      return
    }
    const selectedProperty = propertyOptions.find((property) => property.id === draft.marketPropertyId)
    const duplicateSearchDone = Boolean(
      draft.leadId ||
      draft.marketPropertyId ||
      leadSearch.trim().length >= 2 ||
      propertySearch.trim().length >= 2,
    )
    if (!duplicateSearchDone) {
      toast.error('Recherche anti-doublon obligatoire avant création')
      return
    }
    const isAgencyWatch = Boolean(selectedProperty?.seller_type === 'agency' && !draft.leadId && draft.mode === 'existing')
    const sourceChannel = selectedProperty
      ? (selectedProperty.seller_type === 'agency' ? 'annonce_agence' : 'annonce_particulier')
      : draft.sourceChannel
    setSaving(true)
    try {
      const res = await fetch('/api/market/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_property_id: draft.marketPropertyId || null,
          lead_id: draft.mode === 'existing' ? draft.leadId : null,
          create_lead: draft.mode === 'new',
          lead: draft.mode === 'new' ? {
            seller_name: draft.sellerName,
            phone: draft.sellerPhone,
            email: draft.sellerEmail,
            source_channel: sourceChannel,
            commune: draft.propertyCity,
            type_bien: draft.propertyType,
            priority: draft.priority,
          } : undefined,
          title: draft.mode === 'new'
            ? buildOpportunityTitle(draft)
            : selectedProperty?.title ?? undefined,
          stage: isAgencyWatch ? 'Veille annonce' : draft.stage,
          priority: draft.priority,
          signal_type: 'manual',
          source_channel: sourceChannel,
          next_action: draft.nextAction.trim() || null,
          due_date: draft.dueDate || null,
          created_from: 'manual',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      toast.success(data.existing ? 'Opportunité déjà existante' : 'Opportunité créée')
      setDialogOpen(false)
      await load()
      if (data.opportunity?.id) router.push(`/app/opportunities/${data.opportunity.id}`)
    } catch (err) {
      console.error('Erreur création opportunité:', err)
      toast.error('Impossible de créer l’opportunité')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-w-0 space-y-6">
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
          {PIPELINE_STAGES.map((stage) => {
            const stageOpps = getStageOpps(stage.id)
            return (
              <div key={stage.id} className="w-72 flex-shrink-0">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={cn('h-2 w-2 shrink-0 rounded-full', stage.color)} />
                    <span className="truncate text-sm font-medium">{stage.label}</span>
                    <span className="text-xs text-muted-foreground">({stageOpps.length})</span>
                  </div>
                </div>

                <SortableContext items={stageOpps.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn stage={stage}>
                    {stageOpps.map((opp) => (
                      <SortableOpportunityCard key={opp.id} opportunity={opp} />
                    ))}
                    {stageOpps.length === 0 && (
                      <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground">
                        {loading ? 'Chargement…' : 'Déposer ici'}
                      </div>
                    )}
                  </DroppableColumn>
                </SortableContext>
              </div>
            )
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FOOTER_STAGES.map((stage) => {
            const stageOpps = getStageOpps(stage.id)
            return (
              <div key={stage.id}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <div className={cn('h-2 w-2 rounded-full', stage.color)} />
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="text-xs text-muted-foreground">({stageOpps.length})</span>
                </div>
                <SortableContext items={stageOpps.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn stage={stage}>
                    {stageOpps.map((opp) => (
                      <SortableOpportunityCard key={opp.id} opportunity={opp} />
                    ))}
                    {stageOpps.length === 0 && (
                      <div className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground">
                        Déposer ici
                      </div>
                    )}
                  </DroppableColumn>
                </SortableContext>
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {activeOpportunity ? <OpportunityCardOverlay opportunity={activeOpportunity} /> : null}
      </DragOverlay>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter une affaire vendeur</DialogTitle>
            <DialogDescription>Recherche d’abord un contact ou un bien existant, puis rattache ou crée l’affaire.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Recherche anti-doublon requise : saisis au moins un nom, téléphone, email, commune ou annonce avant de créer une nouvelle piste.
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, mode: 'existing' }))}
                className={cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', draft.mode === 'existing' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                Lead existant
              </button>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, mode: 'new', leadId: '' }))}
                className={cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', draft.mode === 'new' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                Nouveau contact
              </button>
            </div>

            {draft.mode === 'existing' ? (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Rechercher un lead</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Nom, téléphone, email..." className="pl-9" />
                  </div>
                </label>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {leadOptions.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Aucun contact vendeur trouvé</p>
                  ) : leadOptions.map((lead) => {
                    const name = [lead.prospect.first_name, lead.prospect.last_name].filter(Boolean).join(' ').trim() || 'Contact vendeur'
                    const selected = draft.leadId === lead.id
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setDraft((d) => ({
                          ...d,
                          leadId: lead.id,
                          priority: lead.priority,
                          propertyCity: lead.commune ?? '',
                          propertyType: lead.seller_property?.type_bien ?? '',
                          nextAction: lead.next_action ?? d.nextAction,
                        }))}
                        className={cn('w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50', selected ? 'border-primary bg-accent/50' : 'border-border')}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{name}</span>
                          {lead.opportunity && <Badge variant="outline" className="text-[10px]">déjà lié</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {lead.prospect.phone && <span>{lead.prospect.phone}</span>}
                          {lead.commune && <span>{lead.commune}</span>}
                          {lead.seller_property?.type_bien && <span>{lead.seller_property.type_bien}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium">Contact vendeur</span>
                  <Input value={draft.sellerName} onChange={(e) => setDraft((d) => ({ ...d, sellerName: e.target.value }))} placeholder="Nom du vendeur" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Téléphone</span>
                  <Input value={draft.sellerPhone} onChange={(e) => setDraft((d) => ({ ...d, sellerPhone: e.target.value }))} placeholder="06..." />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Email</span>
                  <Input type="email" value={draft.sellerEmail} onChange={(e) => setDraft((d) => ({ ...d, sellerEmail: e.target.value }))} />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Origine</span>
                  <Select value={draft.sourceChannel} onValueChange={(v) => setDraft((d) => ({ ...d, sourceChannel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Commune</span>
                  <Input value={draft.propertyCity} onChange={(e) => setDraft((d) => ({ ...d, propertyCity: e.target.value }))} />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Type</span>
                  <Select value={draft.propertyType} onValueChange={(v) => setDraft((d) => ({ ...d, propertyType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{PROPERTY_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              </div>
            )}

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Bien en annonce</p>
                  <p className="text-xs text-muted-foreground">Sélection locale depuis les biens déjà importés.</p>
                </div>
                {draft.marketPropertyId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft((d) => ({ ...d, marketPropertyId: '' }))}
                  >
                    Retirer
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  placeholder="Titre, commune, CP..."
                  className="pl-9"
                />
              </div>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {propertyLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-md border border-dashed py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des biens
                  </div>
                ) : propertyOptions.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Aucun bien trouvé</p>
                ) : propertyOptions.map((property) => {
                  const selected = draft.marketPropertyId === property.id
                  const alreadyLinked = Boolean(property.opportunity)
                  return (
                    <button
                      key={property.id}
                      type="button"
                      disabled={alreadyLinked}
                      onClick={() => setDraft((d) => ({
                        ...d,
                        marketPropertyId: property.id,
                        propertyCity: d.propertyCity || property.city || '',
                        propertyType: d.propertyType || property.property_type || '',
                      }))}
                      className={cn(
                        'w-full rounded-md border p-3 text-left transition-colors',
                        selected ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted/50',
                        alreadyLinked && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                            {property.thumbnail_url ? (
                              <div
                                aria-label={property.title ?? 'Miniature du bien'}
                                className="h-full w-full bg-cover bg-center"
                                role="img"
                                style={{ backgroundImage: `url("${property.thumbnail_url}")` }}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-muted-foreground">
                                <Home className="size-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{property.title ?? 'Bien en annonce'}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {[property.property_type, property.city, property.zipcode].filter(Boolean).map((item) => (
                                <span key={item}>{item}</span>
                              ))}
                              {property.surface != null && <span>{property.surface} m²</span>}
                              {property.seller_type && <span>{property.seller_type}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {property.price != null && <p className="text-sm font-medium">{formatPrice(property.price)}</p>}
                          <div className="mt-1 flex justify-end gap-1">
                            {property.status && <Badge variant="outline" className="text-[10px]">{property.status}</Badge>}
                            {alreadyLinked && <Badge variant="outline" className="text-[10px]">déjà lié</Badge>}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium">Étape</span>
                <Select value={draft.stage} onValueChange={(v) => setDraft((d) => ({ ...d, stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium">Priorité</span>
                <Select value={draft.priority} onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="critical">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1 sm:col-span-3">
                <span className="text-xs font-medium">Prochaine action</span>
                <Input value={draft.nextAction} onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))} placeholder="Préparer la pré-estimation, rappeler, fixer le RDV…" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium">Échéance</span>
                <Input type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={submitCreate} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}

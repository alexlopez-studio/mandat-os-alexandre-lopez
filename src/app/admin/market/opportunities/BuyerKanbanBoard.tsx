'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  DoorOpen,
  Euro,
  Loader2,
  MapPin,
  Maximize2,
  RefreshCw,
} from 'lucide-react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const BUYER_STAGES = [
  { id: 'Nouveau contact', label: 'Nouveau contact', color: 'bg-slate-500' },
  { id: 'Recherche qualifiée', label: 'Recherche qualifiée', color: 'bg-blue-500' },
  { id: 'Matching à faire', label: 'Matching à faire', color: 'bg-amber-500' },
  { id: 'Biens proposés', label: 'Biens proposés', color: 'bg-cyan-500' },
  { id: 'Visites', label: 'Visites', color: 'bg-indigo-500' },
  { id: 'Offre en cours', label: 'Offre en cours', color: 'bg-purple-500' },
  { id: 'Mandat de recherche signé', label: 'Mandat de recherche signé', color: 'bg-emerald-600' },
  { id: 'Achat conclu', label: 'Achat conclu', color: 'bg-teal-600' },
  { id: 'Pause / Perdu', label: 'Pause / Perdu', color: 'bg-gray-400' },
]

const DEFAULT_STAGE = BUYER_STAGES[0].id

interface BuyerCriteria {
  id: string
  lead_id: string
  type_bien: string | null
  communes: string[] | null
  budget_max: number | null
  surface_min: number | null
  pieces_min: number | null
  criteres: string[] | null
  active: boolean
  stage: string | null
  next_action: string | null
  due_date: string | null
  matched_at: string | null
  created_at: string
}

type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_due'
type ActiveFilter = 'all' | 'active' | 'paused'

type BuyerKanbanBoardProps = {
  search: string
  stageFilter: string
  activeFilter: ActiveFilter
  dueFilter: DueFilter
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return 'Budget à qualifier'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatMatchedAt(dateStr: string | null) {
  if (!dateStr) return 'Matching non lancé'
  return `Matché le ${formatDate(dateStr)}`
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

function normalizeStage(stage: string | null | undefined) {
  return BUYER_STAGES.some((item) => item.id === stage) ? stage as string : DEFAULT_STAGE
}

function buyerTitle(buyer: BuyerCriteria) {
  return buyer.type_bien ? `Recherche ${buyer.type_bien}` : 'Recherche acquéreur'
}

function DroppableColumn({ stage, children }: { stage: typeof BUYER_STAGES[number]; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[220px] space-y-3 rounded-lg p-2 transition-colors',
        isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/20',
      )}
    >
      {children}
    </div>
  )
}

function SortableBuyerCard({ buyer }: { buyer: BuyerCriteria }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: buyer.lead_id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }

  function openCard() {
    if (isDragging) return
    router.push(`/app/acheteurs/${buyer.lead_id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      title="Ouvrir la fiche acquéreur"
      onClick={openCard}
      onKeyUp={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        openCard()
      }}
      className={cn(
        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing',
        isDragging && 'cursor-grabbing',
      )}
    >
      <Card className="hover:shadow-md transition-shadow pointer-events-none">
        <CardContent className="space-y-3 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{buyerTitle(buyer)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{buyer.lead_id.slice(0, 12)}</p>
            </div>
            <Badge variant={buyer.active ? 'default' : 'secondary'} className="h-5 text-[10px]">
              {buyer.active ? 'Actif' : 'Pause'}
            </Badge>
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {buyer.communes?.length ? buyer.communes.slice(0, 3).join(', ') : 'Commune à qualifier'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Euro className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatPrice(buyer.budget_max)}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Maximize2 className="h-3 w-3" />
                {buyer.surface_min ? `${buyer.surface_min} m² min` : 'Surface libre'}
              </span>
              <span className="inline-flex items-center gap-1">
                <DoorOpen className="h-3 w-3" />
                {buyer.pieces_min ? `${buyer.pieces_min} p. min` : 'Pièces libres'}
              </span>
            </div>
          </div>

          <div className="rounded-md bg-muted/30 p-2 text-[11px] text-muted-foreground">
            {formatMatchedAt(buyer.matched_at)}
          </div>

          {buyer.next_action && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{buyer.next_action}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>Créé le {formatDate(buyer.created_at)}</span>
            {buyer.due_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(buyer.due_date)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BuyerCardOverlay({ buyer }: { buyer: BuyerCriteria }) {
  return (
    <Card className="w-72 rotate-3 shadow-xl opacity-90">
      <CardContent className="p-3">
        <p className="text-sm font-medium">{buyerTitle(buyer)}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {buyer.communes?.join(', ') || 'Commune à qualifier'} · {formatPrice(buyer.budget_max)}
        </p>
      </CardContent>
    </Card>
  )
}

export function BuyerKanbanBoard({ search, stageFilter, activeFilter, dueFilter }: BuyerKanbanBoardProps) {
  const [buyers, setBuyers] = useState<BuyerCriteria[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const loadBuyers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ active: 'all', limit: '200' })
      const res = await fetch(`/api/market/buyers?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chargement impossible')
      setBuyers(data.buyers ?? [])
    } catch (error) {
      console.error('Erreur chargement acquéreurs', error)
      toast.error('Impossible de charger les acquéreurs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBuyers()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadBuyers])

  const activeBuyer = buyers.find((buyer) => buyer.lead_id === activeId) ?? null

  const buyersByStage = useMemo(() => {
    return BUYER_STAGES.reduce<Record<string, BuyerCriteria[]>>((acc, stage) => {
      acc[stage.id] = buyers.filter((buyer) => {
        const matchesSearch = !search.trim() || [
          buyer.type_bien,
          buyer.stage,
          buyer.next_action,
          buyer.lead_id,
          buyer.communes?.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search.trim().toLowerCase())
        const matchesStage = stageFilter === 'all' || normalizeStage(buyer.stage) === stageFilter
        const matchesActive =
          activeFilter === 'all' ||
          (activeFilter === 'active' && buyer.active) ||
          (activeFilter === 'paused' && !buyer.active)
        const matchesDue = dueFilter === 'all' || dueBucket(buyer.due_date) === dueFilter
        return matchesSearch && matchesStage && matchesActive && matchesDue && normalizeStage(buyer.stage) === stage.id
      })
      return acc
    }, {})
  }, [activeFilter, buyers, dueFilter, search, stageFilter])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  function findStageByBuyerId(id: string) {
    const buyer = buyers.find((item) => item.lead_id === id)
    return buyer ? normalizeStage(buyer.stage) : undefined
  }

  async function handleDragEnd(event: DragEndEvent) {
    const buyerId = String(event.active.id)
    const overId = String(event.over?.id ?? '')
    const nextStage = BUYER_STAGES.find((stage) => stage.id === overId)?.id ?? findStageByBuyerId(overId)
    setActiveId(null)

    if (!nextStage || !BUYER_STAGES.some((stage) => stage.id === nextStage)) return

    const buyer = buyers.find((item) => item.lead_id === buyerId)
    if (!buyer || normalizeStage(buyer.stage) === nextStage) return

    const previous = buyers
    setBuyers((current) =>
      current.map((item) => item.lead_id === buyerId ? { ...item, stage: nextStage } : item),
    )

    try {
      const res = await fetch(`/api/market/buyers/${buyerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Mise à jour impossible')
      toast.success('Statut acquéreur mis à jour')
    } catch (error) {
      console.error('Erreur changement statut acquéreur', error)
      setBuyers(previous)
      toast.error('Impossible de déplacer cet acquéreur')
    }
  }

  if (loading && buyers.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement des acquéreurs...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BUYER_STAGES.map((stage) => {
            const columnBuyers = buyersByStage[stage.id] ?? []
            return (
              <div key={stage.id} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                    <h2 className="text-sm font-semibold">{stage.label}</h2>
                  </div>
                  <Badge variant="secondary" className="text-xs">{columnBuyers.length}</Badge>
                </div>

                <DroppableColumn stage={stage}>
                  <SortableContext
                    items={columnBuyers.map((buyer) => buyer.lead_id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {columnBuyers.map((buyer) => (
                      <SortableBuyerCard key={buyer.lead_id} buyer={buyer} />
                    ))}
                  </SortableContext>
                  {columnBuyers.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Aucun acquéreur
                    </div>
                  )}
                </DroppableColumn>
              </div>
            )
          })}
        </div>

        <DragOverlay>{activeBuyer ? <BuyerCardOverlay buyer={activeBuyer} /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}

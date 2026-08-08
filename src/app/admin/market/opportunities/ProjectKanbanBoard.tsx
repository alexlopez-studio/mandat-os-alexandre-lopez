'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Home,
  User,
  Clock,
  Calendar,
  AlertTriangle,
  Loader2,
  Euro,
  MapPin,
  ArrowUpRight,
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
import { cn } from '@/lib/utils'

const MACRO_STAGES = [
  { id: 'nouveau', label: 'Nouveau', color: 'bg-slate-500' },
  { id: 'qualification', label: 'Qualification', color: 'bg-blue-500' },
  { id: 'action', label: 'Action', color: 'bg-amber-500' },
  { id: 'negociation', label: 'Négociation', color: 'bg-purple-500' },
  { id: 'mandat', label: 'Mandat / Offre', color: 'bg-emerald-600' },
  { id: 'pause', label: 'Suivi / Pause', color: 'bg-gray-400' },
  { id: 'conclu', label: 'Conclu', color: 'bg-teal-600' },
  { id: 'perdu', label: 'Perdu / Écarté', color: 'bg-red-600' },
]

const STAGE_MAPPING: Record<string, { vente: string; achat: string }> = {
  nouveau: { vente: 'Nouveau contact', achat: 'Nouveau contact' },
  qualification: { vente: 'Pré-estimation', achat: 'Recherche qualifiée' },
  action: { vente: "Visite d'estimation", achat: 'Matching à faire' },
  negociation: { vente: "Remise de l'estimation", achat: 'Visites' },
  mandat: { vente: 'Mandat signé', achat: 'Mandat de recherche signé' },
  pause: { vente: 'Suivi moyen terme', achat: 'Pause / Perdu' }, // Achat has Pause/Perdu
  conclu: { vente: 'Vendu', achat: 'Achat conclu' },
  perdu: { vente: 'Perdu / Écarté', achat: 'Pause / Perdu' },
}

function getMacroStage(dbStage: string, kind: 'vente' | 'achat'): string {
  if (kind === 'vente') {
    if (dbStage === 'Veille annonce') return 'nouveau'
    if (dbStage === 'Décision vendeur') return 'negociation'
  } else {
    if (dbStage === 'Biens proposés') return 'action'
    if (dbStage === 'Offre en cours') return 'negociation'
  }
  for (const [macro, mapping] of Object.entries(STAGE_MAPPING)) {
    if (mapping[kind] === dbStage) return macro
  }
  return 'nouveau'
}

type ProjectType = 'vente' | 'achat'

interface Project {
  id: string
  kind: ProjectType
  title: string
  stage: string
  priority: string
  next_action: string | null
  due_date: string | null
  property_city: string | null
  property_type: string | null
  budget_max: number | null
  estimated_price_min: number | null
  seller_name: string | null
  created_at: string
}

function DroppableColumn({ stage, children }: { stage: typeof MACRO_STAGES[0]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  return (
    <div ref={setNodeRef} className={cn('min-h-[200px] flex-1', isOver && 'bg-muted/50 rounded-lg')}>
      {children}
    </div>
  )
}

function SortableProjectCard({ project, activeId }: { project: Project; activeId: UniqueIdentifier | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  
  if (isDragging) {
    return <div ref={setNodeRef} style={style} className="mb-1 h-24 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5" />
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-1.5">
      <ProjectCard project={project} />
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const isVente = project.kind === 'vente'
  
  return (
    <Card className="group relative cursor-grab hover:border-primary/50 hover:shadow-md transition-all active:cursor-grabbing overflow-hidden">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", isVente ? "bg-blue-500" : "bg-emerald-500")} />
      <CardContent className="p-1.5 pl-2.5 flex flex-col gap-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1 font-medium text-xs">
            {isVente ? <Home className="h-3 w-3 text-blue-500" /> : <User className="h-3 w-3 text-emerald-500" />}
            <span className="truncate max-w-[150px]">{project.title}</span>
          </div>
          <Link href={`/app/opportunities/${project.id}`} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        
        {project.seller_name && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <User className="h-2.5 w-2.5" />
            <span className="truncate">{project.seller_name}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-0.5">
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal">
            {isVente ? 'Vente' : 'Recherche'}
          </Badge>
          
          {(project.estimated_price_min || project.budget_max) && (
            <div className="text-[11px] font-medium text-muted-foreground">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(project.estimated_price_min || project.budget_max || 0)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type ProjectKanbanBoardProps = {
  search: string
  kindFilter: string // 'all' | 'vente' | 'achat'
  activeFilter: string // 'all' | 'active' | 'paused'
}

export function ProjectKanbanBoard({ search, kindFilter, activeFilter }: ProjectKanbanBoardProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const fetchProjects = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = new URL('/api/market/projects', window.location.origin)
      url.searchParams.set('search', search)
      url.searchParams.set('kind', kindFilter)
      url.searchParams.set('active', activeFilter)
      
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erreur de chargement')
      const data = await res.json()
      setProjects(data.projects)
    } catch (e) {
      toast.error('Erreur lors du chargement des projets')
    } finally {
      setIsLoading(false)
    }
  }, [search, kindFilter, activeFilter])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const projectsByStage = useMemo(() => {
    return MACRO_STAGES.reduce<Record<string, Project[]>>((acc, stage) => {
      acc[stage.id] = projects.filter((p) => getMacroStage(p.stage, p.kind) === stage.id)
      return acc
    }, {})
  }, [projects])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const projectId = active.id as string
    const overId = over.id as string

    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    const currentMacro = getMacroStage(project.stage, project.kind)
    const nextMacro = MACRO_STAGES.find((s) => s.id === overId)?.id ?? currentMacro

    if (currentMacro === nextMacro) return

    const nextDbStage = STAGE_MAPPING[nextMacro]?.[project.kind]
    if (!nextDbStage) return

    // Optimistic update
    setProjects((curr) => curr.map((p) => p.id === projectId ? { ...p, stage: nextDbStage } : p))

    try {
      const res = await fetch(`/api/market/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextDbStage }),
      })
      if (!res.ok) throw new Error('Erreur de mise à jour')
    } catch (e) {
      toast.error('Erreur lors du déplacement')
      fetchProjects() // Revert
    }
  }

  const activeProject = useMemo(() => projects.find((p) => p.id === activeId), [activeId, projects])

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full w-full gap-4 overflow-x-auto pb-4">
        {MACRO_STAGES.map((stage) => {
          const columnProjects = projectsByStage[stage.id] ?? []
          return (
            <div key={stage.id} className="w-60 shrink-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                  <h2 className="text-sm font-semibold">{stage.label}</h2>
                </div>
                <Badge variant="secondary" className="px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {columnProjects.length}
                </Badge>
              </div>
              <DroppableColumn stage={stage}>
                <SortableContext items={columnProjects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {columnProjects.map((project) => (
                    <SortableProjectCard key={project.id} project={project} activeId={activeId} />
                  ))}
                </SortableContext>
              </DroppableColumn>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeProject ? (
          <div className="rotate-3 scale-105 shadow-xl transition-all opacity-90 cursor-grabbing">
            <ProjectCard project={activeProject} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

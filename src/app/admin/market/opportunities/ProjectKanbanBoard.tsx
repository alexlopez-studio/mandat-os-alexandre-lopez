'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
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
import { StatusPill } from '@/components/pro'
import {
  MACRO_STAGES,
  PROJECT_KIND_META,
  STAGE_MAPPING,
  getMacroStage,
  projectDetailHref,
  type MacroStage,
  type ProjectRow,
} from '@/lib/project-stages'
import { cn } from '@/lib/utils'

function DroppableColumn({ stage, children }: { stage: MacroStage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  return (
    <div ref={setNodeRef} className={cn('min-h-48 flex-1', isOver && 'rounded-lg bg-muted/50')}>
      {children}
    </div>
  )
}

function SortableProjectCard({ project }: { project: ProjectRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="mb-2 h-24 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5"
      />
    )
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2">
      <ProjectCard project={project} />
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const isVente = project.kind === 'vente'
  const kindMeta = PROJECT_KIND_META[project.kind]
  const KindIcon = kindMeta.icon
  const amount = project.estimated_price_min ?? project.budget_max
  const href = projectDetailHref(project)
  const title = project.display_title ?? project.title

  return (
    <Card className="group relative cursor-grab overflow-hidden transition-colors hover:border-primary active:cursor-grabbing">
      <div
        className={cn('absolute bottom-0 left-0 top-0 w-1', isVente ? 'bg-primary' : 'bg-emerald-500')}
      />
      <CardContent className="flex flex-col gap-2 p-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KindIcon
              className={cn('size-3.5', isVente ? 'text-primary' : 'text-emerald-500')}
              aria-hidden="true"
            />
            <span className="max-w-40 truncate" title={title}>{title}</span>
          </div>
          {href ? (
            <Link
              href={href}
              className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`Ouvrir ${title}`}
            >
              <ArrowUpRight className="size-4" />
            </Link>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <StatusPill tone={kindMeta.tone}>{kindMeta.label}</StatusPill>
          {amount != null && (
            <div className="text-xs font-medium text-muted-foreground">
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              }).format(amount)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type ProjectKanbanBoardProps = {
  projects: ProjectRow[]
  onRefresh: () => void
}

export function ProjectKanbanBoard({ projects, onRefresh }: ProjectKanbanBoardProps) {
  const [rows, setRows] = useState<ProjectRow[]>(projects)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  useEffect(() => {
    setRows(projects)
  }, [projects])

  const projectsByStage = useMemo(() => {
    return MACRO_STAGES.reduce<Record<string, ProjectRow[]>>((acc, stage) => {
      acc[stage.id] = rows.filter((project) => getMacroStage(project.stage, project.kind) === stage.id)
      return acc
    }, {})
  }, [rows])

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

    const project = rows.find((row) => row.id === projectId)
    if (!project) return

    const currentMacro = getMacroStage(project.stage, project.kind)
    const nextMacro = MACRO_STAGES.find((stage) => stage.id === overId)?.id ?? currentMacro
    if (currentMacro === nextMacro) return

    const nextDbStage = STAGE_MAPPING[nextMacro]?.[project.kind]
    if (!nextDbStage) return

    // Optimistic update
    setRows((current) =>
      current.map((row) => (row.id === projectId ? { ...row, stage: nextDbStage } : row))
    )

    try {
      const res = await fetch(`/api/market/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextDbStage }),
      })
      if (!res.ok) throw new Error('Erreur de mise à jour')
    } catch {
      toast.error('Erreur lors du déplacement')
      onRefresh()
    }
  }

  const activeProject = useMemo(() => rows.find((row) => row.id === activeId), [activeId, rows])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full w-full gap-4 overflow-x-auto pb-4">
        {MACRO_STAGES.map((stage) => {
          const columnProjects = projectsByStage[stage.id] ?? []
          return (
            <div key={stage.id} className="w-60 shrink-0">
              <div className="mb-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className={cn('size-2.5 rounded-full', stage.color)} />
                  <h2 className="text-sm font-semibold">{stage.label}</h2>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {columnProjects.length}
                </Badge>
              </div>
              <DroppableColumn stage={stage}>
                <SortableContext
                  items={columnProjects.map((project) => project.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {columnProjects.map((project) => (
                    <SortableProjectCard key={project.id} project={project} />
                  ))}
                </SortableContext>
              </DroppableColumn>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeProject ? (
          <div className="rotate-3 scale-105 cursor-grabbing opacity-90 ring-2 ring-primary/30">
            <ProjectCard project={activeProject} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

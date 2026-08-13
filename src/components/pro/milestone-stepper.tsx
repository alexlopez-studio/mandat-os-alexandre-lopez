'use client'

import * as React from 'react'
import {
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileCheck,
  Footprints,
  Handshake,
  Key,
  LayoutList,
  Pencil,
  PenTool,
  Rocket,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { StatusPill } from '@/components/pro/status-pill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type MilestoneItem = {
  id: string
  title: string
  description?: string | null
  status: string // 'done' | 'accepted' | 'pending' | 'todo' | 'blocked' | 'cancelled'
  event_date?: string | null
  visible_to_client?: boolean
}

export type MilestoneStepperProps = {
  items: MilestoneItem[]
  editingId?: string | null
  onUpdateStatus: (id: string, nextStatus: string) => void
  onToggleVisibility?: (id: string, visible: boolean) => void
  onEdit?: (item: MilestoneItem) => void
  onDelete?: (id: string) => void
  formatDate?: (dateStr: string) => string
}

function getMilestoneIcon(title: string) {
  const t = title.toLowerCase()
  if (t.includes('estimation') || t.includes('avis'))
    return { icon: BarChart3, tone: 'brand' as const }
  if (t.includes('mandat') || t.includes('signature'))
    return { icon: PenTool, tone: 'brand' as const }
  if (t.includes('photo') || t.includes('shooting'))
    return { icon: Camera, tone: 'brand' as const }
  if (t.includes('virtuelle') || t.includes('3d'))
    return { icon: Eye, tone: 'brand' as const }
  if (
    t.includes('diffusion') ||
    t.includes('annonce') ||
    t.includes('mise en ligne')
  )
    return { icon: Rocket, tone: 'brand' as const }
  if (t.includes('visite'))
    return { icon: Footprints, tone: 'warning' as const }
  if (t.includes('offre'))
    return { icon: Handshake, tone: 'success' as const }
  if (t.includes('compromis') || t.includes('promesse'))
    return { icon: FileCheck, tone: 'success' as const }
  if (
    t.includes('acte') ||
    t.includes('clé') ||
    t.includes('cles') ||
    t.includes('authentique')
  )
    return { icon: Key, tone: 'warning' as const }
  return { icon: Sparkles, tone: 'neutral' as const }
}

export function MilestoneStepper({
  items,
  editingId,
  onUpdateStatus,
  onToggleVisibility,
  onEdit,
  onDelete,
  formatDate = (d) => d,
}: MilestoneStepperProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [viewMode, setViewMode] = React.useState<'stepper' | 'list'>('stepper')

  const total = items.length
  const completedCount = items.filter(
    (i) => i.status === 'done' || i.status === 'accepted'
  ).length
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0

  // Automatically pick initial active step
  React.useEffect(() => {
    if (items.length === 0) return
    const pendingIdx = items.findIndex(
      (i) => i.status === 'pending' || i.status === 'todo'
    )
    if (pendingIdx !== -1) {
      setSelectedIndex(pendingIdx)
    } else {
      setSelectedIndex(items.length - 1)
    }
  }, [items.length])

  if (total === 0) return null

  const selectedItem = items[selectedIndex] ?? items[0]
  const lastCompletedIndex = items.reduce(
    (acc, item, idx) =>
      item.status === 'done' || item.status === 'accepted' ? idx : acc,
    -1
  )

  const activeProgressWidth =
    total <= 1
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            (Math.max(lastCompletedIndex, selectedIndex) / (total - 1)) * 100
          )
        )

  return (
    <div className="space-y-6">
      {/* Top Header Bar — Spacious & Clean */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Rocket className="size-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">
                Plan de vente — Jalons du projet
              </h3>
              <p className="text-xs font-medium text-muted-foreground">
                {completedCount} sur {total} étape{total > 1 ? 's' : ''} réalisée{total > 1 ? 's' : ''} ({progressPercent}%)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StatusPill tone={progressPercent === 100 ? 'success' : 'brand'} className="h-7 px-3 text-xs font-bold">
            {progressPercent}% accompli
          </StatusPill>

          <div className="flex items-center rounded-xl border border-border bg-muted/30 p-1">
            <Button
              variant={viewMode === 'stepper' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 rounded-lg text-xs font-bold px-3 cursor-pointer shadow-2xs"
              onClick={() => setViewMode('stepper')}
            >
              <Rocket className="mr-1.5 size-3.5" />
              Parcours
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 rounded-lg text-xs font-bold px-3 cursor-pointer shadow-2xs"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="mr-1.5 size-3.5" />
              Liste
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'stepper' ? (
        <div className="space-y-6">
          {/* Spacious Horizontal Stepper Track */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xs overflow-x-auto scrollbar-thin">
            <div className="relative min-w-max px-8 py-4">
              {/* Background Connecting Line */}
              <div className="absolute left-12 right-12 top-10 h-1.5 bg-muted rounded-full z-0" />
              <div
                className="absolute left-12 h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-sky-500 rounded-full z-0 transition-all duration-500"
                style={{
                  width: `calc(${activeProgressWidth}% * (100% - 96px) / 100)`,
                }}
              />

              {/* Stepper Nodes */}
              <div className="flex items-start justify-between gap-10 sm:gap-14 relative z-10">
                {items.map((item, index) => {
                  const isDone =
                    item.status === 'done' || item.status === 'accepted'
                  const isPending = item.status === 'pending'
                  const isSelected = index === selectedIndex
                  const { icon: NodeIcon } = getMilestoneIcon(item.title)

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className="group flex flex-col items-center gap-3 focus:outline-hidden min-w-28 text-center cursor-pointer"
                    >
                      {/* Node Circle */}
                      <div
                        className={cn(
                          'flex size-12 items-center justify-center rounded-2xl text-xs font-bold transition-all duration-300 border-2 bg-card shadow-2xs',
                          isDone &&
                            'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20 shadow-md',
                          isPending &&
                            'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md',
                          !isDone &&
                            !isPending &&
                            'border-border text-muted-foreground group-hover:border-primary/50 group-hover:text-foreground',
                          isSelected &&
                            'ring-4 ring-primary/30 scale-110 border-primary z-20 shadow-lg'
                        )}
                      >
                        {isDone ? (
                          <Check className="size-5 stroke-[3]" />
                        ) : (
                          <NodeIcon className="size-5" />
                        )}
                      </div>

                      {/* Title Only — Uncluttered */}
                      <span
                        className={cn(
                          'block text-xs font-bold truncate max-w-32 transition-colors',
                          isSelected
                            ? 'text-primary font-black'
                            : isDone
                            ? 'text-foreground font-semibold'
                            : 'text-muted-foreground group-hover:text-foreground'
                        )}
                        title={item.title}
                      >
                        {index + 1}. {item.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Active Milestone Inspector Card */}
          {selectedItem && (
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xs space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary text-sm font-black shadow-2xs">
                    #{selectedIndex + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-bold text-foreground">
                        {selectedItem.title}
                      </h4>
                      <StatusPill
                        tone={
                          selectedItem.status === 'done' ||
                          selectedItem.status === 'accepted'
                            ? 'success'
                            : selectedItem.status === 'pending'
                            ? 'brand'
                            : 'neutral'
                        }
                        className="h-5 px-2.5 text-xs font-semibold"
                      >
                        {selectedItem.status === 'done' ||
                        selectedItem.status === 'accepted'
                          ? '✓ Terminé'
                          : selectedItem.status === 'pending'
                          ? '⏳ En cours'
                          : 'À venir'}
                      </StatusPill>

                      {selectedItem.visible_to_client ? (
                        <Badge
                          variant="outline"
                          className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold text-xs gap-1"
                        >
                          <Eye className="size-3 text-sky-600" /> Visible client
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-border bg-muted/30 text-muted-foreground font-semibold text-xs gap-1"
                        >
                          <EyeOff className="size-3 text-muted-foreground" /> Interne
                        </Badge>
                      )}
                    </div>
                    {selectedItem.event_date && (
                      <p className="text-xs font-medium text-muted-foreground">
                        Date cible / réalisation : {formatDate(selectedItem.event_date)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Navigation Between Nodes */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl px-3 text-xs font-semibold border-border bg-card hover:bg-accent cursor-pointer"
                    disabled={selectedIndex === 0}
                    onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl px-3 text-xs font-semibold border-border bg-card hover:bg-accent cursor-pointer"
                    disabled={selectedIndex === total - 1}
                    onClick={() =>
                      setSelectedIndex((prev) => Math.min(total - 1, prev + 1))
                    }
                  >
                    Suivant
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Description & Consignes du jalon
                </span>
                <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/50">
                  {selectedItem.description?.trim() ||
                    "Aucune note complémentaire n'a été rédigée pour cette étape."}
                </p>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 pt-5">
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-10 rounded-xl px-4 text-xs font-bold shadow-2xs cursor-pointer',
                      selectedItem.status === 'done' ||
                        selectedItem.status === 'accepted'
                        ? 'text-muted-foreground border-border bg-card'
                        : 'text-emerald-700 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                    )}
                    onClick={() =>
                      onUpdateStatus(
                        selectedItem.id,
                        selectedItem.status === 'done' ||
                          selectedItem.status === 'accepted'
                          ? 'todo'
                          : 'done'
                      )
                    }
                  >
                    <CheckCircle2 className="mr-2 size-4 text-emerald-600" />
                    {selectedItem.status === 'done' ||
                    selectedItem.status === 'accepted'
                      ? 'Marquer à faire'
                      : 'Valider cette étape'}
                  </Button>

                  {onToggleVisibility && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-xl px-3.5 text-xs font-semibold border-border bg-card hover:bg-accent cursor-pointer"
                      onClick={() =>
                        onToggleVisibility(
                          selectedItem.id,
                          !selectedItem.visible_to_client
                        )
                      }
                    >
                      {selectedItem.visible_to_client ? (
                        <>
                          <EyeOff className="mr-1.5 size-4 text-muted-foreground" /> Masquer du client
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1.5 size-4 text-sky-600" /> Rendre visible client
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-xl px-3 text-xs font-semibold cursor-pointer"
                      onClick={() => onEdit(selectedItem)}
                    >
                      <Pencil className="mr-1.5 size-3.5" />
                      Modifier
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-xl px-3 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => onDelete(selectedItem.id)}
                    >
                      <Trash2 className="mr-1.5 size-3.5" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Classic Vertical List View Mode */
        <div className="space-y-3.5">
          {items.map((item, index) => {
            const isDone =
              item.status === 'done' || item.status === 'accepted'
            const isPending = item.status === 'pending'
            const { icon: MilestoneIcon } = getMilestoneIcon(item.title)

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-2xl border bg-card p-5 shadow-2xs transition-all flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
                  isDone && 'border-emerald-500/30 bg-emerald-500/5',
                  isPending && 'border-primary/40 bg-primary/5'
                )}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold shrink-0">
                      <MilestoneIcon className="size-4" />
                    </div>
                    <span className="font-bold text-sm text-foreground">
                      {index + 1}. {item.title}
                    </span>
                    <StatusPill
                      tone={isDone ? 'success' : isPending ? 'brand' : 'neutral'}
                      className="h-5 px-2 text-[10px]"
                    >
                      {isDone ? '✓ Terminé' : isPending ? '⏳ En cours' : 'À venir'}
                    </StatusPill>

                    {item.visible_to_client ? (
                      <Badge
                        variant="outline"
                        className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold text-xs"
                      >
                        Visible client
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-border bg-muted/30 text-muted-foreground font-semibold text-xs"
                      >
                        Interne
                      </Badge>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-semibold rounded-xl px-3 border-border bg-card hover:bg-accent cursor-pointer"
                    onClick={() =>
                      onUpdateStatus(item.id, isDone ? 'todo' : 'done')
                    }
                  >
                    <CheckCircle2 className="mr-1.5 size-3.5 text-emerald-600" />
                    {isDone ? 'Marquer à faire' : 'Valider'}
                  </Button>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-xl cursor-pointer"
                      onClick={() => onEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

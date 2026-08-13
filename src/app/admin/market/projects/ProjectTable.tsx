'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KanbanIcon, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, type ViewMode } from '@/components/pro'
import {
  projectDetailHref,
  type ProjectRow,
} from '@/lib/project-stages'
import { cn } from '@/lib/utils'

type ProjectTableProps = {
  projects: ProjectRow[]
  hasFilters: boolean
  onResetFilters: () => void
  /** Le mode kanban est rendu par ProjectKanbanBoard, jamais par ce composant. */
  viewMode?: ViewMode
  /** Selection multiple de la vue tableau. Omise, la colonne de cases disparait. */
  selectedIds?: string[]
  onToggleSelect?: (projectId: string) => void
  onToggleSelectAll?: () => void
}

function formatDueDate(dueDateStr: string | null | undefined) {
  if (!dueDateStr) return <span className="text-muted-foreground font-normal">—</span>
  try {
    const d = new Date(dueDateStr)
    if (isNaN(d.getTime())) return dueDateStr
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(d)
    target.setHours(0, 0, 0, 0)
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Aujourd’hui'
    if (diffDays === 1) return 'Demain'
    if (diffDays > 1 && diffDays <= 7) return 'Cette semaine'
    if (diffDays < 0) return <span className="text-destructive font-bold">En retard</span>
    
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch {
    return dueDateStr
  }
}

export function ProjectTable({
  projects,
  hasFilters,
  onResetFilters,
  viewMode = 'cards',
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ProjectTableProps) {
  const router = useRouter()
  const selectable = Boolean(selectedIds && onToggleSelect && onToggleSelectAll)
  const allSelected =
    selectable && projects.length > 0 && projects.every((project) => selectedIds!.includes(project.id))

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={KanbanIcon}
        title="Aucun projet trouvé"
        description={
          hasFilters
            ? 'Modifiez la recherche ou les filtres pour élargir les résultats.'
            : 'Créez votre premier projet pour alimenter le pipeline.'
        }
        action={
          hasFilters ? (
            <Button variant="outline" onClick={onResetFilters} className="rounded-full">
              Réinitialiser les filtres
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <Link href="/admin/market/projects/nouveau">Nouveau projet</Link>
            </Button>
          )
        }
      />
    )
  }

  if (viewMode === 'cards') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const href = projectDetailHref(project)
          const title = project.display_title ?? project.title
          const contacts = project.contacts ?? []
          const priority = (project.priority || '').toLowerCase()

          return (
            <div
              key={project.id}
              onClick={href ? () => router.push(href) : undefined}
              className="rounded-2xl border bg-card p-5 shadow-xs hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold uppercase text-[10px] tracking-wider px-2.5 py-0.5 rounded-full border-none shadow-none",
                      project.kind === 'vente'
                        ? "bg-sky-100 text-sky-700"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    PROJET {project.kind === 'achat' ? 'ACHAT' : 'VENTE'}
                  </Badge>

                  <Badge
                    variant="secondary"
                    className="font-bold text-xs bg-primary/10 text-primary border-none rounded-full px-2.5 py-0.5"
                  >
                    {project.stage || 'Projet'}
                  </Badge>
                </div>

                {/* Titre : la commune y figure deja, la reference identifie. */}
                <div>
                  <h3 className="text-base font-bold text-foreground line-clamp-1 hover:text-primary transition-colors">
                    {title}
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground tabular-nums mt-0.5">
                    {project.reference ?? '—'}
                  </p>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-3 border-t flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Contacts Avatars */}
                  {contacts.length > 0 ? (
                    <div className="flex items-center -space-x-2">
                      {contacts.slice(0, 3).map((c, i) => {
                        const nameParts = c.name.split(' ').filter(Boolean)
                        const initials = nameParts.length >= 2 
                          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                          : c.name.slice(0, 2).toUpperCase()
                        const colors = [
                          'bg-sky-600 text-sky-50',
                          'bg-slate-700 text-slate-50',
                          'bg-amber-700 text-amber-50',
                          'bg-emerald-700 text-emerald-50',
                        ]
                        return (
                          <div
                            key={c.id || i}
                            title={`${c.name}${c.role ? ` (${c.role})` : ''}`}
                            className={cn(
                              "size-7 flex items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card shadow-xs",
                              colors[i % colors.length]
                            )}
                          >
                            {initials}
                          </div>
                        )
                      })}
                      {contacts.length > 3 && (
                        <div className="size-7 flex items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold ring-2 ring-card">
                          +{contacts.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Aucun contact</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {priority === 'haute' || priority === 'high' ? (
                    <Badge variant="destructive" className="text-[10px] font-bold rounded-full">Urgent</Badge>
                  ) : null}
                  <Button variant="ghost" size="sm" className="text-xs font-semibold text-primary hover:text-primary/80 p-0 h-auto">
                    Ouvrir <ChevronRight className="ml-0.5 size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
            {selectable ? (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleSelectAll}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
            ) : null}
            <TableHead className="w-24 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              RÉF.
            </TableHead>
            {/* La commune fait desormais partie du titre : pas de sous-ligne. */}
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              PROJET
            </TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              TYPE
            </TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              CONTACTS
            </TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              ÉTAPE
            </TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              PROCHAINE ACTION
            </TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              ÉCHÉANCE
            </TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              PRIORITÉ
            </TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const href = projectDetailHref(project)
            const title = project.display_title ?? project.title
            const contacts = project.contacts ?? []
            const priority = (project.priority || '').toLowerCase()

            return (
              <TableRow
                key={project.id}
                data-state={selectable && selectedIds!.includes(project.id) ? 'selected' : undefined}
                onClick={href ? () => router.push(href) : undefined}
                className={cn('transition-colors hover:bg-muted/30', href && 'cursor-pointer')}
              >
                {selectable ? (
                  <TableCell className="py-4" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds!.includes(project.id)}
                      onCheckedChange={() => onToggleSelect!(project.id)}
                      aria-label={`Sélectionner ${title}`}
                    />
                  </TableCell>
                ) : null}

                {/* RÉF. */}
                <TableCell className="py-4">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {project.reference ?? '—'}
                  </span>
                </TableCell>

                {/* PROJET */}
                <TableCell className="py-4">
                  <div className="flex flex-col min-w-0 max-w-xs">
                    {href ? (
                      <Link
                        href={href}
                        className="truncate font-bold text-foreground hover:text-primary transition-colors text-sm"
                        onClick={(event) => event.stopPropagation()}
                        title={title}
                      >
                        {title}
                      </Link>
                    ) : (
                      <span className="truncate font-bold text-foreground text-sm" title={title}>
                        {title}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* TYPE */}
                <TableCell className="py-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold uppercase text-[10px] tracking-wider px-2.5 py-0.5 rounded-full border-none shadow-none",
                      project.kind === 'vente'
                        ? "bg-sky-100 text-sky-700"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {project.kind}
                  </Badge>
                </TableCell>

                {/* CONTACTS */}
                <TableCell className="py-4">
                  {contacts.length > 0 ? (
                    <div className="flex items-center -space-x-2 overflow-hidden">
                      {contacts.slice(0, 3).map((c, i) => {
                        const nameParts = c.name.split(' ').filter(Boolean)
                        const initials = nameParts.length >= 2 
                          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                          : c.name.slice(0, 2).toUpperCase()
                        const bgColors = [
                          'bg-sky-600 text-white',
                          'bg-slate-700 text-white',
                          'bg-amber-700 text-white',
                          'bg-emerald-700 text-white',
                        ]
                        const colorClass = bgColors[i % bgColors.length]
                        return (
                          <div
                            key={c.id || i}
                            title={`${c.name}${c.role ? ` (${c.role})` : ''}`}
                            className={cn(
                              "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-background shadow-none",
                              colorClass
                            )}
                          >
                            {initials}
                          </div>
                        )
                      })}
                      {contacts.length > 3 && (
                        <div className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold ring-2 ring-background">
                          +{contacts.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* ÉTAPE */}
                <TableCell className="py-4 text-sm font-semibold text-primary whitespace-nowrap">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none rounded-full px-2.5 py-0.5 text-xs font-bold">
                    {project.stage || '—'}
                  </Badge>
                </TableCell>

                {/* PROCHAINE ACTION */}
                <TableCell className="py-4 text-sm text-muted-foreground max-w-xs truncate">
                  {project.next_action || '—'}
                </TableCell>

                {/* ÉCHÉANCE */}
                <TableCell className="py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                  {formatDueDate(project.due_date)}
                </TableCell>

                {/* PRIORITÉ */}
                <TableCell className="py-4 whitespace-nowrap">
                  {priority === 'haute' || priority === 'high' ? (
                    <span className="text-xs font-bold text-destructive uppercase tracking-wider">HAUTE</span>
                  ) : priority === 'moyenne' || priority === 'medium' ? (
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">MOYENNE</span>
                  ) : priority === 'basse' || priority === 'low' ? (
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">BASSE</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* ACTION ICON */}
                <TableCell className="py-4 text-right">
                  {href ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

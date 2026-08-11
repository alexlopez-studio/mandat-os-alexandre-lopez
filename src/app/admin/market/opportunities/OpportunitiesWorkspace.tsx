'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Home, Search, Layers, Archive, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BulkActionBar,
  ConfirmDialog,
  DataToolbar,
  LoadingState,
  PageHeader,
  PageLayout,
  PageSection,
  SearchInput,
  ViewModeToggle,
  type ViewMode,
} from '@/components/pro'
import { ProjectTable } from './ProjectTable'
import { ProjectKanbanBoard } from './ProjectKanbanBoard'
import {
  type ProjectKind,
  type ProjectRow,
} from '@/lib/project-stages'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Projets actifs' },
  { value: 'paused', label: 'Archivés / En pause' },
  { value: 'all', label: 'Tous les statuts' },
]

type WorkspaceTab = ProjectKind | 'all'

export function OpportunitiesWorkspace() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<WorkspaceTab>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkRunning, setBulkRunning] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const kindFilter: ProjectKind | 'all' = tab

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ search, kind: kindFilter, active: statusFilter })
      const res = await fetch(`/api/market/projects?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chargement impossible')
      setProjects(data.projects ?? [])
    } catch (error) {
      console.error('Erreur chargement projets', error)
      toast.error('Impossible de charger les projets')
    } finally {
      setLoading(false)
    }
  }, [search, kindFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadProjects])

  const hasFilters = search !== '' || statusFilter !== 'active' || kindFilter !== 'all'

  const resetFilters = () => {
    setSearch('')
    setTab('all')
    setStatusFilter('active')
  }

  const clearSelection = useCallback(() => setSelectedIds([]), [])

  // Un changement d'onglet ou de filtre recharge la liste : garder des cases
  // cochees sur des lignes disparues rendrait l'action groupee imprevisible.
  useEffect(() => {
    clearSelection()
  }, [tab, search, statusFilter, clearSelection])

  const visibleIds = useMemo(() => projects.map((project) => project.id), [projects])
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((id) => selectedIds.includes(id)),
    [visibleIds, selectedIds]
  )

  const toggleSelected = (projectId: string) => {
    setSelectedIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    )
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedVisibleIds.length === visibleIds.length ? [] : visibleIds)
  }

  const applyBulkActive = async (active: boolean) => {
    if (selectedVisibleIds.length === 0) return
    setBulkRunning(true)
    try {
      const results = await Promise.all(
        selectedVisibleIds.map((id) =>
          fetch(`/api/market/projects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active }),
          })
            .then((res) => res.ok)
            .catch(() => false)
        )
      )
      const failed = results.filter((ok) => !ok).length
      const done = results.length - failed
      const verb = active ? 'restauré' : 'archivé'
      if (done > 0) toast.success(`${done} projet${done > 1 ? 's' : ''} ${verb}${done > 1 ? 's' : ''}`)
      if (failed > 0)
        toast.error(`${failed} projet${failed > 1 ? 's' : ''} n’${failed > 1 ? 'ont' : 'a'} pas pu être mis à jour`)
      clearSelection()
      await loadProjects()
    } finally {
      setBulkRunning(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedVisibleIds.length === 0) return
    setBulkRunning(true)
    try {
      const results = await Promise.all(
        selectedVisibleIds.map((id) =>
          fetch(`/api/market/projects/${id}`, { method: 'DELETE' })
            .then((res) => res.ok)
            .catch(() => false)
        )
      )
      const failed = results.filter((ok) => !ok).length
      const done = results.length - failed
      if (done > 0) toast.success(`${done} projet${done > 1 ? 's' : ''} supprimé${done > 1 ? 's' : ''}`)
      if (failed > 0)
        toast.error(`${failed} projet${failed > 1 ? 's' : ''} n’${failed > 1 ? 'ont' : 'a'} pas pu être supprimé${failed > 1 ? 's' : ''}`)
      setDeleteDialogOpen(false)
      clearSelection()
      await loadProjects()
    } finally {
      setBulkRunning(false)
    }
  }

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Pipeline"
        title="Projets"
        description="Le cycle complet d’une affaire : de l’opportunité au mandat signé, côté vendeurs et acquéreurs."
        actions={
          <Button asChild className="rounded-full font-semibold shadow-xs h-9">
            <Link
              href={kindFilter === 'achat' ? '/admin/market/opportunities/nouveau?kind=achat' : '/admin/market/opportunities/nouveau?kind=vente'}
            >
              <Plus className="mr-2 size-4" />
              Nouveau projet
            </Link>
          </Button>
        }
      />

      <PageSection>
        <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as WorkspaceTab)
        }}
        className="space-y-6"
        >
        <TabsList variant="pill" className="w-full justify-start lg:w-auto inline-flex">
          <TabsTrigger value="all" className="text-sm font-bold px-5">
            <Layers className="mr-2 h-4 w-4" /> Tout
          </TabsTrigger>
          <TabsTrigger value="vente" className="text-sm font-bold px-5">
            <Home className="mr-2 h-4 w-4" /> Ventes
          </TabsTrigger>
          <TabsTrigger value="achat" className="text-sm font-bold px-5">
            <Search className="mr-2 h-4 w-4" /> Achats
          </TabsTrigger>
        </TabsList>

        <DataToolbar
          variant="pill"
          filters={
            <>
              <div className="mr-auto w-full sm:w-auto">
                <SearchInput
                  label="Rechercher"
                  placeholder="Rechercher un projet, une commune ou un contact…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="rounded-full bg-secondary/50 border-none h-9 w-full"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-48 rounded-full bg-secondary/50 border-none text-xs font-semibold">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ViewModeToggle
                value={viewMode}
                modes={['table', 'kanban', 'cards']}
                onChange={(mode) => {
                  setViewMode(mode)
                  if (mode !== 'table') clearSelection()
                }}
              />
            </>
          }
        />

        {viewMode === 'table' ? (
          <BulkActionBar
            count={selectedVisibleIds.length}
            noun="projet"
            busy={bulkRunning}
            onClear={clearSelection}
          >
            {statusFilter !== 'active' ? (
              <Button
                variant="outline"
                size="sm"
                disabled={bulkRunning}
                onClick={() => applyBulkActive(true)}
                className="h-8 rounded-full text-xs font-semibold"
              >
                <RotateCcw className="mr-2 size-3.5" aria-hidden="true" />
                Restaurer
              </Button>
            ) : null}
            {statusFilter !== 'paused' ? (
              <Button
                variant="outline"
                size="sm"
                disabled={bulkRunning}
                onClick={() => applyBulkActive(false)}
                className="h-8 rounded-full text-xs font-semibold"
              >
                <Archive className="mr-2 size-3.5" aria-hidden="true" />
                Archiver
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={bulkRunning}
              onClick={() => setDeleteDialogOpen(true)}
              className="h-8 rounded-full text-xs font-semibold text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" aria-hidden="true" />
              Supprimer
            </Button>
          </BulkActionBar>
        ) : null}

        {loading && projects.length === 0 ? (
          <LoadingState variant="table" rows={6} label="Chargement des projets" />
        ) : viewMode === 'kanban' ? (
          <ProjectKanbanBoard projects={projects} onRefresh={loadProjects} />
        ) : (
          <ProjectTable
            projects={projects}
            hasFilters={hasFilters}
            onResetFilters={resetFilters}
            viewMode={viewMode}
            selectedIds={viewMode === 'table' ? selectedIds : undefined}
            onToggleSelect={viewMode === 'table' ? toggleSelected : undefined}
            onToggleSelectAll={viewMode === 'table' ? toggleSelectAll : undefined}
          />
        )}

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={`Supprimer ${selectedVisibleIds.length} projet${selectedVisibleIds.length > 1 ? 's' : ''} ?`}
          description="Cette action est définitive. L’historique d’activité, les notes et les rattachements de contacts de ces projets seront supprimés avec eux. Les contacts eux-mêmes sont conservés. Pour retirer un projet du pipeline sans rien perdre, utilisez plutôt Archiver."
          confirmLabel="Supprimer définitivement"
          destructive
          busy={bulkRunning}
          onConfirm={handleBulkDelete}
        />
        </Tabs>
      </PageSection>
    </PageLayout>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, Plus, Search, Table2, Home, User, Briefcase } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProjectKanbanBoard } from './ProjectKanbanBoard'
import { ProjectTable } from './ProjectTable'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ViewMode = 'kanban' | 'table'

function isViewMode(value: string | null): value is ViewMode {
  return value === 'kanban' || value === 'table'
}

export function OpportunitiesWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [view, setView] = useState<ViewMode>(() => {
    const value = searchParams.get('view')
    return isViewMode(value) ? value : 'kanban'
  })
  
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('all') // 'all' | 'vente' | 'achat'
  const [activeFilter, setActiveFilter] = useState('active') // 'all' | 'active' | 'paused'

  useEffect(() => {
    const nextView = searchParams.get('view')
    if (isViewMode(nextView)) setView(nextView)
  }, [searchParams])

  const query = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    return params.toString()
  }, [searchParams, view])

  useEffect(() => {
    if (searchParams.toString() === query) return
    router.replace(`/app/opportunities?${query}`, { scroll: false })
  }, [query, router, searchParams])

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Unified Search and Filters */}
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet, un contact..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          <ToggleGroup type="single" value={kindFilter} onValueChange={(v) => v && setKindFilter(v)} className="bg-card border rounded-md p-0.5">
            <ToggleGroupItem value="all" aria-label="Tous les projets" className="px-3">
              <Briefcase className="mr-2 h-4 w-4" />
              Tous
            </ToggleGroupItem>
            <ToggleGroupItem value="vente" aria-label="Ventes" className="px-3 text-blue-600 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-900 dark:data-[state=on]:bg-blue-900/30">
              <Home className="mr-2 h-4 w-4" />
              Ventes
            </ToggleGroupItem>
            <ToggleGroupItem value="achat" aria-label="Acquéreurs" className="px-3 text-emerald-600 data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-900 dark:data-[state=on]:bg-emerald-900/30">
              <User className="mr-2 h-4 w-4" />
              Acquéreurs
            </ToggleGroupItem>
          </ToggleGroup>

          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-[140px] bg-card">
              <SelectValue placeholder="Activité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="paused">En pause</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Toggle & Add Button */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-border bg-muted p-1">
            <Button
              type="button"
              variant={view === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="mr-1 h-4 w-4" />
              Kanban
            </Button>
            <Button
              type="button"
              variant={view === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('table')}
            >
              <Table2 className="mr-1 h-4 w-4" />
              Liste
            </Button>
          </div>

          <Button asChild>
            <Link href={kindFilter === 'achat' ? '/app/acheteurs/nouveau' : '/app/opportunities/nouveau'}>
              <Plus className="mr-1 h-4 w-4" />
              {kindFilter === 'achat' ? 'Nouvel acquéreur' : 'Nouveau projet'}
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-4 h-[calc(100vh-220px)] w-full">
        {view === 'kanban' ? (
          <ProjectKanbanBoard search={search} kindFilter={kindFilter} activeFilter={activeFilter} />
        ) : (
          <ProjectTable search={search} kindFilter={kindFilter} activeFilter={activeFilter} />
        )}
      </div>
    </div>
  )
}

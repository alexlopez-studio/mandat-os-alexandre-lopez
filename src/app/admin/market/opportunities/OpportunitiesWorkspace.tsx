'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarClock, LayoutGrid, Plus, Search, SlidersHorizontal, Table2, ToggleLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BuyerKanbanBoard } from './BuyerKanbanBoard'
import { BuyerOpportunityTable } from './BuyerOpportunityTable'
import { KanbanBoard } from './KanbanBoard'
import { SellerOpportunityTable } from './SellerOpportunityTable'

type PipelineTab = 'vendeurs' | 'acquereurs'
type ViewMode = 'kanban' | 'table'
type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_due'
type ActiveFilter = 'all' | 'active' | 'paused'

function isPipelineTab(value: string | null): value is PipelineTab {
  return value === 'vendeurs' || value === 'acquereurs'
}

function isViewMode(value: string | null): value is ViewMode {
  return value === 'kanban' || value === 'table'
}

export function OpportunitiesWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<PipelineTab>(() => {
    const value = searchParams.get('tab')
    return isPipelineTab(value) ? value : 'vendeurs'
  })
  const [view, setView] = useState<ViewMode>(() => {
    const value = searchParams.get('view')
    return isViewMode(value) ? value : 'kanban'
  })
  const [sellerSearch, setSellerSearch] = useState('')
  const [sellerStageFilter, setSellerStageFilter] = useState('all')
  const [sellerDueFilter, setSellerDueFilter] = useState<DueFilter>('all')
  const [buyerSearch, setBuyerSearch] = useState('')
  const [buyerStageFilter, setBuyerStageFilter] = useState('all')
  const [buyerActiveFilter, setBuyerActiveFilter] = useState<ActiveFilter>('all')
  const [buyerDueFilter, setBuyerDueFilter] = useState<DueFilter>('all')

  useEffect(() => {
    const nextTab = searchParams.get('tab')
    const nextView = searchParams.get('view')
    if (isPipelineTab(nextTab)) setTab(nextTab)
    if (isViewMode(nextView)) setView(nextView)
  }, [searchParams])

  const query = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    params.set('view', view)
    return params.toString()
  }, [searchParams, tab, view])

  useEffect(() => {
    if (searchParams.toString() === query) return
    router.replace(`/app/opportunities?${query}`, { scroll: false })
  }, [query, router, searchParams])

  const createHref = tab === 'vendeurs' ? '/app/opportunities/nouveau' : '/app/acheteurs/nouveau'
  const createLabel = tab === 'vendeurs' ? 'Nouveau vendeur' : 'Nouvel acquéreur'

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as PipelineTab)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="vendeurs">Vendeurs</TabsTrigger>
        <TabsTrigger value="acquereurs">Acquéreurs</TabsTrigger>
      </TabsList>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full rounded-md border border-border bg-muted p-1 sm:w-auto">
          <Button
            type="button"
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="mr-1 h-4 w-4" />
            Kanban
          </Button>
          <Button
            type="button"
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setView('table')}
          >
            <Table2 className="mr-1 h-4 w-4" />
            Tableau
          </Button>
        </div>

        <Button asChild className="w-full sm:w-auto">
          <Link href={createHref}>
            <Plus className="mr-1 h-4 w-4" />
            {createLabel}
          </Link>
        </Button>
      </div>

      {tab === 'vendeurs' ? (
        <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-sm lg:grid-cols-[minmax(260px,1fr)_220px_190px]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un vendeur, une commune..."
              value={sellerSearch}
              onChange={(event) => setSellerSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sellerStageFilter} onValueChange={setSellerStageFilter}>
            <SelectTrigger>
              <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {sellerStages.map((stage) => (
                <SelectItem key={stage} value={stage}>{stage}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sellerDueFilter} onValueChange={(value) => setSellerDueFilter(value as DueFilter)}>
            <SelectTrigger>
              <CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Échéance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes échéances</SelectItem>
              <SelectItem value="overdue">En retard</SelectItem>
              <SelectItem value="today">Aujourd’hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="no_due">Sans échéance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-sm xl:grid-cols-[minmax(260px,1fr)_220px_180px_190px]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un acquéreur, une commune..."
              value={buyerSearch}
              onChange={(event) => setBuyerSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={buyerStageFilter} onValueChange={setBuyerStageFilter}>
            <SelectTrigger>
              <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {buyerStages.map((stage) => (
                <SelectItem key={stage} value={stage}>{stage}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={buyerActiveFilter} onValueChange={(value) => setBuyerActiveFilter(value as ActiveFilter)}>
            <SelectTrigger>
              <ToggleLeft className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Activité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="paused">En pause</SelectItem>
            </SelectContent>
          </Select>
          <Select value={buyerDueFilter} onValueChange={(value) => setBuyerDueFilter(value as DueFilter)}>
            <SelectTrigger>
              <CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Échéance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes échéances</SelectItem>
              <SelectItem value="overdue">En retard</SelectItem>
              <SelectItem value="today">Aujourd’hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="no_due">Sans échéance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <TabsContent value="vendeurs">
        {view === 'kanban' ? (
          <KanbanBoard search={sellerSearch} stageFilter={sellerStageFilter} dueFilter={sellerDueFilter} />
        ) : (
          <SellerOpportunityTable search={sellerSearch} stageFilter={sellerStageFilter} dueFilter={sellerDueFilter} />
        )}
      </TabsContent>
      <TabsContent value="acquereurs">
        {view === 'kanban' ? (
          <BuyerKanbanBoard
            search={buyerSearch}
            stageFilter={buyerStageFilter}
            activeFilter={buyerActiveFilter}
            dueFilter={buyerDueFilter}
          />
        ) : (
          <BuyerOpportunityTable
            search={buyerSearch}
            stageFilter={buyerStageFilter}
            activeFilter={buyerActiveFilter}
            dueFilter={buyerDueFilter}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}

const sellerStages = [
  'Veille annonce',
  'Nouveau contact',
  'Pré-estimation',
  "Visite d'estimation",
  "Remise de l'estimation",
  'Décision vendeur',
  'Suivi moyen terme',
  'Mandat signé',
  'Vendu',
  'Perdu / Écarté',
]

const buyerStages = [
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

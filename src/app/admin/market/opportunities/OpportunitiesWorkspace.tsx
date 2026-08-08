'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Home, Search, Layers, LayoutGrid, List, Mail, Loader2 } from 'lucide-react'
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
  DataToolbar,
  LoadingState,
  PageHeader,
  PageLayout,
  PageSection,
  SearchInput,
  StatusPill,
} from '@/components/pro'
import { ProjectTable } from './ProjectTable'
import { BuyerLeadCandidates } from './BuyerLeadCandidates'
import {
  type ProjectKind,
  type ProjectRow,
} from '@/lib/project-stages'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Projets actifs' },
  { value: 'paused', label: 'Archivés / En pause' },
  { value: 'all', label: 'Tous les statuts' },
]

type WorkspaceTab = ProjectKind | 'all' | 'candidats'

export function OpportunitiesWorkspace() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<WorkspaceTab>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scanningEmails, setScanningEmails] = useState(false)
  const [pendingCandidates, setPendingCandidates] = useState(0)

  // L'onglet des candidats ne filtre pas des projets : il affiche une autre
  // source. Le filtre `kind` en est donc dérivé, pas confondu avec lui.
  const kindFilter: ProjectKind | 'all' = tab === 'candidats' ? 'all' : tab

  const loadProjects = useCallback(async () => {
    if (tab === 'candidats') return
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
  }, [search, kindFilter, statusFilter, tab])

  const handleScanEmails = async () => {
    setScanningEmails(true)
    try {
      const res = await fetch('/api/cron/scan-emails', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors du scan')

      if (data.degraded) {
        // Le modèle n'a pas répondu : l'extraction est retombée sur les motifs.
        // Le dire ici évite d'attribuer à l'IA une file de mauvaise qualité.
        toast.warning('Scan terminé en mode dégradé : clé IA indisponible, extraction par motifs.')
      }

      if (data.candidateCount > 0) {
        toast.success(`${data.candidateCount} demande(s) d’acquéreur à valider.`)
        setTab('candidats')
      } else {
        toast.info(
          `Scan terminé : aucune nouvelle demande (${data.totalFound || 0} e-mail(s) examiné(s), ${data.discardedCount || 0} écarté(s)).`,
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de scanner la boîte Gmail')
    } finally {
      setScanningEmails(false)
    }
  }

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

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Pipeline"
        title="Projets"
        description="Le cycle complet d’une affaire : de l’opportunité au mandat signé, côté vendeurs et acquéreurs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScanEmails}
              disabled={scanningEmails}
              className="rounded-full font-semibold h-9"
              title="Scanner les demandes d'acquéreurs depuis vos e-mails Gmail (SeLoger, Leboncoin, etc.)"
            >
              {scanningEmails ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Mail className="mr-2 size-4 text-primary" />
              )}
              Scanner les e-mails
            </Button>
            <Button asChild className="rounded-full font-semibold shadow-xs h-9">
              <Link
                href={kindFilter === 'achat' ? '/admin/market/opportunities/nouveau?kind=achat' : '/admin/market/opportunities/nouveau?kind=vente'}
              >
                <Plus className="mr-2 size-4" />
                Nouveau projet
              </Link>
            </Button>
          </div>
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
            <TabsTrigger value="candidats" className="text-sm font-bold px-5">
              <Mail className="mr-2 h-4 w-4" /> Candidats e-mail
              {pendingCandidates > 0 ? (
                <StatusPill tone="brand" className="ml-2">{pendingCandidates}</StatusPill>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {tab === 'candidats' ? (
            <BuyerLeadCandidates onPendingCountChange={setPendingCandidates} />
          ) : (
          <>
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

                {/* View Switcher Toggle */}
                <div className="flex items-center gap-1 rounded-full bg-secondary/50 p-1">
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className="h-7 rounded-full px-3 text-xs font-bold"
                  >
                    <LayoutGrid className="mr-1.5 size-3.5" /> Cartes
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="h-7 rounded-full px-3 text-xs font-bold"
                  >
                    <List className="mr-1.5 size-3.5" /> Tableau
                  </Button>
                </div>
              </>
            }
          />

          {loading && projects.length === 0 ? (
            <LoadingState variant="table" rows={6} label="Chargement des projets" />
          ) : (
            <ProjectTable
              projects={projects}
              hasFilters={hasFilters}
              onResetFilters={resetFilters}
              viewMode={viewMode}
            />
          )}
          </>
          )}
        </Tabs>
      </PageSection>
    </PageLayout>
  )
}

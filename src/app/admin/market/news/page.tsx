'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ExternalLink, Inbox, Layers, MailPlus, MoreHorizontal, Newspaper, RefreshCw, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DataToolbar,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PageLayout,
  PageSection,
  SearchInput,
  StatusPill,
} from '@/components/pro'
import {
  NEWS_CATEGORIES,
  NEWS_CATEGORY_META,
  NEWS_STATUS_META,
  type NewsCategory,
  type NewsItem,
  type NewsStatus,
  type NewsStatusCounts,
} from '@/lib/news-types'

import { CreateAngleDialog } from './CreateAngleDialog'

const EMPTY_COUNTS: NewsStatusCounts = {
  new: 0,
  reviewed: 0,
  newsletter: 0,
  published: 0,
  archived: 0,
}

const ALL_CATEGORY_VALUE = 'all'

type StatusTab = 'inbox' | 'newsletter' | 'all' | 'archived'

const STATUS_TABS: { value: StatusTab; label: string; icon: LucideIcon }[] = [
  { value: 'inbox', label: 'À trier', icon: Inbox },
  { value: 'newsletter', label: 'Newsletter', icon: MailPlus },
  { value: 'all', label: 'Tous', icon: Layers },
  { value: 'archived', label: 'Archivés', icon: Archive },
]

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<NewsCategory | typeof ALL_CATEGORY_VALUE>(ALL_CATEGORY_VALUE)
  const [statusTab, setStatusTab] = useState<StatusTab>('inbox')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [statusCounts, setStatusCounts] = useState<NewsStatusCounts>(EMPTY_COUNTS)
  const [angleItem, setAngleItem] = useState<NewsItem | null>(null)

  const loadItems = useCallback(async (query: string, cat: string, status: StatusTab) => {
    try {
      setLoading(true)
      setError(false)
      const params = new URLSearchParams({ q: query, status, limit: '200' })
      if (cat !== ALL_CATEGORY_VALUE) params.set('category', cat)
      const res = await fetch(`/api/market/news?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch news')
      const json = await res.json()
      setItems(json.items ?? [])
      setStatusCounts(json.counts ?? EMPTY_COUNTS)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadItems(search, category, statusTab)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, category, statusTab, loadItems])

  const changeStatus = async (item: NewsItem, status: NewsStatus) => {
    setUpdatingId(item.id)
    try {
      const res = await fetch(`/api/market/news/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Update failed')
      toast.success(`${NEWS_STATUS_META[status].label}`)
      await loadItems(search, category, statusTab)
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setUpdatingId(null)
    }
  }

  // Agregats renvoyes par l'API : les deriver de `items` donnait 0 sur tous les
  // onglets autres que celui affiche, puisque la liste ne contient qu'un statut.
  const counts = useMemo(
    () => ({
      inbox: statusCounts.new + statusCounts.reviewed,
      newsletter: statusCounts.newsletter,
      all:
        statusCounts.new +
        statusCounts.reviewed +
        statusCounts.newsletter +
        statusCounts.published,
      archived: statusCounts.archived,
    }),
    [statusCounts],
  )

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Veille"
        title="Veille immobilière"
        description="L'actu marché, réglementation et premium moissonnée chaque jour, prête à alimenter la newsletter mensuelle."
        actions={
          <Button variant="outline" size="sm" onClick={() => loadItems(search, category, statusTab)} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        }
      />

      <PageSection>
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)} className="space-y-6">
          <TabsList variant="pill" className="w-full justify-start lg:w-auto inline-flex">
            {STATUS_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="text-sm font-bold px-4">
                <Icon className="mr-2 h-4 w-4" /> {label}
                <StatusPill tone={statusTab === value ? 'brand' : 'neutral'} className="ml-2">
                  {counts[value]}
                </StatusPill>
              </TabsTrigger>
            ))}
          </TabsList>

          <DataToolbar
            variant="pill"
            filters={
              <>
                <div className="mr-auto w-full sm:w-auto">
                  <SearchInput
                    label="Rechercher dans la veille"
                    placeholder="Titre de l'article…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-full bg-secondary/50 border-none h-9 w-full"
                  />
                </div>

                <Select value={category} onValueChange={(v) => setCategory(v as NewsCategory | typeof ALL_CATEGORY_VALUE)}>
                  <SelectTrigger className="h-9 w-48 rounded-full bg-secondary/50 border-none text-xs font-semibold" aria-label="Filtrer par catégorie">
                    <SelectValue placeholder="Toutes les catégories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CATEGORY_VALUE} className="text-xs font-medium">Toutes les catégories</SelectItem>
                    {NEWS_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs font-medium">
                        {NEWS_CATEGORY_META[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
          />

          {loading ? (
            <LoadingState variant="table" rows={6} />
          ) : error ? (
            <ErrorState onRetry={() => loadItems(search, category, statusTab)} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Aucun article dans cette vue"
              description="La veille quotidienne alimente cette base chaque matin. Revenez après le premier cycle de collecte."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Publié</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal">
                      <a href={item.url} target="_blank" rel="noreferrer" className="block font-medium hover:underline">
                        {item.title}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {item.source}
                        {item.city ? ` · ${item.city}` : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{NEWS_CATEGORY_META[item.category]?.label ?? item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.published_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={updatingId === item.id}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.status === 'new' ? (
                            <DropdownMenuItem onClick={() => changeStatus(item, 'reviewed')}>Marquer comme relu</DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => changeStatus(item, 'newsletter')}>Sélectionner pour la newsletter</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeStatus(item, 'archived')}>Archiver</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setAngleItem(item)}>
                            Créer un angle éditorial
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={item.url} target="_blank" rel="noreferrer">Ouvrir l'article <ExternalLink className="ml-2 size-4" /></a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Tabs>
      </PageSection>

      <CreateAngleDialog
        item={angleItem}
        onOpenChange={(open) => {
          if (!open) setAngleItem(null)
        }}
        onCreated={() => {
          if (angleItem && angleItem.status === 'new') changeStatus(angleItem, 'reviewed')
        }}
      />
    </PageLayout>
  )
}

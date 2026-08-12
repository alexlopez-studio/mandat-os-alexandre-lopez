'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowUpDown,
  ArrowUpRight,
  Building2,
  Eye,
  Flag,
  Home,
  MapPin,
  MoreHorizontal,
  Search,
  Star,
  Timer,
} from 'lucide-react'

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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DataToolbar,
  PageHeader,
  PageLayout,
  PageSection,
  SearchInput,
  SellerPhaseBadge,
} from '@/components/pro'
import type { SellerPhase } from '@/lib/mandat/types'
import { DimensionBadges } from '../DimensionBadges'

interface PropertyRow {
  id: string
  external_id: string | null
  title: string | null
  city: string | null
  zipcode: string | null
  price: number | null
  surface: number | null
  price_per_m2: number | null
  rooms: number | null
  bedrooms: number | null
  property_type: string | null
  dpe: string | null
  status: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  url: string | null
  seller_type: string | null
  source_count?: number | null
  undervaluation_pct?: number | null
  opportunity?: { id: string; title: string; stage: string | null; priority: string | null } | null
  mandate_score?: {
    score: number
    phase: SellerPhase
    time_score: number
    frustration_score: number
    drop_intensity_score: number
    behavior_score: number
    days_online: number
    price_drops_count: number
    total_drop_percent: number
  } | null
}

interface ZoneContext {
  zone_id: string
  name: string
  zipcode: string
  city: string | null
  last_sync_status: string | null
  last_success_sync_at: string | null
  last_external_requests: number
  last_estimated_cost_eur: number
  last_blocked_reason: string | null
  property_count: number
  seen_property_count: number
  not_seen_property_count: number
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:          { label: 'Actif',          variant: 'secondary' },
  actif:           { label: 'Actif',          variant: 'secondary' },
  price_drop:      { label: 'Prix en baisse', variant: 'destructive' },
  prix_en_baisse:  { label: 'Prix en baisse', variant: 'destructive' },
  new:             { label: 'Nouveau',        variant: 'default' },
  nouveau:         { label: 'Nouveau',        variant: 'default' },
  opportunity:     { label: 'Opportunité',    variant: 'default' },
  opportunite:     { label: 'Opportunité',    variant: 'default' },
  stagnant:        { label: 'Stagne',         variant: 'outline' },
  stagne:          { label: 'Stagne',         variant: 'outline' },
  expired:         { label: 'Expiré',         variant: 'outline' },
  removed:         { label: 'Retiré',         variant: 'outline' },
}

const DPE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
  B: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold',
  C: 'bg-lime-100 text-lime-800 border-lime-300 font-bold',
  D: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
  E: 'bg-orange-100 text-orange-800 border-orange-300 font-bold',
  F: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  G: 'bg-red-100 text-red-800 border-red-300 font-bold',
}

function formatPrice(price: number | null) {
  if (price === null || price === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(cost)
}

function daysOnline(firstSeenIso: string | null) {
  if (!firstSeenIso) return null
  const diff = Date.now() - new Date(firstSeenIso).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Jamais'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h} h`
  return `Il y a ${Math.floor(h / 24)} j`
}

export function PropertiesTable({
  initialZipcode,
  mapWrapper,
}: {
  initialZipcode?: string
  mapWrapper?: React.ReactNode
}) {
  const router = useRouter()
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [zoneContext, setZoneContext] = useState<ZoneContext | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [zipcodeFilter, setZipcodeFilter] = useState<string | null>(initialZipcode ?? null)
  const [creatingOppId, setCreatingOppId] = useState<string | null>(null)

  // Filtres UI
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<'all' | SellerPhase>('all')
  const [sellerFilter, setSellerFilter] = useState<'all' | 'individual' | 'agency'>('all')

  // Tri
  const [sortBy, setSortBy] = useState<'mandate_score' | 'last_seen_at' | 'price' | 'surface'>('mandate_score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '100')
      params.set('sort', sortBy)
      params.set('order', sortOrder)
      if (zipcodeFilter) params.set('zipcode', zipcodeFilter)

      const res = await fetch(`/api/market/properties?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setProperties(data.properties ?? [])
      setTotal(data.total ?? 0)
      setZoneContext(data.zone_context ?? null)
    } catch (err) {
      toast.error('Impossible de charger les biens')
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortOrder, zipcodeFilter])

  useEffect(() => {
    load()
  }, [load])

  function clearZipcodeFilter() {
    setZipcodeFilter(null)
    router.replace('/app/properties')
  }

  async function createOpportunity(property: PropertyRow) {
    setCreatingOppId(property.id)
    try {
      const res = await fetch('/api/market/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_property_id: property.id,
          title: property.title ? `Vendeur - ${property.title}` : 'Projet Vente',
          seller_name: null,
          seller_phone: null,
        }),
      })
      if (!res.ok) throw new Error('Erreur lors de la création de l’opportunité')
      const json = await res.json()
      toast.success('Projet créé avec succès !')
      router.push(`/admin/market/opportunities/${json.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création impossible')
    } finally {
      setCreatingOppId(null)
    }
  }

  const cities = Array.from(new Set(properties.map(p => p.city).filter((c): c is string => Boolean(c)))).sort()
  const types  = Array.from(new Set(properties.map(p => p.property_type).filter((t): t is string => Boolean(t)))).sort()

  const filtered = properties.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchTitle = p.title?.toLowerCase().includes(q)
      const matchCity  = p.city?.toLowerCase().includes(q)
      const matchZip   = p.zipcode?.includes(q)
      if (!matchTitle && !matchCity && !matchZip) return false
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && p.status !== 'active' && p.status !== 'actif') return false
      if (statusFilter === 'price_drop' && p.status !== 'price_drop' && p.status !== 'prix_en_baisse') return false
      if (statusFilter === 'new' && p.status !== 'new' && p.status !== 'nouveau') return false
      if (statusFilter === 'opportunity' && p.status !== 'opportunity' && p.status !== 'opportunite') return false
      if (statusFilter === 'stagnant' && p.status !== 'stagnant' && p.status !== 'stagne') return false
      if (statusFilter === 'expired' && p.status !== 'expired') return false
      if (statusFilter === 'removed' && p.status !== 'removed') return false
    }
    if (cityFilter   !== 'all' && p.city !== cityFilter)     return false
    if (typeFilter   !== 'all' && p.property_type !== typeFilter) return false
    if (phaseFilter  !== 'all' && p.mandate_score?.phase !== phaseFilter) return false
    if (sellerFilter !== 'all' && p.seller_type !== sellerFilter) return false
    return true
  })

  const sorted = sortBy === 'mandate_score'
    ? [...filtered].sort((a, b) => {
        const av = a.mandate_score?.score ?? -1
        const bv = b.mandate_score?.score ?? -1
        return sortOrder === 'asc' ? av - bv : bv - av
      })
    : filtered

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Veille marché"
        title="Biens du marché"
        description={`${loading ? '...' : total} bien(s) synchronisé(s) sur le secteur.`}
      />

      <PageSection className="space-y-6">
        {zipcodeFilter && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs">
            <div>
              <p className="text-sm font-bold text-foreground">
                {zoneContext ? `Biens synchronisés pour ${zoneContext.name}` : 'Biens filtrés par zone surveillée'}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                <span>CP {zipcodeFilter}{zoneContext?.city ? ` · ${zoneContext.city}` : ''}</span>
                <span>{zoneContext?.seen_property_count ?? total} revu{(zoneContext?.seen_property_count ?? total) > 1 ? 's' : ''}</span>
                <span className={(zoneContext?.not_seen_property_count ?? 0) > 0 ? 'text-amber-700 font-bold' : ''}>
                  {zoneContext?.not_seen_property_count ?? 0} non revu{(zoneContext?.not_seen_property_count ?? 0) > 1 ? 's' : ''}
                </span>
                {zoneContext && (
                  <span>
                    Dernier succès : {relativeTime(zoneContext.last_success_sync_at)} · {zoneContext.last_external_requests} item{zoneContext.last_external_requests > 1 ? 's' : ''} · {formatCost(zoneContext.last_estimated_cost_eur)}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={clearZipcodeFilter} className="rounded-full font-semibold text-xs">
              Voir tous les biens
            </Button>
          </div>
        )}

        <DataToolbar
          variant="pill"
          filters={
            <>
              <div className="mr-auto w-full sm:w-auto">
                <SearchInput
                  label="Rechercher un bien"
                  placeholder="Rechercher un bien, une ville..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-full bg-secondary/50 border-none h-9 w-full sm:w-64"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 rounded-full bg-secondary/50 border-none text-xs font-semibold">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">Tous les statuts</SelectItem>
                  <SelectItem value="active" className="text-xs font-medium">Actif</SelectItem>
                  <SelectItem value="price_drop" className="text-xs font-medium">Prix en baisse</SelectItem>
                  <SelectItem value="new" className="text-xs font-medium">Nouveau</SelectItem>
                  <SelectItem value="opportunity" className="text-xs font-medium">Opportunité</SelectItem>
                  <SelectItem value="stagnant" className="text-xs font-medium">Stagne</SelectItem>
                  <SelectItem value="expired" className="text-xs font-medium">Expiré</SelectItem>
                  <SelectItem value="removed" className="text-xs font-medium">Retiré</SelectItem>
                </SelectContent>
              </Select>

              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="h-9 w-36 rounded-full bg-secondary/50 border-none text-xs font-semibold">
                  <SelectValue placeholder="Ville" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">Toutes les villes</SelectItem>
                  {cities.map((c) => <SelectItem key={c} value={c} className="text-xs font-medium">{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-36 rounded-full bg-secondary/50 border-none text-xs font-semibold">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">Tous les types</SelectItem>
                  {types.map((t) => <SelectItem key={t} value={t} className="text-xs font-medium">{t}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as 'all' | SellerPhase)}>
                <SelectTrigger className="h-9 w-36 rounded-full bg-secondary/50 border-none text-xs font-semibold">
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">Toutes les phases</SelectItem>
                  <SelectItem value="golden" className="text-xs font-medium">Fenêtre d&apos;or</SelectItem>
                  <SelectItem value="hot" className="text-xs font-medium">Chaud</SelectItem>
                  <SelectItem value="warm" className="text-xs font-medium">Tiède</SelectItem>
                  <SelectItem value="cold" className="text-xs font-medium">Froid</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sellerFilter} onValueChange={(v) => setSellerFilter(v as 'all' | 'individual' | 'agency')}>
                <SelectTrigger className="h-9 w-36 rounded-full bg-secondary/50 border-none text-xs font-semibold">
                  <SelectValue placeholder="Vendeur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">Tous les vendeurs</SelectItem>
                  <SelectItem value="individual" className="text-xs font-medium">Particulier</SelectItem>
                  <SelectItem value="agency" className="text-xs font-medium">Agence</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />

        {/* 2-Column Grid Layout: Left Table + Right Map */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Properties Table */}
          <div className="space-y-4 lg:col-span-7 xl:col-span-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {sorted.length} résultat{sorted.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Trier par :</span>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs font-semibold rounded-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mandate_score" className="text-xs font-medium">Score mandat</SelectItem>
                    <SelectItem value="last_seen_at" className="text-xs font-medium">Dernière vue</SelectItem>
                    <SelectItem value="price" className="text-xs font-medium">Prix</SelectItem>
                    <SelectItem value="surface" className="text-xs font-medium">Surface</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                >
                  <ArrowUpDown className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground font-bold">
                      <th className="px-4 py-3 text-left">BIEN</th>
                      <th className="px-4 py-3 text-left">LOCALISATION</th>
                      <th className="px-4 py-3 text-right">PRIX</th>
                      <th className="px-4 py-3 text-right">SURFACE</th>
                      <th className="px-4 py-3 text-center">STATUT</th>
                      <th className="px-4 py-3 text-center">SCORE</th>
                      <th className="w-12 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground font-medium">
                          Chargement des biens…
                        </td>
                      </tr>
                    )}
                    {!loading && sorted.map((prop) => {
                      const badge = STATUS_BADGES[prop.status ?? '']
                      const days = daysOnline(prop.first_seen_at)
                      return (
                        <tr
                          key={prop.id}
                          className="border-b last:border-0 hover:bg-muted/40 font-medium transition-colors"
                        >
                          <td className="p-4">
                            <Link
                              href={`/admin/market/properties/${prop.id}`}
                              className="font-bold text-foreground hover:text-primary transition-colors text-sm"
                            >
                              {prop.title || 'Bien sans titre'}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-1">
                              {prop.property_type && (
                                <Badge variant="outline" className="text-[10px] font-bold rounded-full px-2 py-0">
                                  {prop.property_type}
                                </Badge>
                              )}
                              {prop.rooms ? (
                                <span className="text-xs text-muted-foreground">{prop.rooms} pièces</span>
                              ) : null}
                            </div>
                            <DimensionBadges
                              className="mt-1.5"
                              sellerType={prop.seller_type}
                              undervaluationPct={prop.undervaluation_pct}
                              dpe={prop.dpe}
                              status={prop.status}
                            />
                          </td>
                          <td className="p-4 text-muted-foreground font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <MapPin className="size-3.5 shrink-0 text-primary" />
                              {prop.city}{prop.zipcode ? ` (${prop.zipcode})` : ''}
                            </div>
                          </td>
                          <td className="p-4 text-right font-bold text-foreground text-sm whitespace-nowrap">
                            {formatPrice(prop.price)}
                            {prop.status === 'price_drop' || prop.status === 'prix_en_baisse' ? (
                              <div className="flex items-center justify-end gap-0.5 text-destructive text-xs font-bold">
                                <ArrowUpRight className="size-3 rotate-180" />
                                baisse
                              </div>
                            ) : null}
                          </td>
                          <td className="p-4 text-right text-muted-foreground font-semibold whitespace-nowrap">
                            {prop.surface ? `${prop.surface} m²` : '—'}
                          </td>
                          <td className="p-4 text-center">
                            {badge ? (
                              <Badge variant={badge.variant} className="text-xs font-bold rounded-full px-2.5 py-0.5">
                                {badge.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground capitalize">{prop.status ?? '—'}</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {prop.mandate_score ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex flex-col items-center gap-1 cursor-help">
                                    <span className="text-sm font-bold tabular-nums text-foreground">{prop.mandate_score.score}</span>
                                    <SellerPhaseBadge phase={prop.mandate_score.phase} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="w-56 p-3 rounded-xl">
                                  <p className="font-bold text-xs mb-1.5">
                                    Détail du score vendeur
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                    <span>Temps en ligne</span>
                                    <span className="text-right tabular-nums text-foreground">
                                      {prop.mandate_score.days_online} j · {prop.mandate_score.time_score}/40
                                    </span>
                                    <span>Baisses de prix</span>
                                    <span className="text-right tabular-nums text-foreground">
                                      {prop.mandate_score.price_drops_count} · {prop.mandate_score.frustration_score}/30
                                    </span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-xs">
                                <DropdownMenuItem asChild className="rounded-lg text-xs font-bold py-2 cursor-pointer">
                                  <Link href={`/admin/market/properties/${prop.id}`}>
                                    <Eye className="size-4 mr-2" /> Ouvrir le bien
                                  </Link>
                                </DropdownMenuItem>
                                {prop.url && (
                                  <DropdownMenuItem asChild className="rounded-lg text-xs font-medium py-2 cursor-pointer">
                                    <a href={prop.url} target="_blank" rel="noopener noreferrer">
                                      <ArrowUpRight className="size-4 mr-2" /> Voir l'annonce
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                {prop.opportunity ? (
                                  <DropdownMenuItem asChild className="rounded-lg text-xs font-bold py-2 cursor-pointer">
                                    <Link href={`/admin/market/opportunities/${prop.opportunity.id}`}>
                                      <Building2 className="size-4 mr-2 text-amber-500" /> Ouvrir le projet
                                    </Link>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => void createOpportunity(prop)}
                                    disabled={creatingOppId === prop.id}
                                    className="rounded-lg text-xs font-bold py-2 cursor-pointer"
                                  >
                                    <Building2 className="size-4 mr-2 text-primary" /> Créer un projet
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="rounded-lg text-xs font-medium py-2 text-amber-700 cursor-pointer">
                                  <Flag className="size-4 mr-2" /> Signaler
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Home className="size-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-bold text-foreground">Aucun bien trouvé</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Essayez de modifier vos filtres ou la recherche.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sticky Map Panel */}
          {mapWrapper ? (
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6 rounded-2xl border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    Carte du secteur
                  </h3>
                </div>
                {mapWrapper}
              </div>
            </div>
          ) : null}
        </div>
      </PageSection>
    </PageLayout>
  )
}

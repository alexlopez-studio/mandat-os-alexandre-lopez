'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Home,
  MapPin,
  Timer,
  MoreHorizontal,
  Eye,
  Star,
  Flag,
  ArrowUpRight,
  RefreshCw,
  Building2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { SellerPhase } from '@/lib/mandat/types'
import { SellerPhaseBadge } from '@/app/dashboard/radar/_components/SellerPhaseBadge'
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
  A: 'bg-green-100 text-green-700 border-green-200',
  B: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  C: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  D: 'bg-orange-100 text-orange-700 border-orange-200',
  E: 'bg-red-100 text-red-700 border-red-200',
  F: 'bg-red-200 text-red-800 border-red-300',
  G: 'bg-red-300 text-red-900 border-red-400',
}

function formatPrice(price: number | null) {
  if (!price) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function formatCost(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'À l’instant'
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  return `Il y a ${Math.floor(h / 24)}j`
}

function daysOnline(firstSeenAt: string | null): number | null {
  if (!firstSeenAt) return null
  const diff = Date.now() - new Date(firstSeenAt).getTime()
  return Math.max(0, Math.floor(diff / 86_400_000))
}

export function PropertiesTable({ initialZipcode }: { initialZipcode?: string }) {
  const router = useRouter()
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creatingOppId, setCreatingOppId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [phaseFilter, setPhaseFilter] = useState<'all' | SellerPhase>('all')
  const [sellerFilter, setSellerFilter] = useState<'all' | 'individual' | 'agency'>('all')
  const [zipcodeFilter, setZipcodeFilter] = useState(initialZipcode ?? '')
  const [zoneContext, setZoneContext] = useState<ZoneContext | null>(null)
  const [sortBy, setSortBy] = useState<'price' | 'last_seen_at' | 'surface' | 'mandate_score'>('last_seen_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '100',
        sort: `${sortBy}.${sortOrder}`,
      })
      if (zipcodeFilter) params.set('zipcode', zipcodeFilter)
      const [res, statsRes] = await Promise.all([
        fetch(`/api/market/properties?${params}`),
        zipcodeFilter ? fetch('/api/market/sync-stats') : Promise.resolve(null),
      ])
      const data = await res.json()
      setProperties(data.properties ?? [])
      setTotal(data.total ?? 0)
      if (statsRes) {
        const stats = await statsRes.json()
        const zone = (stats.zones ?? []).find((item: ZoneContext) => item.zipcode === zipcodeFilter)
        setZoneContext(zone ?? null)
      } else {
        setZoneContext(null)
      }
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortOrder, zipcodeFilter])

  useEffect(() => { load() }, [load])

  async function createOpportunity(prop: PropertyRow) {
    const isPriceDrop = prop.status === 'price_drop' || prop.status === 'prix_en_baisse'
    const titleBase = prop.title ?? 'Bien'
    const title = prop.city ? `${titleBase} — ${prop.city}` : titleBase
    setCreatingOppId(prop.id)
    try {
      const res = await fetch('/api/market/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_property_id: prop.id,
          title,
          stage: 'Nouveau contact',
          priority: isPriceDrop ? 'high' : 'medium',
          signal_type: isPriceDrop ? 'price_drop' : 'new_listing',
          source_channel: 'annonce',
          property_city: prop.city,
          property_zipcode: prop.zipcode,
          property_type: prop.property_type,
          estimated_price_min: prop.price,
          estimated_price_max: prop.price,
          created_from: 'manual',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      toast.success(data.existing ? 'Opportunité déjà existante' : 'Opportunité créée', {
        description: title,
        action: { label: 'Voir la fiche', onClick: () => router.push(`/app/properties/${prop.id}`) },
      })
      await load()
    } catch (err) {
      console.error('Erreur création opportunité:', err)
      toast.error('Impossible de créer l’opportunité')
    } finally {
      setCreatingOppId(null)
    }
  }

  function clearZipcodeFilter() {
    setZipcodeFilter('')
    window.history.replaceState(null, '', '/app/properties')
  }

  const cities = [...new Set(properties.map(p => p.city).filter(Boolean))] as string[]
  const types  = [...new Set(properties.map(p => p.property_type).filter(Boolean))] as string[]

  const filtered = properties.filter(p => {
    if (search) {
      const s = search.toLowerCase()
      if (!(p.title ?? '').toLowerCase().includes(s) && !(p.city ?? '').toLowerCase().includes(s)) return false
    }
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (cityFilter   !== 'all' && p.city !== cityFilter)     return false
    if (typeFilter   !== 'all' && p.property_type !== typeFilter) return false
    if (phaseFilter  !== 'all' && p.mandate_score?.phase !== phaseFilter) return false
    if (sellerFilter !== 'all' && p.seller_type !== sellerFilter) return false
    return true
  })

  // Tri par score mandat côté client (le score n'est pas une colonne SQL) ;
  // les autres tris restent gérés côté serveur.
  const sorted = sortBy === 'mandate_score'
    ? [...filtered].sort((a, b) => {
        const av = a.mandate_score?.score ?? -1
        const bv = b.mandate_score?.score ?? -1
        return sortOrder === 'asc' ? av - bv : bv - av
      })
    : filtered

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marché immobilier</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? '…' : total} biens synchronisés{zipcodeFilter ? ` sur le CP ${zipcodeFilter}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
          Actualiser
        </Button>
      </div>

      {zipcodeFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-accent/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {zoneContext ? `Biens synchronisés pour ${zoneContext.name}` : 'Biens filtrés par zone surveillée'}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>CP {zipcodeFilter}{zoneContext?.city ? ` · ${zoneContext.city}` : ''}</span>
              <span>{zoneContext?.seen_property_count ?? total} revu{(zoneContext?.seen_property_count ?? total) > 1 ? 's' : ''}</span>
              <span className={(zoneContext?.not_seen_property_count ?? 0) > 0 ? 'text-amber-700' : ''}>
                {zoneContext?.not_seen_property_count ?? 0} non revu{(zoneContext?.not_seen_property_count ?? 0) > 1 ? 's' : ''}
              </span>
              {zoneContext && (
                <span>
                  Dernier succès : {relativeTime(zoneContext.last_success_sync_at)} · {zoneContext.last_external_requests} item{zoneContext.last_external_requests > 1 ? 's' : ''} · {formatCost(zoneContext.last_estimated_cost_eur)}
                </span>
              )}
              {zoneContext?.last_blocked_reason && <span className="text-amber-700">{zoneContext.last_blocked_reason}</span>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={clearZipcodeFilter}>
            Voir tous les biens
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un bien, une ville..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="price_drop">Prix en baisse</SelectItem>
                <SelectItem value="new">Nouveau</SelectItem>
                <SelectItem value="opportunity">Opportunité</SelectItem>
                <SelectItem value="stagnant">Stagne</SelectItem>
                <SelectItem value="expired">Expiré</SelectItem>
                <SelectItem value="removed">Retiré</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Ville" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les villes</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as 'all' | SellerPhase)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Phase vendeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les phases</SelectItem>
                <SelectItem value="golden">Fenêtre d&apos;or</SelectItem>
                <SelectItem value="hot">Chaud</SelectItem>
                <SelectItem value="warm">Tiède</SelectItem>
                <SelectItem value="cold">Froid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sellerFilter} onValueChange={(v) => setSellerFilter(v as 'all' | 'individual' | 'agency')}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Type de vendeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les vendeurs</SelectItem>
                <SelectItem value="individual">Particulier</SelectItem>
                <SelectItem value="agency">Agence</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-9">
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sorted.length} résultat{sorted.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Trier par :</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mandate_score">Score mandat</SelectItem>
              <SelectItem value="last_seen_at">Dernière vue</SelectItem>
              <SelectItem value="price">Prix</SelectItem>
              <SelectItem value="surface">Surface</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 font-medium text-muted-foreground">Bien</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Localisation</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Prix</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Surface</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Prix/m²</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">DPE</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">Statut</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">Score mandat</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">En ligne</th>
                  <th className="w-[50px] p-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!loading && sorted.map((prop) => {
                  const badge = STATUS_BADGES[prop.status ?? '']
                  const days = daysOnline(prop.first_seen_at)
                  const dpe = prop.dpe?.toUpperCase()
                  return (
                    <tr
                      key={prop.id}
                      className="border-b last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="p-4">
                        <Link
                          href={`/app/properties/${prop.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {prop.title || 'Bien sans titre'}
                        </Link>
                        <div className="flex items-center gap-1 mt-1">
                          {prop.property_type && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {prop.property_type}
                            </Badge>
                          )}
                          {prop.rooms ? (
                            <span className="text-xs text-muted-foreground">{prop.rooms} pièces</span>
                          ) : null}
                          {(prop.source_count ?? 1) > 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                              {prop.source_count} diffusions
                            </Badge>
                          )}
                        </div>
                        <DimensionBadges
                          className="mt-1.5"
                          sellerType={prop.seller_type}
                          undervaluationPct={prop.undervaluation_pct}
                          dpe={prop.dpe}
                          status={prop.status}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {prop.city}{prop.zipcode ? ` (${prop.zipcode})` : ''}
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatPrice(prop.price)}
                        {prop.status === 'price_drop' || prop.status === 'prix_en_baisse' ? (
                          <div className="flex items-center justify-end gap-0.5 text-destructive text-xs">
                            <ArrowUpRight className="h-3 w-3 rotate-180" />
                            baisse
                          </div>
                        ) : null}
                      </td>
                      <td className="p-4 text-right text-muted-foreground">
                        {prop.surface ? `${prop.surface} m²` : '—'}
                      </td>
                      <td className="p-4 text-right text-muted-foreground text-xs">
                        {prop.price_per_m2 ? `${new Intl.NumberFormat('fr-FR').format(prop.price_per_m2)} €/m²` : '—'}
                      </td>
                      <td className="p-4 text-center">
                        {dpe && DPE_COLORS[dpe] ? (
                          <Badge variant="outline" className={cn('text-[10px] px-1.5', DPE_COLORS[dpe])}>
                            {dpe}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {badge ? (
                          <Badge variant={badge.variant} className="text-xs">
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
                                <span className="text-sm font-semibold tabular-nums">{prop.mandate_score.score}</span>
                                <SellerPhaseBadge phase={prop.mandate_score.phase} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="w-56">
                              <p className="font-medium mb-1.5">
                                Détail du score — à étudier au cas par cas
                              </p>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                                <span>Temps en ligne</span>
                                <span className="text-right tabular-nums">
                                  {prop.mandate_score.days_online} j · {prop.mandate_score.time_score}/40
                                </span>
                                <span>Baisses de prix</span>
                                <span className="text-right tabular-nums">
                                  {prop.mandate_score.price_drops_count} · {prop.mandate_score.frustration_score}/30
                                </span>
                                <span>Intensité baisse</span>
                                <span className="text-right tabular-nums">
                                  {prop.mandate_score.total_drop_percent}% · {prop.mandate_score.drop_intensity_score}/15
                                </span>
                                <span>Comportement</span>
                                <span className="text-right tabular-nums">
                                  {prop.mandate_score.behavior_score}/15
                                </span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <Timer className="h-3 w-3" />
                          {days !== null ? `${days}j` : '—'}
                        </div>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem asChild>
                              <Link href={`/app/properties/${prop.id}`}>
                                <Eye className="h-4 w-4 mr-2" /> Détail
                              </Link>
                            </DropdownMenuItem>
                            {prop.url && (
                              <DropdownMenuItem asChild>
                                <a href={prop.url} target="_blank" rel="noopener noreferrer">
                                  <ArrowUpRight className="h-4 w-4 mr-2" /> Voir l'annonce
                                </a>
                              </DropdownMenuItem>
                            )}
                            {prop.opportunity ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/app/properties/${prop.id}`}>
                                  <Building2 className="h-4 w-4 mr-2" /> Fiche CRM
                                </Link>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => createOpportunity(prop)}
                                disabled={creatingOppId === prop.id}
                              >
                                <Building2 className="h-4 w-4 mr-2" /> Créer une opportunité
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Star className="h-4 w-4 mr-2" /> Marquer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-amber-600">
                              <Flag className="h-4 w-4 mr-2" /> Signaler
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
              <Home className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">Aucun bien trouvé</p>
              <p className="text-xs text-muted-foreground mt-1">Essayez de modifier vos filtres</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

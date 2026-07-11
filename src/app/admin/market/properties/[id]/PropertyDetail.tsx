'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import {
  MapPin,
  Bed,
  Home,
  Ruler,
  Zap,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Star,
  FileText,
  Plus,
  ChevronLeft,
  Building2,
  ExternalLink,
  Tag,
  Users,
  Loader2,
  Link2,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { SellerPhase } from '@/lib/mandat/types'
import { SellerPhaseBadge } from '@/app/dashboard/radar/_components/SellerPhaseBadge'
import { DimensionBadges } from '../../DimensionBadges'

// ── Types (réponse /api/market/properties/[id]) ─────────────

interface PropertyRow {
  id: string
  title: string | null
  description: string | null
  city: string | null
  zipcode: string | null
  property_type: string | null
  price: number | null
  surface: number | null
  land_surface: number | null
  rooms: number | null
  bedrooms: number | null
  dpe: string | null
  ges: string | null
  url: string | null
  status: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  published_at: string | null
  price_per_m2: number | null
  seller_type: string | null
}

interface PriceHistoryRow {
  id: string
  old_price: number | null
  new_price: number | null
  variation_amount: number | null
  variation_percent: number | null
  detected_at: string | null
}

interface TagRow { id: string; tag: string; source: string | null }
interface NoteRow { id: string; note: string; created_at: string }
interface LinkedOpportunity { id: string; title: string; stage: string | null; priority: string | null }
interface PropertySourceRow {
  id: string
  portal: string | null
  source: string
  external_id: string | null
  url: string | null
  title: string | null
  price: number | null
  status: string
  published_at: string | null
  first_seen_at: string
  last_seen_at: string
}
interface DuplicateCandidateRow {
  property: {
    id: string
    title: string | null
    city: string | null
    zipcode: string | null
    property_type: string | null
    price: number | null
    surface: number | null
    land_surface: number | null
    rooms: number | null
    status: string | null
    url: string | null
    first_seen_at: string | null
    last_seen_at: string | null
  }
  score: number
  reasons: string[]
  status: 'pending' | 'confirmed' | 'rejected'
}

interface MandateScoreView {
  score: number
  phase: SellerPhase
  time_score: number
  frustration_score: number
  drop_intensity_score: number
  behavior_score: number
  days_online: number
  price_drops_count: number
  total_drop_percent: number
}

interface PropertyDetailData {
  property: PropertyRow
  price_history: PriceHistoryRow[]
  tags: TagRow[]
  notes: NoteRow[]
  sources: PropertySourceRow[]
  duplicate_candidates: DuplicateCandidateRow[]
  opportunity: LinkedOpportunity | null
  mandate_score?: MandateScoreView | null
  undervaluation_pct?: number | null
}

interface BuyerMatch {
  buyer_lead_id: string
  score: number
  matched_commune: boolean
  matched_type: boolean
  matched_budget: boolean
  matched_surface: boolean
  matched_pieces: boolean
}

// ── Helpers ─────────────────────────────────────────────────

const DPE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700 border-green-200',
  B: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  C: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  D: 'bg-orange-100 text-orange-700 border-orange-200',
  E: 'bg-red-100 text-red-700 border-red-200',
  F: 'bg-red-200 text-red-800 border-red-300',
  G: 'bg-red-300 text-red-900 border-red-400',
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Actif', variant: 'secondary' },
  actif: { label: 'Actif', variant: 'secondary' },
  price_drop: { label: 'Prix en baisse', variant: 'destructive' },
  prix_en_baisse: { label: 'Prix en baisse', variant: 'destructive' },
  removed: { label: 'Retiré', variant: 'outline' },
  expired: { label: 'Expiré', variant: 'outline' },
  relisted: { label: 'Remise en vente', variant: 'default' },
  duplicate: { label: 'Doublon', variant: 'outline' },
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

// Prix d'origine déduit de l'historique : plus haut prix observé.
function originalPriceFrom(history: PriceHistoryRow[]): number | null {
  let max: number | null = null
  for (const h of history) {
    for (const v of [h.old_price, h.new_price]) {
      if (v != null && (max == null || v > max)) max = v
    }
  }
  return max
}

// ── Component ───────────────────────────────────────────────

export function PropertyDetail() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.id as string

  const [data, setData] = useState<PropertyDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [potentialBuyers, setPotentialBuyers] = useState<BuyerMatch[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  const [creatingOpp, setCreatingOpp] = useState(false)
  const [resolvingDuplicateId, setResolvingDuplicateId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const load = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/market/properties/${propertyId}`)
      if (res.status === 404) { setNotFound(true); return }
      if (!res.ok) throw new Error('Erreur API')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Erreur chargement bien', err)
      toast.error('Impossible de charger ce bien')
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!propertyId) return
    setLoadingMatches(true)
    fetch(`/api/market/matching?property_id=${propertyId}&limit=10&min_score=40`)
      .then((res) => (res.ok ? res.json() : { matches: [] }))
      .then((d) => setPotentialBuyers(d.matches ?? []))
      .catch(() => setPotentialBuyers([]))
      .finally(() => setLoadingMatches(false))
  }, [propertyId])

  async function createOpportunity() {
    if (!data) return
    const p = data.property
    const isPriceDrop = p.status === 'price_drop' || p.status === 'prix_en_baisse'
    const title = p.city ? `${p.title ?? 'Bien'} — ${p.city}` : (p.title ?? 'Bien')
    setCreatingOpp(true)
    try {
      const res = await fetch('/api/market/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_property_id: p.id,
          title,
          stage: 'Nouveau contact',
          priority: isPriceDrop ? 'high' : 'medium',
          signal_type: isPriceDrop ? 'price_drop' : 'new_listing',
          source_channel: 'annonce',
          property_city: p.city,
          property_zipcode: p.zipcode,
          property_type: p.property_type,
          estimated_price_min: p.price,
          estimated_price_max: p.price,
          created_from: 'manual',
        }),
      })
      const responseData = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(responseData.error ?? 'Erreur API')
      toast.success(responseData.existing ? 'Opportunité déjà existante' : 'Opportunité créée', {
        description: title,
        action: { label: 'Voir la fiche', onClick: () => router.push(`/app/properties/${p.id}`) },
      })
      await load()
    } catch (err) {
      console.error('Erreur création opportunité:', err)
      toast.error('Impossible de créer l’opportunité')
    } finally {
      setCreatingOpp(false)
    }
  }

  async function addNote() {
    const note = noteDraft.trim()
    if (!note) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/market/properties/${propertyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (!res.ok) throw new Error('Erreur API')
      setNoteDraft('')
      toast.success('Note ajoutée')
      await load()
    } catch (err) {
      console.error('Erreur ajout note:', err)
      toast.error('Impossible d’ajouter la note')
    } finally {
      setSavingNote(false)
    }
  }

  async function resolveDuplicate(candidate: DuplicateCandidateRow, action: 'merge' | 'reject') {
    const candidateId = candidate.property.id
    if (action === 'merge') {
      const ok = window.confirm('Rapprocher ce doublon ? La fiche actuelle deviendra la fiche principale et les diffusions seront regroupées.')
      if (!ok) return
    }

    setResolvingDuplicateId(candidateId + action)
    try {
      const res = await fetch(`/api/market/properties/${propertyId}/duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_property_id: candidateId,
          action,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erreur API')
      toast.success(action === 'merge' ? 'Biens rapprochés' : 'Doublon écarté')
      await load()
    } catch (err) {
      console.error('Erreur rapprochement doublon:', err)
      toast.error(action === 'merge' ? 'Impossible de rapprocher ce bien' : 'Impossible d’écarter ce doublon')
    } finally {
      setResolvingDuplicateId(null)
    }
  }

  // ── États de page ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement du bien…
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Home className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium">Bien introuvable</p>
        <Link href="/app/properties" className="text-sm text-primary hover:underline">Retour au marché</Link>
      </div>
    )
  }

  const { property, price_history, tags, notes, sources, duplicate_candidates, opportunity, mandate_score, undervaluation_pct } = data
  const originalPrice = originalPriceFrom(price_history)
  const dropPercent = originalPrice && property.price != null && originalPrice > property.price
    ? ((originalPrice - property.price) / originalPrice) * 100
    : null
  const daysOnline = daysSince(property.first_seen_at)
  const statusBadge = STATUS_LABELS[property.status ?? ''] ?? { label: property.status ?? 'Statut inconnu', variant: 'outline' as const }
  const address = [property.zipcode, property.city].filter(Boolean).join(' ') || '—'

  return (
    <div className="space-y-6">
      <Link
        href="/app/properties"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour au marché
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{property.title ?? 'Bien immobilier'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{address}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {property.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={property.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Voir l&apos;annonce
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prix actuel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', dropPercent ? 'text-destructive' : '')}>{formatPrice(property.price)}</div>
            {dropPercent != null && originalPrice != null && (
              <div className="flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3 text-destructive" />
                <span className="text-xs text-destructive">
                  -{dropPercent.toFixed(1)}% (était {formatPrice(originalPrice)})
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Surface</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{property.surface != null ? `${property.surface} m²` : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {property.land_surface != null ? `Terrain : ${property.land_surface} m²` : 'Terrain non renseigné'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prix / m²</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(property.price_per_m2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{property.property_type ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En ligne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {daysOnline != null ? `${daysOnline} j` : '—'}
              {daysOnline != null && daysOnline > 30 && (
                <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200 text-xs">
                  Stagne
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Publié le {formatDate(property.published_at ?? property.first_seen_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Characteristics */}
          <Card>
            <CardHeader>
              <CardTitle>Caractéristiques</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="rounded-full bg-muted/30 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                    <Bed className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold">{property.bedrooms ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Chambres</p>
                </div>
                <div className="text-center">
                  <div className="rounded-full bg-muted/30 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                    <Home className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold">{property.rooms ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Pièces</p>
                </div>
                <div className="text-center">
                  <div className="rounded-full bg-muted/30 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold">{property.surface != null ? `${property.surface} m²` : '—'}</p>
                  <p className="text-xs text-muted-foreground">Surface habitable</p>
                </div>
                <div className="text-center">
                  <div className="rounded-full bg-muted/30 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {property.dpe ? (
                    <>
                      <Badge variant="outline" className={cn('text-sm px-2 py-0', DPE_COLORS[property.dpe])}>
                        {property.dpe}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">DPE</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-3">DPE n/d</p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex flex-wrap gap-2">
                {property.property_type && (
                  <Badge variant="outline" className="text-xs">{property.property_type}</Badge>
                )}
                {tags.map((t) => (
                  <Badge key={t.id} variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {t.tag}
                  </Badge>
                ))}
                {tags.length === 0 && !property.property_type && (
                  <span className="text-xs text-muted-foreground">Aucun tag</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {property.description?.trim() || 'Aucune description fournie par l’annonce.'}
              </p>
            </CardContent>
          </Card>

          {/* Price history */}
          <Card>
            <CardHeader>
              <CardTitle>Historique des prix</CardTitle>
              <CardDescription>Variations détectées sur ce bien</CardDescription>
            </CardHeader>
            <CardContent>
              {price_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune variation de prix détectée depuis la première synchronisation.</p>
              ) : (
                <div className="space-y-3">
                  {price_history.map((entry) => {
                    const variation = entry.variation_percent ?? 0
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{formatDate(entry.detected_at)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(entry.old_price)} → {formatPrice(entry.new_price)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-sm font-bold', variation < 0 ? 'text-destructive' : variation > 0 ? 'text-emerald-600' : '')}>
                            {variation > 0 ? '+' : ''}{variation}%
                          </p>
                          {entry.variation_amount != null && (
                            <p className="text-xs text-muted-foreground">{formatPrice(Math.abs(entry.variation_amount))}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Situation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Situation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Statut</span>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Première détection</span>
                <span className="text-sm">{formatDate(property.first_seen_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Dernière mise à jour</span>
                <span className="text-sm">{formatDate(property.last_seen_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Diffusions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Diffusions
              </CardTitle>
              <CardDescription className="text-[11px]">
                Sites d&apos;annonces qui publient ce même bien
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune diffusion historisée pour ce bien.</p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div key={source.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{source.portal ?? source.source}</p>
                            <Badge variant="outline" className="text-[10px]">{source.status}</Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{formatPrice(source.price)}</span>
                            <span>Vu le {formatDate(source.last_seen_at)}</span>
                          </div>
                        </div>
                        {source.url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={source.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Doublons probables */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Doublons probables
              </CardTitle>
              <CardDescription className="text-[11px]">
                Biens proches à rapprocher seulement après vérification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {duplicate_candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun doublon probable détecté.</p>
              ) : (
                <div className="space-y-3">
                  {duplicate_candidates.map((candidate) => {
                    const merging = resolvingDuplicateId === candidate.property.id + 'merge'
                    const rejecting = resolvingDuplicateId === candidate.property.id + 'reject'
                    return (
                      <div key={candidate.property.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium">{candidate.property.title ?? 'Bien sans titre'}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {candidate.property.city && <span>{candidate.property.city}</span>}
                              <span>{formatPrice(candidate.property.price)}</span>
                              {candidate.property.surface != null && <span>{candidate.property.surface} m²</span>}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{candidate.score}%</Badge>
                        </div>
                        {candidate.reasons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {candidate.reasons.map((reason) => (
                              <Badge key={reason} variant="secondary" className="text-[10px]">{reason}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => resolveDuplicate(candidate, 'merge')} disabled={merging || rejecting}>
                            {merging ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                            Rapprocher
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => resolveDuplicate(candidate, 'reject')} disabled={merging || rejecting}>
                            {rejecting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />}
                            Écarter
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/app/properties/${candidate.property.id}`}>Ouvrir</Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score mandat (MandateProbabilityScore calculé côté API) */}
          {mandate_score && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  Score mandat
                </CardTitle>
                <CardDescription className="text-xs">
                  Probabilité d&apos;obtenir le mandat (fenêtre d&apos;or vendeur)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-bold tabular-nums leading-none">
                    {mandate_score.score}
                    <span className="text-sm font-normal text-muted-foreground">/100</span>
                  </span>
                  <SellerPhaseBadge phase={mandate_score.phase} />
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      mandate_score.phase === 'golden' && 'bg-red-500',
                      mandate_score.phase === 'hot' && 'bg-orange-500',
                      mandate_score.phase === 'warm' && 'bg-yellow-500',
                      mandate_score.phase === 'cold' && 'bg-gray-400',
                    )}
                    style={{ width: `${mandate_score.score}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Temps en ligne</span>
                  <span className="text-right tabular-nums text-foreground">
                    {mandate_score.days_online} j · {mandate_score.time_score}/40
                  </span>
                  <span>Baisses de prix</span>
                  <span className="text-right tabular-nums text-foreground">
                    {mandate_score.price_drops_count} · {mandate_score.frustration_score}/30
                  </span>
                  <span>Intensité baisse</span>
                  <span className="text-right tabular-nums text-foreground">
                    {mandate_score.total_drop_percent}% · {mandate_score.drop_intensity_score}/15
                  </span>
                  <span>Comportement</span>
                  <span className="text-right tabular-nums text-foreground">
                    {mandate_score.behavior_score}/15
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profil du bien — dimensions de lecture (gagnabilité, valeur, contraintes) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Profil du bien
              </CardTitle>
              <CardDescription className="text-xs">
                Type de vendeur, valorisation et contraintes — à lire à côté du score de motivation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DimensionBadges
                sellerType={property.seller_type}
                undervaluationPct={undervaluation_pct}
                dpe={property.dpe}
                status={property.status}
              />
              {property.seller_type === 'agency' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Annonce d&apos;agence : mandat déjà confié. Surveiller un retrait (mandat échu) pour re-pitcher.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Acquéreurs compatibles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Acquéreurs compatibles
              </CardTitle>
              <CardDescription className="text-[11px]">
                Profils acquéreurs dont les critères sont compatibles avec ce bien
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMatches ? (
                <p className="text-xs text-muted-foreground">Chargement…</p>
              ) : potentialBuyers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun acquéreur compatible trouvé</p>
              ) : (
                <div className="space-y-2">
                  {potentialBuyers.map((match) => (
                    <div key={match.buyer_lead_id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">Acquéreur #{match.buyer_lead_id.slice(0, 8)}</span>
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                          match.score >= 80 ? 'text-green-600 bg-green-50 border-green-200' : 'text-amber-600 bg-amber-50 border-amber-200',
                        )}>
                          {match.score}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {match.matched_commune && <span className="text-[10px] text-muted-foreground">📍 Commune</span>}
                        {match.matched_type && <span className="text-[10px] text-muted-foreground">🏠 Type</span>}
                        {match.matched_budget && <span className="text-[10px] text-muted-foreground">💰 Budget</span>}
                        {match.matched_surface && <span className="text-[10px] text-muted-foreground">📐 Surface</span>}
                        {match.matched_pieces && <span className="text-[10px] text-muted-foreground">🚪 Pièces</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opportunité liée */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Opportunité liée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {opportunity ? (
                <Link
                  href="/app/opportunities"
                  className="block rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Star className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{opportunity.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{opportunity.stage ?? '—'}</Badge>
                        {opportunity.priority && (
                          <Badge variant="outline" className="text-[10px]">{opportunity.priority}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune opportunité encore créée pour ce bien.</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notes.length > 0 && (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-lg border bg-muted/20 p-2">
                      <p className="text-xs whitespace-pre-line">{n.note}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Ajouter une note…"
                  onKeyDown={(e) => { if (e.key === 'Enter') addNote() }}
                />
                <Button size="sm" onClick={addNote} disabled={savingNote || !noteDraft.trim()}>
                  {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {!opportunity && (
              <Button className="w-full" onClick={createOpportunity} disabled={creatingOpp}>
                {creatingOpp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
                Créer une opportunité
              </Button>
            )}
            {property.url && (
              <Button variant="outline" className="w-full" asChild>
                <a href={property.url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  Voir l&apos;annonce d&apos;origine
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

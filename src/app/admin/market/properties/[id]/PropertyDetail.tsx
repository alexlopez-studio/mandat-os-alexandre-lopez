'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Bed,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Home,
  Link2,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Ruler,
  Star,
  Tag,
  TrendingDown,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { SellerPhaseBadge } from '@/components/pro'
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
  }
  score: number
  reasons: string[]
}

interface PropertyDetailData {
  property: PropertyRow
  price_history: PriceHistoryRow[]
  tags: TagRow[]
  notes: NoteRow[]
  sources: PropertySourceRow[]
  duplicate_candidates: DuplicateCandidateRow[]
  opportunity: LinkedOpportunity | null
  mandate_score: {
    score: number
    phase: 'golden' | 'hot' | 'warm' | 'cold'
    days_online: number
    price_drops_count: number
    total_drop_percent: number
    time_score: number
    frustration_score: number
    drop_intensity_score: number
    behavior_score: number
  } | null
  undervaluation_pct: number | null
}

interface MatchResult {
  buyer_lead_id: string
  score: number
  matched_commune: boolean
  matched_type: boolean
  matched_budget: boolean
  matched_surface: boolean
  matched_pieces: boolean
}

// ── Formateurs ───────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysSince(isoString: string | null | undefined): number | null {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function originalPriceFrom(history: PriceHistoryRow[]): number | null {
  if (!history.length) return null
  const oldest = [...history].sort((a, b) => {
    const da = a.detected_at ? new Date(a.detected_at).getTime() : 0
    const db = b.detected_at ? new Date(b.detected_at).getTime() : 0
    return da - db
  })[0]
  return oldest?.old_price ?? null
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

const STATUS_LABELS: Record<string, { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  active: { label: 'En ligne', tone: 'success' },
  expired: { label: 'Retiré / Expiré', tone: 'neutral' },
  sold: { label: 'Vendu', tone: 'warning' },
}

export function PropertyDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [data, setData] = useState<PropertyDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [creatingOpp, setCreatingOpp] = useState(false)
  const [resolvingDuplicateId, setResolvingDuplicateId] = useState<string | null>(null)

  const [potentialBuyers, setPotentialBuyers] = useState<MatchResult[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  const fetchProperty = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/market/properties/${id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Bien non trouvé (${res.status})`)
      }
      const json: PropertyDetailData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProperty()
  }, [fetchProperty])

  useEffect(() => {
    if (!id) return
    setLoadingMatches(true)
    fetch(`/api/market/properties/${id}/matches`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Erreur matches'))))
      .then((json) => setPotentialBuyers(json.matches ?? []))
      .catch(() => setPotentialBuyers([]))
      .finally(() => setLoadingMatches(false))
  }, [id])

  async function addNote() {
    if (!noteDraft.trim() || !id) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/market/properties/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteDraft.trim() }),
      })
      if (!res.ok) throw new Error('Erreur lors de l’ajout de la note')
      const created: NoteRow = await res.json()
      setData((prev) => prev ? { ...prev, notes: [created, ...prev.notes] } : prev)
      setNoteDraft('')
      toast.success('Note ajoutée')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur note')
    } finally {
      setSavingNote(false)
    }
  }

  async function createOpportunity() {
    if (!id || !data) return
    setCreatingOpp(true)
    try {
      const res = await fetch('/api/market/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_property_id: id,
          title: data.property.title ? `Vendeur - ${data.property.title}` : 'Projet Vente',
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
      setCreatingOpp(false)
    }
  }

  async function resolveDuplicate(candidate: DuplicateCandidateRow, action: 'merge' | 'reject') {
    if (!id) return
    const candidateId = candidate.property.id
    setResolvingDuplicateId(candidateId + action)
    try {
      const res = await fetch(`/api/market/properties/${id}/duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId, action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Résolution impossible')
      toast.success(action === 'merge' ? 'Doublon rapproché' : 'Candidat écarté')
      setData((prev) => prev ? {
        ...prev,
        duplicate_candidates: prev.duplicate_candidates.filter((item) => item.property.id !== candidateId),
      } : prev)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur traitement doublon')
    } finally {
      setResolvingDuplicateId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-medium text-muted-foreground">
        <Loader2 className="animate-spin size-5 mr-2 text-primary" /> Chargement de la fiche bien…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm font-semibold text-destructive">{error ?? 'Bien introuvable'}</p>
        <Button variant="outline" onClick={() => router.push('/app/properties')} className="rounded-full">
          Retour aux biens
        </Button>
      </div>
    )
  }

  const { property, price_history, tags, notes, sources, duplicate_candidates, opportunity, mandate_score, undervaluation_pct } = data
  const originalPrice = originalPriceFrom(price_history)
  const dropPercent = originalPrice && property.price != null && originalPrice > property.price
    ? ((originalPrice - property.price) / originalPrice) * 100
    : null
  const daysOnline = daysSince(property.first_seen_at)
  const statusBadge = STATUS_LABELS[property.status ?? ''] ?? { label: property.status ?? 'Statut inconnu', tone: 'neutral' as const }
  const address = [property.zipcode, property.city].filter(Boolean).join(' ') || '—'

  return (
    <div className="space-y-6">
      {/* Top Navigation Link */}
      <div>
        <Link href="/app/properties" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Retour aux biens du marché
        </Link>
      </div>

      {/* Top Banner Card (Fiche Bien Header - Fiche Projet Design) */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              BIEN IMMOBILIER · {property.property_type ?? 'SECTEUR'}
            </div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {property.title ?? 'Bien sans titre'}
            </h1>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 mt-1">
              <MapPin className="size-4 text-primary shrink-0" />
              {address}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {property.url && (
              <Button variant="outline" size="sm" asChild className="rounded-full font-bold text-xs h-9">
                <a href={property.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5 mr-1.5 text-primary" />
                  Voir l'annonce
                </a>
              </Button>
            )}
            {!opportunity ? (
              <Button onClick={createOpportunity} disabled={creatingOpp} className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 shadow-xs">
                {creatingOpp ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Building2 className="size-3.5 mr-1.5" />}
                Créer un projet
              </Button>
            ) : (
              <Button asChild variant="secondary" className="rounded-full font-bold text-xs h-9">
                <Link href={`/admin/market/opportunities/${opportunity.id}`}>
                  <Star className="size-3.5 mr-1.5 text-amber-500 fill-amber-500" />
                  Ouvrir le projet
                </Link>
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Status & Highlight Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">STATUT DE L'ANNONCE</span>
              <Badge variant="outline" className={cn(
                "rounded-full text-xs font-bold mt-0.5",
                statusBadge.tone === 'success' && "border-emerald-200 bg-emerald-50 text-emerald-700",
                statusBadge.tone === 'neutral' && "border-border bg-muted text-muted-foreground",
                statusBadge.tone === 'warning' && "border-amber-200 bg-amber-50 text-amber-800"
              )}>
                {statusBadge.label}
              </Badge>
            </div>

            {mandate_score && (
              <div className="pl-4 border-l">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">MOTIVATION VENDEUR</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-foreground text-sm">{mandate_score.score}/100</span>
                  <SellerPhaseBadge phase={mandate_score.phase} />
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            Première détection : <strong className="text-foreground font-bold">{formatDate(property.first_seen_at)}</strong>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix actuel</p>
          <p className={cn("text-2xl font-bold", dropPercent ? 'text-destructive' : 'text-foreground')}>
            {formatPrice(property.price)}
          </p>
          {dropPercent != null && originalPrice != null ? (
            <p className="text-xs text-destructive font-bold flex items-center gap-1">
              <TrendingDown className="size-3.5" />
              -{dropPercent.toFixed(1)}% (était {formatPrice(originalPrice)})
            </p>
          ) : (
            <p className="text-xs text-muted-foreground font-medium">Prix d'origine fixe</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Surface Habitable</p>
          <p className="text-2xl font-bold text-foreground">
            {property.surface != null ? `${property.surface} m²` : '—'}
          </p>
          <p className="text-xs text-muted-foreground font-medium">
            {property.land_surface != null ? `Terrain : ${property.land_surface} m²` : 'Terrain non renseigné'}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix / m²</p>
          <p className="text-2xl font-bold text-foreground">{formatPrice(property.price_per_m2)}</p>
          <p className="text-xs text-muted-foreground font-medium">{property.property_type ?? 'Immobilier'}</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Jours en ligne</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-foreground">{daysOnline != null ? `${daysOnline} j` : '—'}</p>
            {daysOnline != null && daysOnline > 30 ? (
              <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px] font-bold rounded-full">
                Stagne
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Publié le {formatDate(property.published_at ?? property.first_seen_at)}
          </p>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-8">
          {/* Caractéristiques */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-5">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Home className="size-4 text-primary" />
                Caractéristiques du bien
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border bg-muted/30 p-4 text-center space-y-1">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto font-bold">
                  <Bed className="size-5" />
                </div>
                <p className="text-xl font-bold text-foreground pt-1">{property.bedrooms ?? '—'}</p>
                <p className="text-xs text-muted-foreground font-medium">Chambres</p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 text-center space-y-1">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto font-bold">
                  <Home className="size-5" />
                </div>
                <p className="text-xl font-bold text-foreground pt-1">{property.rooms ?? '—'}</p>
                <p className="text-xs text-muted-foreground font-medium">Pièces</p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 text-center space-y-1">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto font-bold">
                  <Ruler className="size-5" />
                </div>
                <p className="text-xl font-bold text-foreground pt-1">{property.surface != null ? `${property.surface} m²` : '—'}</p>
                <p className="text-xs text-muted-foreground font-medium">Surface habitable</p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 text-center space-y-1">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto font-bold">
                  <Zap className="size-5" />
                </div>
                {property.dpe ? (
                  <div className="pt-1">
                    <Badge variant="outline" className={cn('text-xs px-2.5 py-0.5 rounded-full font-bold', DPE_COLORS[property.dpe])}>
                      DPE {property.dpe}
                    </Badge>
                    <p className="text-xs text-muted-foreground font-medium mt-1">Diagnostic</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xl font-bold text-foreground pt-1">—</p>
                    <p className="text-xs text-muted-foreground font-medium">DPE non renseigné</p>
                  </>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              {property.property_type && (
                <Badge variant="outline" className="rounded-full text-xs font-bold">{property.property_type}</Badge>
              )}
              {tags.map((t) => (
                <Badge key={t.id} variant="secondary" className="rounded-full text-xs font-semibold">
                  <Tag className="size-3 mr-1" />
                  {t.tag}
                </Badge>
              ))}
              {tags.length === 0 && !property.property_type && (
                <span className="text-xs text-muted-foreground font-medium">Aucun tag pour ce bien</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Description de l'annonce
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line font-medium">
              {property.description?.trim() || 'Aucune description fournie dans l’annonce d’origine.'}
            </p>
          </div>

          {/* Historique des prix */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingDown className="size-4 text-primary" />
                Historique des prix
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Variations de prix détectées au fil des synchronisations.
              </p>
            </div>

            {price_history.length === 0 ? (
              <p className="text-xs text-muted-foreground font-medium py-2">Aucune variation de prix détectée depuis la première synchronisation.</p>
            ) : (
              <div className="space-y-2.5">
                {price_history.map((entry) => {
                  const variation = entry.variation_percent ?? 0
                  return (
                    <div key={entry.id} className="flex items-center justify-between rounded-xl border bg-muted/30 p-3.5 text-xs font-medium">
                      <div>
                        <p className="font-bold text-foreground">{formatDate(entry.detected_at)}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {formatPrice(entry.old_price)} → {formatPrice(entry.new_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('font-bold', variation < 0 ? 'text-destructive' : variation > 0 ? 'text-emerald-600' : '')}>
                          {variation > 0 ? '+' : ''}{variation}%
                        </p>
                        {entry.variation_amount != null && (
                          <p className="text-[11px] text-muted-foreground">{formatPrice(Math.abs(entry.variation_amount))}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Diffusions */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Link2 className="size-4 text-primary" />
                Diffusions & Portails
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Portails d'annonces qui publient ce même bien immobilier.
              </p>
            </div>

            {sources.length === 0 ? (
              <p className="text-xs text-muted-foreground font-medium py-2">Aucune diffusion historisée pour ce bien.</p>
            ) : (
              <div className="space-y-3">
                {sources.map((source) => (
                  <div key={source.id} className="rounded-xl border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{source.portal ?? source.source}</p>
                          <Badge variant="outline" className="rounded-full text-[10px] font-bold">{source.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground font-medium">
                          {formatPrice(source.price)} · Vu le {formatDate(source.last_seen_at)}
                        </p>
                      </div>
                      {source.url && (
                        <Button variant="outline" size="sm" asChild className="rounded-full h-8 text-xs font-semibold">
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-3.5 mr-1" /> Lien
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Doublons probables */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Doublons probables
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Biens similaires détectés sur le secteur à vérifier.
              </p>
            </div>

            {duplicate_candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground font-medium py-2">Aucun doublon probable détecté.</p>
            ) : (
              <div className="space-y-3">
                {duplicate_candidates.map((candidate) => {
                  const merging = resolvingDuplicateId === candidate.property.id + 'merge'
                  const rejecting = resolvingDuplicateId === candidate.property.id + 'reject'
                  return (
                    <div key={candidate.property.id} className="rounded-xl border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-bold text-foreground">{candidate.property.title ?? 'Bien sans titre'}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground font-medium">
                            {candidate.property.city && <span>{candidate.property.city}</span>}
                            <span>{formatPrice(candidate.property.price)}</span>
                            {candidate.property.surface != null && <span>{candidate.property.surface} m²</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] font-bold rounded-full">{candidate.score}% correspondance</Badge>
                      </div>

                      {candidate.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {candidate.reasons.map((reason) => (
                            <Badge key={reason} variant="secondary" className="text-[10px] font-medium rounded-full">{reason}</Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" onClick={() => resolveDuplicate(candidate, 'merge')} disabled={merging || rejecting} className="rounded-full bg-primary text-white font-bold text-xs h-8">
                          {merging ? <Loader2 className="mr-1 size-3 animate-spin" /> : <CheckCircle2 className="mr-1 size-3" />}
                          Rapprocher
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => resolveDuplicate(candidate, 'reject')} disabled={merging || rejecting} className="rounded-full font-semibold text-xs h-8">
                          {rejecting ? <Loader2 className="mr-1 size-3 animate-spin" /> : <XCircle className="mr-1 size-3" />}
                          Écarter
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="rounded-full text-xs font-semibold h-8">
                          <Link href={`/admin/market/properties/${candidate.property.id}`}>Ouvrir</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6 lg:col-span-4">
          {/* Projet / Opportunité liée Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Star className="size-4 text-amber-500 fill-amber-500" />
                Projet rattaché
              </h3>
            </div>

            {opportunity ? (
              <Link
                href={`/admin/market/opportunities/${opportunity.id}`}
                className="block rounded-xl border bg-muted/30 p-4 hover:border-primary/40 transition-all space-y-2"
              >
                <p className="text-sm font-bold text-foreground">{opportunity.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full text-[10px] font-bold">{opportunity.stage ?? '—'}</Badge>
                  {opportunity.priority ? (
                    <Badge variant="outline" className="rounded-full text-[10px] font-bold">{opportunity.priority}</Badge>
                  ) : null}
                </div>
              </Link>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Aucun projet vendeur n’est encore rattaché à ce bien.</p>
                <Button onClick={createOpportunity} disabled={creatingOpp} className="w-full rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 shadow-xs">
                  {creatingOpp ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Plus className="size-4 mr-1.5" />}
                  Créer un projet Vente
                </Button>
              </div>
            )}
          </div>

          {/* Profil du bien & Score Mandat */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Tag className="size-4 text-primary" />
                Profil du bien
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Typologie de vendeur, valorisation et contraintes du secteur.
              </p>
            </div>

            <DimensionBadges
              sellerType={property.seller_type}
              undervaluationPct={undervaluation_pct}
              dpe={property.dpe}
              status={property.status}
            />

            {mandate_score && (
              <div className="pt-3 border-t space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {mandate_score.score}
                    <span className="text-xs font-normal text-muted-foreground">/100</span>
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
              </div>
            )}
          </div>

          {/* Acquéreurs compatibles */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Acquéreurs compatibles ({potentialBuyers.length})
              </h3>
            </div>

            {loadingMatches ? (
              <p className="text-xs text-muted-foreground font-medium">Recherche d'acquéreurs…</p>
            ) : potentialBuyers.length === 0 ? (
              <p className="text-xs text-muted-foreground font-medium">Aucun acquéreur compatible dans votre base.</p>
            ) : (
              <div className="space-y-2.5">
                {potentialBuyers.map((match) => (
                  <div key={match.buyer_lead_id} className="rounded-xl border bg-muted/30 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Acquéreur #{match.buyer_lead_id.slice(0, 8)}</span>
                      <span className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
                        match.score >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200',
                      )}>
                        {match.score}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {match.matched_commune && <Badge variant="secondary" className="text-[10px] font-medium rounded-full">Commune</Badge>}
                      {match.matched_type && <Badge variant="secondary" className="text-[10px] font-medium rounded-full">Type</Badge>}
                      {match.matched_budget && <Badge variant="secondary" className="text-[10px] font-medium rounded-full">Budget</Badge>}
                      {match.matched_surface && <Badge variant="secondary" className="text-[10px] font-medium rounded-full">Surface</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-sm font-bold text-foreground">Notes & Prises de vue</h3>
            </div>

            {notes.length > 0 && (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-xl border bg-muted/30 p-3 text-xs">
                    <p className="font-medium text-foreground whitespace-pre-line">{n.note}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-medium">{formatDate(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Ajouter une note..."
                className="h-9 rounded-xl text-xs bg-background"
                onKeyDown={(e) => { if (e.key === 'Enter') void addNote() }}
              />
              <Button size="sm" onClick={() => void addNote()} disabled={savingNote || !noteDraft.trim()} className="rounded-full h-9 px-3">
                {savingNote ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

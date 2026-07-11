'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  MapPin,
  Home,
  Euro,
  Maximize2,
  DoorOpen,
  TrendingUp,
  RefreshCw,
  Users,
  Building2,
  Loader2,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddBuyerModal } from '@/components/admin/AddBuyerModal'

interface MatchResult {
  id: string
  buyer_lead_id: string
  property_id: string | null
  seller_lead_id: string | null
  property_type: 'market' | 'seller'
  score: number
  score_details: {
    commune: number
    type: number
    budget: number
    surface: number
    pieces: number
  }
  matched_commune: boolean
  matched_type: boolean
  matched_budget: boolean
  matched_surface: boolean
  matched_pieces: boolean
  property: {
    id: string
    title?: string | null
    city?: string | null
    zipcode?: string | null
    property_type?: string | null
    price?: number | null
    surface?: number | null
    rooms?: number | null
    price_per_m2?: number | null
    dpe?: string | null
    status?: string | null
    url?: string | null
    // seller properties
    type_bien?: string | null
    nb_pieces?: number | null
    prix_estime?: number | null
    adresse?: string | null
    etat?: string | null
  } | null
}

interface BuyerLead {
  lead_id: string
  type_bien: string | null
  communes: string[] | null
  budget_max: number | null
  surface_min: number | null
  pieces_min: number | null
  matched_at: string | null
  active: boolean
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
  if (score >= 60) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-muted-foreground bg-muted border-border'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Bon'
  if (score >= 40) return 'Moyen'
  return 'Faible'
}

export default function MatchingPage() {
  const [buyers, setBuyers] = useState<BuyerLead[]>([])
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [running, setRunning] = useState(false)

  // Charger la liste des acheteurs
  const loadBuyers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/matching/buyers')
      if (res.ok) {
        const data = await res.json()
        setBuyers(data.buyers ?? [])
      }
    } catch (e) {
      console.error('Erreur chargement acheteurs:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Charger les matchs pour un acheteur
  const loadMatches = useCallback(async (buyerLeadId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/market/matching?buyer_lead_id=${buyerLeadId}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setMatches(data.matches ?? [])
      }
    } catch (e) {
      console.error('Erreur chargement matchs:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Exécuter le matching pour un acheteur
  const runMatching = async (buyerLeadId: string) => {
    setRunning(true)
    try {
      const res = await fetch('/api/market/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_lead_id: buyerLeadId }),
      })
      if (res.ok) {
        await loadMatches(buyerLeadId)
      }
    } catch (e) {
      console.error('Erreur matching:', e)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    loadBuyers()
  }, [loadBuyers])

  useEffect(() => {
    if (selectedBuyer) {
      loadMatches(selectedBuyer)
    }
  }, [selectedBuyer, loadMatches])

  const filteredBuyers = buyers.filter((b) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      b.type_bien?.toLowerCase().includes(q) ||
      b.communes?.some((c) => c.toLowerCase().includes(q)) ||
      b.lead_id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matching</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mise en relation acquéreurs / vendeurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddBuyerModal
            onBuyerAdded={loadBuyers}
            onBuyerSelected={(leadId) => setSelectedBuyer(leadId)}
          />
          <Badge variant="outline" className="text-xs">
            {buyers.length} acheteur{buyers.length > 1 ? 's' : ''} actif{buyers.length > 1 ? 's' : ''}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedBuyer && runMatching(selectedBuyer)}
            disabled={!selectedBuyer || running}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${running ? 'animate-spin' : ''}`} />
            Re-marcher
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Liste des acheteurs */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Acquéreurs
            </CardTitle>
            <CardDescription>Sélectionnez un acheteur pour voir ses matchs</CardDescription>
            <div className="pt-2">
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
            {loading && buyers.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Chargement...
              </div>
            ) : filteredBuyers.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucun acheteur trouvé</p>
              </div>
            ) : (
              filteredBuyers.map((buyer) => (
                <button
                  key={buyer.lead_id}
                  onClick={() => setSelectedBuyer(buyer.lead_id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors text-sm hover:bg-accent/50 ${
                    selectedBuyer === buyer.lead_id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate">
                      {buyer.type_bien ? (
                        <>{buyer.type_bien === 'appartement' ? '🏢' : buyer.type_bien === 'maison' ? '🏡' : '🏠'} {buyer.type_bien}</>
                      ) : 'Recherche non spécifiée'}
                    </span>
                    {buyer.matched_at && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        Matché
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {buyer.communes?.slice(0, 3).map((c) => (
                      <span key={c} className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />{c}
                      </span>
                    ))}
                    {buyer.budget_max && (
                      <span className="inline-flex items-center gap-0.5">
                        <Euro className="h-3 w-3" />{formatPrice(buyer.budget_max)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Résultats de matching */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Résultats
            </CardTitle>
            <CardDescription>
              {selectedBuyer
                ? `${matches.length} bien${matches.length > 1 ? 's' : ''} trouvé${matches.length > 1 ? 's' : ''}`
                : 'Sélectionnez un acheteur pour voir les matchs'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBuyer ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Sélectionnez un acheteur dans la liste de gauche</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Chargement des matchs...
              </div>
            ) : matches.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun match trouvé</p>
                <p className="text-xs mt-1">Cliquez sur "Re-marcher" pour exécuter le matching</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreColor(match.score)}`}>
                          {match.score}% — {getScoreLabel(match.score)}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {match.property_type === 'market' ? 'Marché' : 'Vendeur'}
                        </Badge>
                      </div>
                      <div className="flex gap-1 text-xs text-muted-foreground">
                        {match.score_details.commune > 0 && <Badge variant="secondary" className="text-[10px] h-5">📍</Badge>}
                        {match.score_details.type > 0 && <Badge variant="secondary" className="text-[10px] h-5">🏠</Badge>}
                        {match.score_details.budget > 0 && <Badge variant="secondary" className="text-[10px] h-5">💰</Badge>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {/* Infos du bien */}
                      <div>
                        <p className="font-medium mb-1">
                          {match.property?.title ?? match.property?.property_type ?? match.property?.type_bien ?? 'Bien'}
                        </p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {match.property?.city && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {match.property.city}
                            </div>
                          )}
                          {match.property?.price && (
                            <div className="flex items-center gap-1">
                              <Euro className="h-3 w-3" />
                              {formatPrice(match.property.price)}
                            </div>
                          )}
                          {match.property?.surface && (
                            <div className="flex items-center gap-1">
                              <Maximize2 className="h-3 w-3" />
                              {match.property.surface} m²
                            </div>
                          )}
                          {match.property?.rooms ?? match.property?.nb_pieces ? (
                            <div className="flex items-center gap-1">
                              <DoorOpen className="h-3 w-3" />
                              {match.property?.rooms ?? match.property?.nb_pieces} pièces
                            </div>
                          ) : null}
                          {match.property?.prix_estime && (
                            <div className="flex items-center gap-1">
                              <Euro className="h-3 w-3" />
                              Estimé {formatPrice(match.property.prix_estime)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Détail du score */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Détail du score</p>
                        <div className="space-y-1.5">
                          <ScoreBar label="Commune" value={match.score_details.commune} max={30} matched={match.matched_commune} />
                          <ScoreBar label="Type" value={match.score_details.type} max={20} matched={match.matched_type} />
                          <ScoreBar label="Budget" value={match.score_details.budget} max={25} matched={match.matched_budget} />
                          <ScoreBar label="Surface" value={match.score_details.surface} max={15} matched={match.matched_surface} />
                          <ScoreBar label="Pièces" value={match.score_details.pieces} max={10} matched={match.matched_pieces} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, max, matched }: { label: string; value: number; max: number; matched: boolean }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            matched ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-[10px] text-muted-foreground">{value}/{max}</span>
    </div>
  )
}
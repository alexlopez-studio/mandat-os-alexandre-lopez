'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, DoorOpen, Euro, ExternalLink, Loader2, MapPin, Maximize2, RefreshCw, Save, Trash2, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { DossierWorkspace } from '../../clients/DossierWorkspace'
import communesData from '@/data/communes.json'

type CommuneEntry = {
  name: string
  postalCode: string
  department: string
  region: string
}

const COMMUNES: CommuneEntry[] = (communesData as CommuneEntry[]).sort((a, b) =>
  a.name.localeCompare(b.name, 'fr')
)

const BUYER_STAGES = [
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

interface MatchResult {
  id: string
  buyer_lead_id: string
  property_id: string | null
  seller_lead_id: string | null
  property_type: 'market' | 'seller'
  score: number
  matched_commune: boolean
  matched_type: boolean
  matched_budget: boolean
  matched_surface: boolean
  matched_pieces: boolean
  property: {
    id: string
    title?: string | null
    city?: string | null
    property_type?: string | null
    type_bien?: string | null
    price?: number | null
    prix_estime?: number | null
    surface?: number | null
    rooms?: number | null
    nb_pieces?: number | null
  } | null
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price)
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Bon'
  if (score >= 40) return 'Moyen'
  return 'Faible'
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'border-green-200 bg-green-50 text-green-700'
  if (score >= 60) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (score >= 40) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-border bg-muted text-muted-foreground'
}

function matchReasons(match: MatchResult) {
  return [
    match.matched_commune ? 'Commune' : null,
    match.matched_budget ? 'Budget' : null,
    match.matched_type ? 'Type' : null,
    match.matched_surface ? 'Surface' : null,
    match.matched_pieces ? 'Pièces' : null,
  ].filter((reason): reason is string => Boolean(reason))
}

export default function EditAcquereurPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type_bien: '',
    communes: [] as string[],
    budget_max: '',
    surface_min: '',
    pieces_min: '',
    criteres: [] as string[],
    active: true,
    stage: 'Nouveau contact',
    next_action: '',
    due_date: '',
  })
  const [communeSearch, setCommuneSearch] = useState('')
  const [critereInput, setCritereInput] = useState('')
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [matchingLoading, setMatchingLoading] = useState(true)
  const [runningMatching, setRunningMatching] = useState(false)
  const [clientDossier, setClientDossier] = useState<{ id: string; status: string } | null>(null)
  const [creatingDossier, setCreatingDossier] = useState(false)

  const loadMatches = useCallback(async () => {
    setMatchingLoading(true)
    try {
      const res = await fetch(`/api/market/matching?buyer_lead_id=${leadId}&limit=12&min_score=40`)
      const data = await res.json()
      if (res.ok) setMatches(data.matches ?? [])
    } catch (e) {
      console.error('Erreur chargement biens compatibles:', e)
    } finally {
      setMatchingLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    const loadBuyer = async () => {
      try {
        const res = await fetch(`/api/market/buyers/${leadId}`)
        if (!res.ok) {
          toast.error('Acquéreur non trouvé')
          router.push('/app/opportunities?tab=acquereurs')
          return
        }
        const data = await res.json()
        const buyer = data.buyer
        setForm({
          type_bien: buyer.type_bien || '',
          communes: buyer.communes || [],
          budget_max: buyer.budget_max?.toString() || '',
          surface_min: buyer.surface_min?.toString() || '',
          pieces_min: buyer.pieces_min?.toString() || '',
          criteres: buyer.criteres || [],
          active: buyer.active,
          stage: buyer.stage || 'Nouveau contact',
          next_action: buyer.next_action || '',
          due_date: buyer.due_date || '',
        })
        setClientDossier(data.client_dossier ?? null)
      } catch (e) {
        console.error('Erreur chargement:', e)
        toast.error('Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    loadBuyer()
  }, [leadId, router])

  useEffect(() => {
    void loadMatches()
  }, [loadMatches])

  async function createDossier() {
    setCreatingDossier(true)
    try {
      const res = await fetch('/api/market/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_type: 'buyer', buyer_lead_id: leadId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Création impossible')
      toast.success('Dossier créé')
      const refreshed = await fetch(`/api/market/buyers/${leadId}`)
      const data = await refreshed.json()
      if (refreshed.ok) setClientDossier(data.client_dossier ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setCreatingDossier(false)
    }
  }

  const filteredCommunes = communeSearch
    ? COMMUNES.filter(
        (c) =>
          c.name.toLowerCase().includes(communeSearch.toLowerCase()) ||
          c.postalCode.includes(communeSearch)
      ).slice(0, 20)
    : []

  const addCommune = (commune: string) => {
    if (!form.communes.includes(commune)) {
      setForm((prev) => ({ ...prev, communes: [...prev.communes, commune] }))
    }
    setCommuneSearch('')
  }

  const removeCommune = (commune: string) => {
    setForm((prev) => ({
      ...prev,
      communes: prev.communes.filter((c) => c !== commune),
    }))
  }

  const addCritere = () => {
    const value = critereInput.trim()
    if (value && !form.criteres.includes(value)) {
      setForm((prev) => ({ ...prev, criteres: [...prev.criteres, value] }))
    }
    setCritereInput('')
  }

  const removeCritere = (critere: string) => {
    setForm((prev) => ({
      ...prev,
      criteres: prev.criteres.filter((c) => c !== critere),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/market/buyers/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_bien: form.type_bien || null,
          communes: form.communes.length > 0 ? form.communes : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          surface_min: form.surface_min ? Number(form.surface_min) : null,
          pieces_min: form.pieces_min ? Number(form.pieces_min) : null,
          criteres: form.criteres.length > 0 ? form.criteres : null,
          active: form.active,
          stage: form.stage,
          next_action: form.next_action || null,
          due_date: form.due_date || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la mise à jour')
        return
      }

      toast.success('Acquéreur mis à jour')
    } catch (e) {
      console.error('Erreur mise à jour:', e)
      toast.error('Erreur serveur')
    } finally {
      setSaving(false)
    }
  }

  const handleDesactivate = async () => {
    try {
      const res = await fetch(`/api/market/buyers/${leadId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Acquéreur désactivé')
        setForm((prev) => ({ ...prev, active: false }))
      }
    } catch (e) {
      console.error('Erreur désactivation:', e)
      toast.error('Erreur serveur')
    }
  }

  const runMatching = async () => {
    setRunningMatching(true)
    try {
      const res = await fetch('/api/market/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_lead_id: leadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Matching impossible')
      await loadMatches()
      toast.success('Matching acquéreur mis à jour')
    } catch (e) {
      console.error('Erreur matching:', e)
      toast.error(e instanceof Error ? e.message : 'Erreur matching')
    } finally {
      setRunningMatching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/opportunities?tab=acquereurs">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour aux acquéreurs
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Opportunité acquéreur</h1>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                Opportunité acquéreur
              </Badge>
              <Badge variant="outline">{form.stage}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Lead ID: {leadId}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDesactivate}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Désactiver
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Critères de recherche</CardTitle>
            <CardDescription>
              Modifiez les critères de recherche de l'acquéreur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type de bien */}
            <div className="space-y-2">
              <Label htmlFor="type_bien">Type de bien recherché</Label>
              <Select
                value={form.type_bien}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type_bien: value }))}
              >
                <SelectTrigger id="type_bien" className="max-w-xs">
                  <SelectValue placeholder="Tous types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maison">Maison</SelectItem>
                  <SelectItem value="appartement">Appartement</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Communes */}
            <div className="space-y-2">
              <Label>Communes recherchées</Label>
              <div className="relative max-w-md">
                <Input
                  placeholder="Rechercher une commune..."
                  value={communeSearch}
                  onChange={(e) => setCommuneSearch(e.target.value)}
                />
                {communeSearch && filteredCommunes.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-y-auto">
                    {filteredCommunes.map((c) => (
                      <button
                        key={`${c.postalCode}-${c.name}`}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => addCommune(c.name)}
                      >
                        {c.name} ({c.postalCode})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.communes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.communes.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1"
                    >
                      {c}
                      <button
                        type="button"
                        className="hover:text-destructive"
                        onClick={() => removeCommune(c)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Budget max */}
            <div className="space-y-2">
              <Label htmlFor="budget_max">Budget maximum (€)</Label>
              <Input
                id="budget_max"
                type="number"
                placeholder="Ex: 300000"
                value={form.budget_max}
                onChange={(e) => setForm((prev) => ({ ...prev, budget_max: e.target.value }))}
                className="max-w-xs"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Surface min */}
              <div className="space-y-2">
                <Label htmlFor="surface_min">Surface minimale (m²)</Label>
                <Input
                  id="surface_min"
                  type="number"
                  placeholder="Ex: 70"
                  value={form.surface_min}
                  onChange={(e) => setForm((prev) => ({ ...prev, surface_min: e.target.value }))}
                />
              </div>

              {/* Nb pièces min */}
              <div className="space-y-2">
                <Label htmlFor="pieces_min">Nombre de pièces minimum</Label>
                <Input
                  id="pieces_min"
                  type="number"
                  placeholder="Ex: 3"
                  value={form.pieces_min}
                  onChange={(e) => setForm((prev) => ({ ...prev, pieces_min: e.target.value }))}
                />
              </div>
            </div>

            {/* Critères additionnels */}
            <div className="space-y-2">
              <Label>Critères additionnels</Label>
              <div className="flex gap-2 max-w-md">
                <Input
                  placeholder="Ex: avec jardin, piscine..."
                  value={critereInput}
                  onChange={(e) => setCritereInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCritere()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addCritere}>
                  Ajouter
                </Button>
              </div>
              {form.criteres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.criteres.map((cr) => (
                    <span
                      key={cr}
                      className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2.5 py-1"
                    >
                      {cr}
                      <button
                        type="button"
                        className="hover:text-destructive"
                        onClick={() => removeCritere(cr)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Statut actif */}
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="stage">Statut commercial</Label>
                <Select
                  value={form.stage}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, stage: value }))}
                >
                  <SelectTrigger id="stage">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUYER_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_action">Prochaine action</Label>
                <Input
                  id="next_action"
                  value={form.next_action}
                  onChange={(e) => setForm((prev) => ({ ...prev, next_action: e.target.value }))}
                  placeholder="Ex: envoyer 3 biens"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Échéance</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Statut actif */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="active" className="cursor-pointer">
                Acquéreur actif (pourra être matché avec des biens)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" asChild>
            <Link href="/app/opportunities?tab=acquereurs">Annuler</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            <Save className="h-4 w-4 mr-1" />
            Enregistrer les modifications
          </Button>
        </div>
      </form>

      {clientDossier ? (
        <DossierWorkspace dossierId={clientDossier.id} />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-base font-semibold">Suivi du mandat de recherche</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {form.stage === 'Mandat de recherche signé'
                ? 'Le mandat de recherche est signé : crée le dossier pour activer documents, plan, visites et offres — partagés avec le client.'
                : 'Les documents, le plan, les visites et les offres apparaissent ici une fois l’opportunité passée en « Mandat de recherche signé ».'}
            </p>
            {form.stage === 'Mandat de recherche signé' && (
              <Button size="sm" className="mt-4" onClick={createDossier} disabled={creatingDossier}>
                {creatingDossier ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Créer le dossier
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Biens compatibles
            </CardTitle>
            <CardDescription>
              Matching clair par commune, budget, type, surface et pièces.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={runMatching} disabled={runningMatching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${runningMatching ? 'animate-spin' : ''}`} />
            Lancer le matching
          </Button>
        </CardHeader>
        <CardContent>
          {matchingLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement des biens compatibles...
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun bien compatible pour l’instant.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {matches.map((match) => {
                const property = match.property
                const propertyLink = match.property_type === 'market' && match.property_id
                  ? `/app/properties/${match.property_id}`
                  : match.seller_lead_id
                    ? `/app/leads/${match.seller_lead_id}`
                    : null
                const reasons = matchReasons(match)

                return (
                  <div key={match.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {property?.title ?? property?.property_type ?? property?.type_bien ?? 'Bien'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {match.property_type === 'market' ? 'Bien marché' : 'Opportunité vendeur'}
                        </p>
                      </div>
                      <Badge variant="outline" className={`h-6 text-xs ${getScoreClass(match.score)}`}>
                        {getScoreLabel(match.score)} · {match.score}%
                      </Badge>
                    </div>

                    <div className="mb-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                      {property?.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {property.city}
                        </span>
                      )}
                      {(property?.price || property?.prix_estime) && (
                        <span className="inline-flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          {formatPrice(property.price ?? property.prix_estime)}
                        </span>
                      )}
                      {property?.surface && (
                        <span className="inline-flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" />
                          {property.surface} m²
                        </span>
                      )}
                      {(property?.rooms || property?.nb_pieces) && (
                        <span className="inline-flex items-center gap-1">
                          <DoorOpen className="h-3 w-3" />
                          {property.rooms ?? property.nb_pieces} pièces
                        </span>
                      )}
                    </div>

                    <div className="mb-4 flex flex-wrap gap-1">
                      {reasons.length > 0 ? reasons.map((reason) => (
                        <Badge key={reason} variant="secondary" className="text-[10px]">
                          {reason}
                        </Badge>
                      )) : (
                        <span className="text-xs text-muted-foreground">Raisons à recalculer</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {propertyLink && (
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={propertyLink}>
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Ouvrir le bien
                          </Link>
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => toast.info('Proposition à journaliser dans la prochaine étape CRM')}>
                        Proposer
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => toast.info('Planification de visite à relier au calendrier')}>
                        Planifier visite
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

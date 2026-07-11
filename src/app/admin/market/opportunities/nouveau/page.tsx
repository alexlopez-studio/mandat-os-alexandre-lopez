'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Home, Loader2, Plus, Search, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Priority = 'low' | 'medium' | 'high' | 'critical'

type ContactMode = 'existing' | 'new'

type LeadOption = {
  id: string
  tool: string
  commune: string | null
  priority: Priority
  next_action: string | null
  prospect: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
  }
  seller_property?: { type_bien?: string | null } | null
  opportunity?: { id: string; title: string; stage: string | null; priority: string | null } | null
}

type PropertyOption = {
  id: string
  title: string | null
  city: string | null
  zipcode: string | null
  price: number | null
  surface: number | null
  property_type: string | null
  status: string | null
  seller_type: string | null
  thumbnail_url: string | null
  opportunity: { id: string; title: string; stage: string | null; priority: string | null } | null
}

const STAGES = [
  { id: 'Veille annonce', label: 'Veille annonce' },
  { id: 'Nouveau contact', label: 'Nouveau contact' },
  { id: 'Pré-estimation', label: 'Pré-estimation' },
  { id: "Visite d'estimation", label: "Visite d'estimation" },
  { id: "Remise de l'estimation", label: "Remise de l'estimation" },
  { id: 'Décision vendeur', label: 'Décision vendeur' },
  { id: 'Suivi moyen terme', label: 'Suivi moyen terme' },
]

const SOURCE_OPTIONS = [
  { value: 'estimation_site', label: 'Estimation site' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'porte_a_porte', label: 'Porte-à-porte' },
  { value: 'appel_entrant', label: 'Appel entrant' },
  { value: 'prospection', label: 'Prospection' },
  { value: 'recommandation', label: 'Recommandation' },
  { value: 'annonce_particulier', label: 'Annonce particulier' },
  { value: 'annonce_agence', label: 'Annonce agence' },
  { value: 'autre', label: 'Autre' },
]

const PROPERTY_TYPE_OPTIONS = [
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'autre', label: 'Autre' },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function optionLabel(options: Array<{ value: string; label: string }>, value: string | null) {
  if (!value) return null
  return options.find((option) => option.value === value)?.label ?? value
}

function buildTitle(input: { sellerName: string; sellerPhone: string; propertyCity: string; propertyType: string }) {
  const propertyType = optionLabel(PROPERTY_TYPE_OPTIONS, input.propertyType)
  const place = [propertyType, input.propertyCity.trim()].filter(Boolean).join(' ')
  if (input.sellerName.trim()) return [input.sellerName.trim(), place].filter(Boolean).join(' - ')
  if (place) return `Vendeur - ${place}`
  if (input.sellerPhone.trim()) return `Vendeur - ${input.sellerPhone.trim()}`
  return 'Opportunité vendeur'
}

function NouveauVendeurContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialStage = searchParams.get('stage')
  const normalizedInitialStage = STAGES.some((stage) => stage.id === initialStage) ? initialStage ?? 'Nouveau contact' : 'Nouveau contact'

  const [mode, setMode] = useState<ContactMode>('existing')
  const [leadSearch, setLeadSearch] = useState('')
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [propertySearch, setPropertySearch] = useState('')
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([])
  const [propertyLoading, setPropertyLoading] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sellerName: '',
    sellerPhone: '',
    sellerEmail: '',
    sourceChannel: 'prospection',
    propertyCity: '',
    propertyType: '',
    stage: normalizedInitialStage,
    priority: 'medium' as Priority,
    nextAction: 'Qualifier le projet vendeur',
    dueDate: '',
  })

  const selectedProperty = useMemo(
    () => propertyOptions.find((property) => property.id === selectedPropertyId) ?? null,
    [propertyOptions, selectedPropertyId],
  )

  const selectedLead = useMemo(
    () => leadOptions.find((lead) => lead.id === selectedLeadId) ?? null,
    [leadOptions, selectedLeadId],
  )

  const loadLeads = useCallback(async (q = '') => {
    try {
      const params = new URLSearchParams({ page_size: '50' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch('/api/leads/list?' + params.toString())
      const data = await res.json()
      if (data.success) setLeadOptions(data.data ?? [])
    } catch (error) {
      console.error('Erreur chargement contacts', error)
    }
  }, [])

  const loadProperties = useCallback(async (q = '') => {
    setPropertyLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', sort: 'last_seen_at.desc' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch('/api/market/properties?' + params.toString())
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setPropertyOptions(data.properties ?? [])
    } catch (error) {
      console.error('Erreur chargement biens', error)
      toast.error('Impossible de charger les biens')
    } finally {
      setPropertyLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLeads(leadSearch)
    }, 250)
    return () => clearTimeout(timer)
  }, [leadSearch, loadLeads])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProperties(propertySearch)
    }, 250)
    return () => clearTimeout(timer)
  }, [propertySearch, loadProperties])

  const hasNewContact = Boolean(form.sellerName.trim() || form.sellerPhone.trim() || form.sellerEmail.trim())
  const canSave = Boolean(selectedPropertyId || selectedLeadId || (mode === 'new' && hasNewContact))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) {
      toast.error('Sélectionne un contact, crée un contact ou rattache un bien')
      return
    }

    setSaving(true)
    try {
      const sourceChannel = selectedProperty
        ? (selectedProperty.seller_type === 'agency' ? 'annonce_agence' : 'annonce_particulier')
        : form.sourceChannel
      const agencyWatch = Boolean(selectedProperty?.seller_type === 'agency' && !selectedLeadId && mode === 'existing')

      const res = await fetch('/api/market/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_property_id: selectedPropertyId || null,
          lead_id: mode === 'existing' ? selectedLeadId || null : null,
          create_lead: mode === 'new',
          lead: mode === 'new' ? {
            seller_name: form.sellerName,
            phone: form.sellerPhone,
            email: form.sellerEmail,
            source_channel: sourceChannel,
            commune: form.propertyCity,
            type_bien: form.propertyType,
            priority: form.priority,
          } : undefined,
          title: mode === 'new' ? buildTitle(form) : selectedProperty?.title ?? undefined,
          stage: agencyWatch ? 'Veille annonce' : form.stage,
          priority: form.priority,
          signal_type: 'manual',
          source_channel: sourceChannel,
          property_city: form.propertyCity || null,
          property_type: form.propertyType || null,
          next_action: form.nextAction.trim() || null,
          due_date: form.dueDate || null,
          created_from: 'manual',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Création impossible')
      toast.success(data.existing ? 'Opportunité existante ouverte' : 'Vendeur créé')
      router.push(`/app/opportunities/${data.opportunity.id}`)
    } catch (error) {
      console.error('Erreur création vendeur', error)
      toast.error(error instanceof Error ? error.message : 'Création impossible')
    } finally {
      setSaving(false)
    }
  }

  function selectLead(lead: LeadOption) {
    setSelectedLeadId(lead.id)
    setForm((current) => ({
      ...current,
      priority: lead.priority,
      propertyCity: lead.commune ?? current.propertyCity,
      propertyType: lead.seller_property?.type_bien ?? current.propertyType,
      nextAction: lead.next_action ?? current.nextAction,
    }))
  }

  function selectProperty(property: PropertyOption) {
    setSelectedPropertyId(property.id)
    setForm((current) => ({
      ...current,
      propertyCity: current.propertyCity || property.city || '',
      propertyType: current.propertyType || property.property_type || '',
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/opportunities">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nouveau vendeur</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Créer une opportunité vendeur à partir d’un contact et, si besoin, d’un bien déjà en annonce.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Recherche un contact existant avant de créer une nouvelle fiche.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', mode === 'existing' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                Contact existant
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('new')
                  setSelectedLeadId('')
                }}
                className={cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', mode === 'new' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                Nouveau contact
              </button>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-3">
                <div className="relative max-w-lg">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Nom, téléphone, email..." className="pl-9" />
                </div>
                <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border p-2 md:grid-cols-2">
                  {leadOptions.length === 0 ? (
                    <p className="col-span-full px-2 py-8 text-center text-sm text-muted-foreground">Aucun contact trouvé</p>
                  ) : leadOptions.map((lead) => {
                    const name = [lead.prospect.first_name, lead.prospect.last_name].filter(Boolean).join(' ').trim() || 'Contact'
                    const selected = selectedLeadId === lead.id
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        disabled={Boolean(lead.opportunity)}
                        onClick={() => selectLead(lead)}
                        className={cn(
                          'rounded-md border p-3 text-left transition-colors',
                          selected ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted/50',
                          lead.opportunity && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{name}</span>
                          {lead.opportunity && <Badge variant="outline" className="text-[10px]">déjà lié</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {lead.prospect.phone && <span>{lead.prospect.phone}</span>}
                          {lead.prospect.email && <span>{lead.prospect.email}</span>}
                          {lead.commune && <span>{lead.commune}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="seller_name">Nom vendeur</Label>
                  <Input id="seller_name" value={form.sellerName} onChange={(event) => setForm((current) => ({ ...current, sellerName: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seller_phone">Téléphone</Label>
                  <Input id="seller_phone" value={form.sellerPhone} onChange={(event) => setForm((current) => ({ ...current, sellerPhone: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seller_email">Email</Label>
                  <Input id="seller_email" type="email" value={form.sellerEmail} onChange={(event) => setForm((current) => ({ ...current, sellerEmail: event.target.value }))} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bien en annonce</CardTitle>
            <CardDescription>Rattache un bien déjà importé si le vendeur vient d’une annonce en ligne.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={propertySearch} onChange={(event) => setPropertySearch(event.target.value)} placeholder="Titre, commune, code postal..." className="pl-9" />
              </div>
              {selectedPropertyId && (
                <Button type="button" variant="outline" onClick={() => setSelectedPropertyId('')}>
                  Retirer le bien
                </Button>
              )}
            </div>
            <div className="grid max-h-80 gap-2 overflow-y-auto rounded-lg border p-2 lg:grid-cols-2">
              {propertyLoading ? (
                <div className="col-span-full flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des biens
                </div>
              ) : propertyOptions.length === 0 ? (
                <p className="col-span-full px-2 py-8 text-center text-sm text-muted-foreground">Aucun bien trouvé</p>
              ) : propertyOptions.map((property) => {
                const selected = selectedPropertyId === property.id
                const alreadyLinked = Boolean(property.opportunity)
                return (
                  <button
                    key={property.id}
                    type="button"
                    disabled={alreadyLinked}
                    onClick={() => selectProperty(property)}
                    className={cn(
                      'rounded-md border p-3 text-left transition-colors',
                      selected ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted/50',
                      alreadyLinked && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                        {property.thumbnail_url ? (
                          <div className="h-full w-full bg-cover bg-center" role="img" aria-label={property.title ?? 'Miniature du bien'} style={{ backgroundImage: `url("${property.thumbnail_url}")` }} />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Home className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-medium">{property.title ?? 'Bien en annonce'}</p>
                          {property.price != null && <span className="shrink-0 text-xs font-medium">{formatPrice(property.price)}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {[property.property_type, property.city, property.zipcode].filter(Boolean).map((item) => <span key={item}>{item}</span>)}
                          {property.surface != null && <span>{property.surface} m²</span>}
                          {property.seller_type && <span>{property.seller_type}</span>}
                        </div>
                        {alreadyLinked && <Badge variant="outline" className="mt-2 text-[10px]">déjà lié</Badge>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Affaire vendeur</CardTitle>
            <CardDescription>Cadre la première étape commerciale et la prochaine action.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.sourceChannel} onValueChange={(value) => setForm((current) => ({ ...current, sourceChannel: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Étape</Label>
              <Select value={form.stage} onValueChange={(value) => setForm((current) => ({ ...current, stage: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commune</Label>
              <Input value={form.propertyCity} onChange={(event) => setForm((current) => ({ ...current, propertyCity: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Type de bien</Label>
              <Select value={form.propertyType} onValueChange={(value) => setForm((current) => ({ ...current, propertyType: value }))}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as Priority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="critical">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Échéance</Label>
              <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Prochaine action</Label>
              <Input value={form.nextAction} onChange={(event) => setForm((current) => ({ ...current, nextAction: event.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/app/opportunities">Annuler</Link>
          </Button>
          <Button type="submit" disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Créer le vendeur
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NouveauVendeurPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement du formulaire...</div>}>
      <NouveauVendeurContent />
    </Suspense>
  )
}

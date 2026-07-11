'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Search, Save } from 'lucide-react'
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
import communesData from '@/data/communes.json'

type ContactMode = 'existing' | 'new'

type CommuneEntry = {
  name: string
  postalCode: string
  department: string
  region: string
}

type LeadOption = {
  id: string
  tool: string
  commune: string | null
  priority: string
  next_action: string | null
  prospect: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
  }
}

const COMMUNES: CommuneEntry[] = (communesData as CommuneEntry[]).sort((a, b) =>
  a.name.localeCompare(b.name, 'fr'),
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

export default function NouvelAcquereurPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<ContactMode>('existing')
  const [leadSearch, setLeadSearch] = useState('')
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    type_bien: '',
    communes: [] as string[],
    budget_max: '',
    surface_min: '',
    pieces_min: '',
    criteres: [] as string[],
    active: true,
    stage: 'Nouveau contact',
    next_action: 'Qualifier la recherche acquéreur',
    due_date: '',
  })
  const [communeSearch, setCommuneSearch] = useState('')
  const [critereInput, setCritereInput] = useState('')

  const selectedLead = useMemo(
    () => leadOptions.find((lead) => lead.id === selectedLeadId) ?? null,
    [leadOptions, selectedLeadId],
  )

  const filteredCommunes = communeSearch
    ? COMMUNES.filter(
      (commune) =>
        commune.name.toLowerCase().includes(communeSearch.toLowerCase()) ||
        commune.postalCode.includes(communeSearch),
    ).slice(0, 20)
    : []

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

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLeads(leadSearch)
    }, 250)
    return () => clearTimeout(timer)
  }, [leadSearch, loadLeads])

  const addCommune = (commune: string) => {
    if (!form.communes.includes(commune)) {
      setForm((prev) => ({ ...prev, communes: [...prev.communes, commune] }))
    }
    setCommuneSearch('')
  }

  const removeCommune = (commune: string) => {
    setForm((prev) => ({
      ...prev,
      communes: prev.communes.filter((item) => item !== commune),
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
      criteres: prev.criteres.filter((item) => item !== critere),
    }))
  }

  const hasNewContact = Boolean(form.first_name.trim() || form.last_name.trim() || form.phone.trim() || form.email.trim())
  const hasCriteria = Boolean(form.type_bien || form.communes.length > 0 || form.budget_max)
  const canSave = Boolean(selectedLeadId || (mode === 'new' && hasNewContact) || hasCriteria)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return

    setSaving(true)
    try {
      const res = await fetch('/api/market/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: mode === 'existing' ? selectedLeadId || null : null,
          prospect_id: mode === 'existing' ? selectedLead?.prospect.id ?? null : null,
          first_name: mode === 'new' ? form.first_name : null,
          last_name: mode === 'new' ? form.last_name : null,
          phone: mode === 'new' ? form.phone : null,
          email: mode === 'new' ? form.email : null,
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

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la création')
        return
      }

      toast.success(data.existing ? 'Acquéreur existant ouvert' : 'Acquéreur créé')
      router.push(`/app/acheteurs/${data.buyer.lead_id}`)
    } catch (error) {
      console.error('Erreur création acquéreur:', error)
      toast.error('Erreur serveur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/opportunities?tab=acquereurs">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvel acquéreur</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créer une opportunité acquéreur à partir d’un contact et de critères de recherche.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={cn('rounded-md border p-3 text-left transition-colors hover:bg-muted/50', selected ? 'border-primary bg-accent/50' : 'border-border')}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{name}</span>
                          <Badge variant="outline" className="text-[10px]">{lead.tool}</Badge>
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
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input id="first_name" value={form.first_name} onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom</Label>
                  <Input id="last_name" value={form.last_name} onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projet acquéreur</CardTitle>
            <CardDescription>Cadre les critères de recherche et la prochaine action.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type de bien recherché</Label>
                <Select value={form.type_bien} onValueChange={(value) => setForm((prev) => ({ ...prev, type_bien: value }))}>
                  <SelectTrigger><SelectValue placeholder="Tous types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maison">Maison</SelectItem>
                    <SelectItem value="appartement">Appartement</SelectItem>
                    <SelectItem value="terrain">Terrain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Budget maximum (€)</Label>
                <Input type="number" placeholder="Ex: 300000" value={form.budget_max} onChange={(event) => setForm((prev) => ({ ...prev, budget_max: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Communes recherchées</Label>
              <div className="relative max-w-md">
                <Input placeholder="Rechercher une commune..." value={communeSearch} onChange={(event) => setCommuneSearch(event.target.value)} />
                {communeSearch && filteredCommunes.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                    {filteredCommunes.map((commune) => (
                      <button
                        key={`${commune.postalCode}-${commune.name}`}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => addCommune(commune.name)}
                      >
                        {commune.name} ({commune.postalCode})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.communes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.communes.map((commune) => (
                    <span key={commune} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      {commune}
                      <button type="button" className="hover:text-destructive" onClick={() => removeCommune(commune)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Surface minimale (m²)</Label>
                <Input type="number" placeholder="Ex: 70" value={form.surface_min} onChange={(event) => setForm((prev) => ({ ...prev, surface_min: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nombre de pièces minimum</Label>
                <Input type="number" placeholder="Ex: 3" value={form.pieces_min} onChange={(event) => setForm((prev) => ({ ...prev, pieces_min: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Critères additionnels</Label>
              <div className="flex max-w-md gap-2">
                <Input
                  placeholder="Ex: avec jardin, piscine..."
                  value={critereInput}
                  onChange={(event) => setCritereInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
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
                  {form.criteres.map((critere) => (
                    <span key={critere} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {critere}
                      <button type="button" className="hover:text-destructive" onClick={() => removeCritere(critere)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Étape</Label>
                <Select value={form.stage} onValueChange={(value) => setForm((prev) => ({ ...prev, stage: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BUYER_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Échéance</Label>
                <Input type="date" value={form.due_date} onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={form.active}
                  onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Actif
                </Label>
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Prochaine action</Label>
                <Input value={form.next_action} onChange={(event) => setForm((prev) => ({ ...prev, next_action: event.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/app/opportunities?tab=acquereurs">Annuler</Link>
          </Button>
          <Button type="submit" disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Créer l’acquéreur
          </Button>
        </div>
      </form>
    </div>
  )
}

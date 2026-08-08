'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Search, Home } from 'lucide-react'
import { toast } from 'sonner'

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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
// import { Checkbox } from '@/components/ui/checkbox'
import {
  PageLayout,
  PageHeader,
  PageSection,
  ActionBar,
} from '@/components/pro'
import { cn } from '@/lib/utils'
import { type ProjectKind } from '@/lib/project-stages'
import communesData from '@/data/communes.json'

type CommuneEntry = {
  name: string
  postalCode: string
}

const COMMUNES: CommuneEntry[] = (communesData as CommuneEntry[]).sort((a, b) =>
  a.name.localeCompare(b.name, 'fr'),
)

type Priority = 'low' | 'medium' | 'high' | 'critical'
type ContactMode = 'existing' | 'new'

type ContactOption = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  _prospectId?: string
}

const SELLER_STAGES = [
  'Veille annonce',
  'Nouveau contact',
  'Pré-estimation',
  "Visite d'estimation",
  "Remise de l'estimation",
  'Décision vendeur',
  'Suivi moyen terme',
]

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

function NouveauProjetContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialKind = searchParams.get('kind') === 'achat' ? 'achat' : 'vente'

  const [kind, setKind] = useState<ProjectKind>(initialKind)
  const [mode, setMode] = useState<ContactMode>('existing')

  // Search state
  const [contactSearch, setContactSearch] = useState('')
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [communeSearch, setCommuneSearch] = useState('')
  const [critereInput, setCritereInput] = useState('')

  const defaultStage = kind === 'vente' ? 'Nouveau contact' : 'Nouveau contact'

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    sourceChannel: 'prospection',
    propertyCity: '',
    propertyType: 'none',
    stage: defaultStage,
    priority: 'medium' as Priority,
    nextAction: kind === 'vente' ? 'Qualifier le projet vendeur' : 'Qualifier la recherche',
    dueDate: '',
    communes: [] as string[],
    budgetMax: '',
    criteres: [] as string[],
  })

  // Effect to handle kind switch defaults
  useEffect(() => {
    setForm(f => ({
      ...f,
      stage: kind === 'vente' ? 'Nouveau contact' : 'Nouveau contact',
      nextAction: kind === 'vente' ? 'Qualifier le projet vendeur' : 'Qualifier la recherche',
    }))
    setSelectedContactIds([])
    setContactSearch('')
  }, [kind])

  const loadContacts = useCallback(async (q = '') => {
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch('/api/market/contacts/search?' + params.toString())
      const data = await res.json()
      if (data.contacts) setContactOptions(data.contacts)
    } catch (error) {
      console.error('Erreur chargement contacts', error)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void loadContacts(contactSearch), 250)
    return () => clearTimeout(timer)
  }, [contactSearch, loadContacts])

  const filteredCommunes = communeSearch
    ? COMMUNES.filter(
        (c) =>
          c.name.toLowerCase().includes(communeSearch.toLowerCase()) ||
          c.postalCode.includes(communeSearch),
      ).slice(0, 20)
    : []

  const addCommune = (commune: string) => {
    if (!form.communes.includes(commune)) {
      setForm((prev) => ({ ...prev, communes: [...prev.communes, commune] }))
    }
    setCommuneSearch('')
  }

  const removeCommune = (commune: string) => {
    setForm((prev) => ({ ...prev, communes: prev.communes.filter((c) => c !== commune) }))
  }

  const addCritere = () => {
    const val = critereInput.trim()
    if (val && !form.criteres.includes(val)) {
      setForm((prev) => ({ ...prev, criteres: [...prev.criteres, val] }))
    }
    setCritereInput('')
  }

  const removeCritere = (critere: string) => {
    setForm((prev) => ({ ...prev, criteres: prev.criteres.filter((c) => c !== critere) }))
  }

  const hasNewContact = Boolean(form.firstName.trim() || form.lastName.trim() || form.phone.trim() || form.email.trim())
  const canSave = Boolean((mode === 'existing' && selectedContactIds.length > 0) || (mode === 'new' && hasNewContact))

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds(current => 
      current.includes(id) ? current.filter(c => c !== id) : [...current, id]
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) {
      toast.error('Veuillez sélectionner ou créer au moins un contact')
      return
    }

    setSaving(true)
    try {
      if (kind === 'vente') {
        const res = await fetch('/api/market/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_ids: selectedContactIds.length > 0 ? selectedContactIds : null,
            create_contact: mode === 'new',
            contact: mode === 'new' ? {
              first_name: form.firstName,
              last_name: form.lastName,
              phone: form.phone,
              email: form.email,
            } : undefined,
            seller_name: mode === 'new' ? ([form.firstName, form.lastName].filter(Boolean).join(' ').trim() || null) : null,
            seller_phone: mode === 'new' ? (form.phone.trim() || null) : null,
            seller_email: mode === 'new' ? (form.email.trim() || null) : null,
            stage: form.stage,
            priority: form.priority,
            signal_type: 'manual',
            source_channel: form.sourceChannel,
            property_city: form.propertyCity || null,
            property_type: form.propertyType === 'none' ? null : (form.propertyType || null),
            next_action: form.nextAction.trim() || null,
            due_date: form.dueDate || null,
            created_from: 'manual',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Création impossible')
        if (data.warning) toast.warning(data.warning)
        else toast.success(data.existing ? 'Projet vendeur existant ouvert' : 'Projet vendeur créé')
        router.push(`/admin/market/opportunities/${data.opportunity.id}`)
      } else {
        const firstContactId = selectedContactIds[0] || null
        
        const res = await fetch('/api/market/buyers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_ids: selectedContactIds.length > 0 ? selectedContactIds : null,
            prospect_id: firstContactId,
            first_name: mode === 'new' ? form.firstName : null,
            last_name: mode === 'new' ? form.lastName : null,
            phone: mode === 'new' ? form.phone : null,
            email: mode === 'new' ? form.email : null,
            type_bien: form.propertyType === 'none' ? null : (form.propertyType || null),
            communes: form.communes.length > 0 ? form.communes : null,
            budget_max: form.budgetMax ? Number(form.budgetMax) : null,
            criteres: form.criteres.length > 0 ? form.criteres : null,
            active: true,
            stage: form.stage,
            next_action: form.nextAction || null,
            due_date: form.dueDate || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la création')
        toast.success(data.existing ? 'Acquéreur existant ouvert' : 'Projet acquéreur créé')
        const targetId = data.buyer?.lead_id || data.buyer?.id
        router.push(`/app/acheteurs/${targetId}`)
      }
    } catch (error) {
      console.error('Erreur création projet:', error)
      toast.error(error instanceof Error ? error.message : 'Erreur serveur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageLayout width="wide">
      <PageHeader
        title="Nouveau projet"
        description="Créez un projet de vente ou de recherche acquéreur, et rattachez-le à un ou plusieurs contacts."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/market/opportunities">
              <ArrowLeft className="mr-2 size-4" />
              Retour au pipeline
            </Link>
          </Button>
        }
      />

      <PageSection>
        <form onSubmit={handleSubmit} className="space-y-8 pb-8">
          
          <div className="flex justify-center mb-8">
            <Tabs value={kind} onValueChange={(v) => setKind(v as ProjectKind)} className="w-full md:w-96">
              <TabsList variant="pill" className="w-full flex">
                <TabsTrigger value="vente" className="flex-1 py-2 text-sm">
                  <Home className="mr-2 h-4 w-4" /> Projet de Vente
                </TabsTrigger>
                <TabsTrigger value="achat" className="flex-1 py-2 text-sm">
                  <Search className="mr-2 h-4 w-4" /> Projet d'Achat
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
              <CardDescription>Sélectionnez un ou plusieurs contacts existants ou créez-en un nouveau.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-1 mb-4 w-full md:w-64">
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={cn('rounded-md px-4 py-2 text-sm font-medium transition-colors', mode === 'existing' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  Existant
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('new')
                    setSelectedContactIds([])
                  }}
                  className={cn('rounded-md px-4 py-2 text-sm font-medium transition-colors', mode === 'new' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  Nouveau
                </button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-4">
                  <div className="relative md:w-96">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Rechercher par nom, téléphone, email..." className="pl-8" />
                  </div>
                  
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12 text-center">Sel.</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contactOptions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                              Aucun contact trouvé
                            </TableCell>
                          </TableRow>
                        ) : (
                          contactOptions.map((contact, index) => {
                            const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
                            const isSelected = selectedContactIds.includes(contact.id)
                            return (
                              <TableRow 
                                key={`${contact.id}-${index}`}
                                className="cursor-pointer"
                                onClick={() => toggleContactSelection(contact.id)}
                              >
                                <TableCell className="text-center">
                                  <input 
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    className="pointer-events-none h-4 w-4"
                                    aria-label={`Sélectionner ${name}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{name}</TableCell>
                                <TableCell className="text-muted-foreground">{contact.phone || '—'}</TableCell>
                                <TableCell className="text-muted-foreground">{contact.email || '—'}</TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prénom</Label>
                    <Input value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Affaire</CardTitle>
              <CardDescription>Qualification du projet et actions à venir.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Étape</Label>
                  <Select value={form.stage} onValueChange={(val) => setForm(f => ({ ...f, stage: val }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(kind === 'vente' ? SELLER_STAGES : BUYER_STAGES).map((stage) => (
                        <SelectItem key={stage || 'empty-stage'} value={stage || 'empty-stage'}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type de bien</Label>
                  <Select value={form.propertyType} onValueChange={(val) => setForm(f => ({ ...f, propertyType: val }))}>
                    <SelectTrigger><SelectValue placeholder="Non défini" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non défini</SelectItem>
                      {PROPERTY_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value || 'empty-prop'} value={opt.value || 'empty-prop'}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {kind === 'vente' && (
                  <>
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select value={form.sourceChannel} onValueChange={(val) => setForm(f => ({ ...f, sourceChannel: val }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((opt) => <SelectItem key={opt.value || 'empty-src'} value={opt.value || 'empty-src'}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Commune du bien</Label>
                      <Input value={form.propertyCity} onChange={(e) => setForm(f => ({ ...f, propertyCity: e.target.value }))} placeholder="Ex: Paris 15" />
                    </div>
                    <div className="space-y-2">
                      <Label>Priorité</Label>
                      <Select value={form.priority} onValueChange={(val) => setForm(f => ({ ...f, priority: val as Priority }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Basse</SelectItem>
                          <SelectItem value="medium">Moyenne</SelectItem>
                          <SelectItem value="high">Haute</SelectItem>
                          <SelectItem value="critical">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {kind === 'achat' && (
                  <>
                    <div className="space-y-2">
                      <Label>Budget max (€)</Label>
                      <Input 
                        type="number" 
                        placeholder="Ex: 450000" 
                        value={form.budgetMax} 
                        onChange={(e) => setForm(f => ({ ...f, budgetMax: e.target.value }))} 
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Communes recherchées</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.communes.map((commune) => (
                          <Badge key={commune} variant="secondary" className="text-xs">
                            {commune}
                            <button
                              type="button"
                              onClick={() => removeCommune(commune)}
                              className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={communeSearch}
                          onChange={(e) => setCommuneSearch(e.target.value)}
                          placeholder="Ajouter une commune..."
                          className="pl-8"
                        />
                        {filteredCommunes.length > 0 && (
                          <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-sm">
                            {filteredCommunes.map((c) => (
                              <button
                                key={`${c.name}-${c.postalCode}`}
                                type="button"
                                className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-muted"
                                onClick={() => addCommune(c.name)}
                              >
                                <span>{c.name}</span>
                                <span className="text-muted-foreground">{c.postalCode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Critères optionnels</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.criteres.map((crit) => (
                          <Badge key={crit} variant="secondary" className="text-xs">
                            {crit}
                            <button
                              type="button"
                              onClick={() => removeCritere(crit)}
                              className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={critereInput}
                          onChange={(e) => setCritereInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addCritere()
                            }
                          }}
                          placeholder="Ex: Rez-de-jardin, Calme..."
                        />
                        <Button type="button" variant="secondary" onClick={addCritere}>
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label>Prochaine action</Label>
                  <Input value={form.nextAction} onChange={(e) => setForm(f => ({ ...f, nextAction: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Échéance de l'action</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <ActionBar>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/market/opportunities">Annuler</Link>
            </Button>
            <Button type="submit" disabled={!canSave || saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {kind === 'vente' ? 'Créer le projet' : "Créer le projet"}
            </Button>
          </ActionBar>
        </form>
      </PageSection>
    </PageLayout>
  )
}

export default function NouveauProjetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement du formulaire...</div>}>
      <NouveauProjetContent />
    </Suspense>
  )
}

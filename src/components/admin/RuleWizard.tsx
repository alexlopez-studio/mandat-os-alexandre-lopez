'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Home,
  TrendingDown,
  AlertTriangle,
  Clock,
  Zap,
  Tag,
  Bell,
  Star,
  Plus,
  X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const TRIGGER_TYPES = [
  { id: 'new_listing', label: 'Nouveau bien', icon: Home, desc: 'Quand un nouveau bien apparaît sur le marché', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'price_drop', label: 'Baisse de prix', icon: TrendingDown, desc: 'Quand le prix d\'un baisse (2-5%)', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'big_price_drop', label: 'Grosse baisse (>5%)', icon: AlertTriangle, desc: 'Baisse significative de plus de 5%', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'expired', label: 'Expiration', icon: Clock, desc: 'Quand une annonce arrive à expiration', color: 'bg-gray-50 text-gray-700 border-gray-200' },
  { id: 'days_online_exceeded', label: 'Stagnation', icon: Clock, desc: 'Bien en ligne depuis X jours sans baisse', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'price_per_m2_below', label: 'Sous-évalué', icon: Zap, desc: 'Prix/m² inférieur à la moyenne de zone', color: 'bg-green-50 text-green-700 border-green-200' },
]

const FIELDS = [
  { id: 'price', label: 'Prix', type: 'number' },
  { id: 'surface', label: 'Surface (m²)', type: 'number' },
  { id: 'price_per_m2', label: 'Prix / m²', type: 'number' },
  { id: 'land_surface', label: 'Surface terrain', type: 'number' },
  { id: 'rooms', label: 'Pièces', type: 'number' },
  { id: 'bedrooms', label: 'Chambres', type: 'number' },
  { id: 'days_online', label: 'Jours en ligne', type: 'number' },
  { id: 'city', label: 'Ville', type: 'string' },
  { id: 'property_type', label: 'Type de bien', type: 'string' },
  { id: 'dpe', label: 'DPE', type: 'string' },
  { id: 'status', label: 'Statut', type: 'string' },
]

const OPERATORS = [
  { id: 'equals', label: '=' },
  { id: 'not_equals', label: '≠' },
  { id: 'gt', label: '>' },
  { id: 'gte', label: '≥' },
  { id: 'lt', label: '<' },
  { id: 'lte', label: '≤' },
  { id: 'contains', label: 'Contient' },
  { id: 'between', label: 'Entre' },
]

const ACTION_TYPES = [
  { id: 'add_tag', label: 'Ajouter un tag', icon: Tag, desc: 'Marque le bien avec un tag personnalisé' },
  { id: 'create_notification', label: 'Créer une notification', icon: Bell, desc: 'Crée une alerte dans le centre de notifications' },
  { id: 'create_opportunity', label: 'Créer une opportunité', icon: Star, desc: 'Crée une fiche opportunité dans le pipeline' },
]

interface Condition {
  field: string
  operator: string
  value: string
}

interface Action {
  type: string
  value?: string
  stage?: string
  priority?: string
}

export function RuleWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Trigger
  const [triggerType, setTriggerType] = useState('')

  // Step 2: Conditions
  const [conditions, setConditions] = useState<Condition[]>([])
  const [allMustMatch, setAllMustMatch] = useState(true)

  // Step 3: Actions
  const [actions, setActions] = useState<Action[]>([])

  // Step 4: Details
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [active, setActive] = useState(true)

  const maxSteps = 4

  const addCondition = () => {
    setConditions([...conditions, { field: 'price', operator: 'lt', value: '' }])
  }

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c))
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const addAction = (type: string) => {
    setActions([...actions, { type, value: '', stage: 'Nouveau contact', priority: 'medium' }])
  }

  const updateAction = (index: number, updates: Partial<Action>) => {
    setActions(actions.map((a, i) => i === index ? { ...a, ...updates } : a))
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const canProceed = () => {
    switch (step) {
      case 1: return triggerType !== ''
      case 2: return conditions.length > 0 && conditions.every(c => c.value !== '')
      case 3: return actions.length > 0
      case 4: return name.trim().length >= 3
      default: return false
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || `Règle : ${TRIGGER_TYPES.find(t => t.id === triggerType)?.label}`,
          active,
          trigger_type: triggerType,
          conditions_json: { all: conditions.map(c => ({
            field: c.field,
            operator: c.operator,
            value: c.operator === 'between' ? c.value.split(',').map(v => Number(v.trim())) : (isNaN(Number(c.value)) ? c.value : Number(c.value)),
          }))},
          actions_json: { actions: actions.map(a => ({
            type: a.type,
            ...(a.type === 'add_tag' ? { value: a.value || 'Signal' } : {}),
            ...(a.type === 'create_notification' ? { value: a.value || 'Bien détecté', priority: a.priority } : {}),
            ...(a.type === 'create_opportunity' ? { stage: a.stage || 'Nouveau contact', priority: a.priority } : {}),
          }))},
          priority,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de la création')
        return
      }

      toast.success('Règle créée avec succès')
      router.push('/app/rules')
      router.refresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle règle</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Étape {step} sur {maxSteps}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {Array.from({ length: maxSteps }, (_, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
              step > i + 1 ? 'bg-primary text-primary-foreground' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className={cn(
              'h-0.5 flex-1 transition-colors',
              step > i + 1 ? 'bg-primary' : 'bg-muted'
            )} />
          </div>
        ))}
      </div>

      {/* Step labels */}
      <div className="flex justify-between text-xs text-muted-foreground -mt-3 mb-2">
        <span>Déclencheur</span>
        <span>Conditions</span>
        <span>Actions</span>
        <span>Activation</span>
      </div>

      {/* Step 1: Trigger */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quand cette règle doit-elle se déclencher ?
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {TRIGGER_TYPES.map((t) => {
              const Icon = t.icon
              const isSelected = triggerType === t.id
              return (
                <Card
                  key={t.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    isSelected && 'ring-2 ring-primary ring-offset-2'
                  )}
                  onClick={() => setTriggerType(t.id)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={cn('rounded-lg p-2', t.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="ml-auto">
                        <Check className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 2: Conditions */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Définissez les conditions qui doivent être remplies. Toutes les conditions doivent correspondre.
          </p>

          {conditions.map((condition, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <select
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {FIELDS.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.id} value={op.id}>{op.label}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Valeur"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeCondition(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" size="sm" onClick={addCondition}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter une condition
          </Button>
        </div>
      )}

      {/* Step 3: Actions */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Que doit faire cette règle quand les conditions sont remplies ?
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            {ACTION_TYPES.map((at) => {
              const Icon = at.icon
              const count = actions.filter(a => a.type === at.id).length
              return (
                <Card
                  key={at.id}
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() => addAction(at.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="rounded-full bg-muted w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">{at.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{at.desc}</p>
                    {count > 0 && (
                      <Badge variant="secondary" className="mt-2">
                        {count} action{count > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {actions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Actions configurées :</p>
              {actions.map((action, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <Badge variant="outline" className="text-xs">
                          {ACTION_TYPES.find(a => a.id === action.type)?.label}
                        </Badge>
                        {action.type === 'add_tag' && (
                          <Input
                            placeholder="Nom du tag (ex: À surveiller)"
                            value={action.value || ''}
                            onChange={(e) => updateAction(index, { value: e.target.value })}
                            className="h-9"
                          />
                        )}
                        {action.type === 'create_notification' && (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Message (ex: Baisse détectée)"
                              value={action.value || ''}
                              onChange={(e) => updateAction(index, { value: e.target.value })}
                              className="h-9 flex-1"
                            />
                            <select
                              value={action.priority || 'medium'}
                              onChange={(e) => updateAction(index, { priority: e.target.value })}
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="low">Basse</option>
                              <option value="medium">Moyenne</option>
                              <option value="high">Haute</option>
                              <option value="critical">Urgente</option>
                            </select>
                          </div>
                        )}
                        {action.type === 'create_opportunity' && (
                          <div className="flex gap-2">
                            <select
                              value={action.stage || 'Nouveau contact'}
                              onChange={(e) => updateAction(index, { stage: e.target.value })}
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1"
                            >
                              <option value="Nouveau contact">Nouveau contact</option>
                              <option value="Pré-estimation">Pré-estimation</option>
                              <option value="RDV / Visite">RDV / Visite</option>
                              <option value="Décision vendeur">Décision vendeur</option>
                            </select>
                            <select
                              value={action.priority || 'medium'}
                              onChange={(e) => updateAction(index, { priority: e.target.value })}
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="low">Basse</option>
                              <option value="medium">Moyenne</option>
                              <option value="high">Haute</option>
                              <option value="critical">Urgente</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeAction(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Activation */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
              <CardDescription>Nommez et configurez votre règle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nom de la règle</label>
                <Input
                  placeholder="Ex: Alerte grosse baisse"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optionnelle)</label>
                <Input
                  placeholder="Ex: Détecte les baisses de plus de 5%"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Priorité</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Statut</label>
                  <div className="flex items-center gap-2 h-10">
                    <Button
                      variant={active ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setActive(true)}
                    >
                      Actif
                    </Button>
                    <Button
                      variant={!active ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setActive(false)}
                    >
                      Inactif
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Résumé */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Résumé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Déclencheur :</strong> {TRIGGER_TYPES.find(t => t.id === triggerType)?.label}</p>
              <p><strong>Conditions :</strong> {conditions.length > 0 ? (
                conditions.map((c, i) => (
                  <span key={i} className="block ml-4 text-muted-foreground">
                    {FIELDS.find(f => f.id === c.field)?.label} {OPERATORS.find(o => o.id === c.operator)?.label} {c.value}
                  </span>
                ))
              ) : 'Aucune condition'}</p>
              <p><strong>Actions :</strong> {actions.map((a, i) => (
                <span key={i} className="block ml-4 text-muted-foreground">
                  {ACTION_TYPES.find(at => at.id === a.type)?.label}
                </span>
              ))}</p>
              <p><strong>Statut :</strong> {active ? 'Actif' : 'Inactif'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="ghost"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/app/rules')}
          >
            Annuler
          </Button>

          {step < maxSteps ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || loading}>
              {loading ? 'Création...' : 'Créer la règle'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

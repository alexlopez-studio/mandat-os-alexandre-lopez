'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus,
  ScrollText,
  Play,
  Pencil,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  TrendingDown,
  Home,
  Clock,
  Zap,
  ArrowUpRight,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Rule {
  id: string
  name: string
  description: string
  active: boolean
  trigger_type: string
  priority: string
  last_run_at: string | null
  runCount: number
  created_at: string
}

const TRIGGER_LABELS: Record<string, { label: string; icon: any; class: string }> = {
  new_listing: { label: 'Nouveau bien', icon: Home, class: 'bg-blue-50 text-blue-700 border-blue-200' },
  price_drop: { label: 'Baisse de prix', icon: TrendingDown, class: 'bg-red-50 text-red-700 border-red-200' },
  big_price_drop: { label: 'Grosse baisse', icon: AlertTriangle, class: 'bg-red-100 text-red-800 border-red-300' },
  expired: { label: 'Expiration', icon: Clock, class: 'bg-gray-50 text-gray-700 border-gray-200' },
  days_online_exceeded: { label: 'Stagnation', icon: Clock, class: 'bg-amber-50 text-amber-700 border-amber-200' },
  price_per_m2_below: { label: 'Sous-évalué', icon: Zap, class: 'bg-green-50 text-green-700 border-green-200' },
}

const MOCK_RULES: Rule[] = [
  {
    id: 'rule-1',
    name: 'Baisse significative > 5%',
    description: 'Détecte les biens dont le prix a baissé de plus de 5% et crée une opportunité haute priorité.',
    active: true,
    trigger_type: 'big_price_drop',
    priority: 'high',
    last_run_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    runCount: 128,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'rule-2',
    name: 'Nouveaux biens à surveiller',
    description: 'Notifie dès qu\'un nouveau bien correspondant aux critères de mandat apparaît sur le marché.',
    active: true,
    trigger_type: 'new_listing',
    priority: 'medium',
    last_run_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    runCount: 342,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'rule-3',
    name: 'Biens sous-évalués',
    description: 'Identifie les biens dont le prix/m² est inférieur de 15% à la moyenne de la zone.',
    active: true,
    trigger_type: 'price_per_m2_below',
    priority: 'high',
    last_run_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    runCount: 67,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
  {
    id: 'rule-4',
    name: 'Biens stagnants > 90 jours',
    description: 'Surveille les biens en ligne depuis plus de 90 jours sans baisse de prix.',
    active: false,
    trigger_type: 'days_online_exceeded',
    priority: 'medium',
    last_run_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    runCount: 45,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'rule-5',
    name: 'Baisse modérée 2-5%',
    description: 'Détecte les baisses de prix modérées pour suivi commercial.',
    active: false,
    trigger_type: 'price_drop',
    priority: 'low',
    last_run_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    runCount: 89,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: 'rule-6',
    name: 'Annonces expirées',
    description: 'Repère les annonces qui expirent et pourraient être reprises en mandat.',
    active: true,
    trigger_type: 'expired',
    priority: 'medium',
    last_run_at: new Date(Date.now() - 86400000 * 0.5).toISOString(),
    runCount: 23,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
]

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Jamais'
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return 'À l\'instant'
  if (hours < 24) return `Il y a ${hours}h`
  return `Il y a ${days}j`
}

export function RulesList() {
  const [rules, setRules] = useState(MOCK_RULES)
  const [executingId, setExecutingId] = useState<string | null>(null)

  const toggleRule = (ruleId: string) => {
    setRules(rules.map(r => r.id === ruleId ? { ...r, active: !r.active } : r))
  }

  const executeRule = async (ruleId: string) => {
    setExecutingId(ruleId)
    try {
      const res = await fetch(`/api/market/rules/${ruleId}/execute`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data.matched} bien(s) concerné(s), ${data.actions_executed} action(s) exécutée(s)`)
        setRules(rules.map(r => r.id === ruleId ? { ...r, last_run_at: new Date().toISOString(), runCount: r.runCount + 1 } : r))
      } else {
        toast.error(data.error || 'Erreur exécution')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setExecutingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Règles de gestion</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rules.filter(r => r.active).length} règles actives sur {rules.length}
          </p>
        </div>
        <Link href="/app/rules/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle règle
          </Button>
        </Link>
      </div>

      {/* Rules grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => {
          const trigger = TRIGGER_LABELS[rule.trigger_type]
          const TriggerIcon = trigger?.icon || Zap
          return (
            <Card key={rule.id} className={cn(!rule.active && 'opacity-60')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'rounded-lg p-2',
                      trigger?.class || 'bg-gray-50 text-gray-700'
                    )}>
                      <TriggerIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {trigger?.label || rule.trigger_type}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={rule.priority === 'high' ? 'destructive' : rule.priority === 'medium' ? 'secondary' : 'outline'}
                    className="text-[10px]"
                  >
                    {rule.priority === 'high' ? 'Haute' : rule.priority === 'medium' ? 'Moyenne' : 'Basse'} priorité
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {rule.description}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>Exécutée {rule.runCount} fois</span>
                  <span>Dernière : {formatDate(rule.last_run_at)}</span>
                </div>

                <Separator className="mb-3" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => toggleRule(rule.id)}
                    >
                      {rule.active ? (
                        <ToggleRight className="h-4 w-4 mr-1 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 mr-1 text-muted-foreground" />
                      )}
                      {rule.active ? 'Actif' : 'Inactif'}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Exécuter"
                      onClick={() => executeRule(rule.id)}
                      disabled={executingId === rule.id}
                    >
                      {executingId === rule.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Dupliquer">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
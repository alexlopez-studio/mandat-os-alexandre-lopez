'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  Home,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  StickyNote,
  UserRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ActivityType } from '@/types/supabase'

interface Activity {
  id: string
  contact_id: string | null
  opportunity_id: string | null
  lead_id: string | null
  type: ActivityType
  title: string | null
  content: string | null
  due_at: string | null
  occurred_at: string
  completed_at: string | null
  metadata: Record<string, unknown>
  created_by: string | null
}

interface Opportunity {
  id: string
  title: string | null
  stage: string | null
  property_city: string | null
  property_type: string | null
  estimated_price_min: number | null
  estimated_price_max: number | null
  created_at: string
}

interface BuyerCriteria {
  id: string
  lead_id: string
  type_bien: string | null
  communes: string[] | null
  budget_max: number | null
  stage: string | null
  active: boolean
  created_at: string
}

interface ContactData {
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    source: string | null
    created_at: string
  }
  opportunities: Opportunity[]
  buyerCriteria: BuyerCriteria[]
  activities: Activity[]
}

const EVENT_CONFIG: Record<ActivityType, { label: string; icon: typeof StickyNote; className: string }> = {
  note: { label: 'Note', icon: StickyNote, className: 'bg-slate-50 text-slate-700 border-slate-200' },
  task: { label: 'Tâche', icon: CheckCircle2, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  call: { label: 'Appel', icon: Phone, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  meeting: { label: 'Rendez-vous', icon: Calendar, className: 'bg-purple-50 text-purple-700 border-purple-200' },
  email: { label: 'Email', icon: Mail, className: 'bg-sky-50 text-sky-700 border-sky-200' },
  stage_change: { label: 'Étape', icon: ArrowLeft, className: 'bg-orange-50 text-orange-700 border-orange-200' },
  estimation: { label: 'Estimation', icon: Home, className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  system: { label: 'Système', icon: Clock, className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default function ContactPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<ContactData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/market/contacts/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch contact')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || !data.contact) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <p className="text-muted-foreground">Contact introuvable.</p>
        <Button variant="outline" onClick={() => router.back()}>Retour</Button>
      </div>
    )
  }

  const { contact, opportunities, buyerCriteria, activities } = data
  const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
  const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'C'

  return (
    <div className="space-y-5">
      <div className="mx-auto max-w-6xl space-y-8 pb-12">
        {/* En-tête */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center hover:text-foreground">
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    {contact.phone}
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center hover:text-foreground">
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {contact.email}
                  </a>
                )}
                {contact.source && (
                  <span className="flex items-center">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    {contact.source}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Colonne Principale: Projets */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Vendeurs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Home className="h-5 w-5 text-primary" />
                  Projets Vendeur
                </h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/opportunities">Voir tout</Link>
                </Button>
              </div>
              {opportunities.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Home className="h-8 w-8 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">Aucun projet vendeur rattaché.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {opportunities.map((opp) => (
                    <Card key={opp.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="mb-2">{opp.stage || 'Nouveau'}</Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mt-2 -mr-2" asChild>
                            <Link href={`/app/opportunities/${opp.id}`}><ArrowLeft className="h-3 w-3 rotate-[135deg]" /></Link>
                          </Button>
                        </div>
                        <CardTitle className="text-base leading-tight">
                          {opp.title || 'Opportunité vendeur'}
                        </CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="mr-1 h-3 w-3" /> {opp.property_city || 'Ville inconnue'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="text-muted-foreground">
                          {opp.property_type || 'Bien'} • {(opp.estimated_price_max && opp.estimated_price_min) ? `${(opp.estimated_price_min/1000).toFixed()}k - ${(opp.estimated_price_max/1000).toFixed()}k €` : 'Prix à estimer'}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Acquéreurs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Recherches Acquéreur
                </h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/acheteurs">Voir tout</Link>
                </Button>
              </div>
              {buyerCriteria.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">Aucune recherche rattachée.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {buyerCriteria.map((bc) => (
                    <Card key={bc.id} className={cn("transition-colors hover:border-primary/50", !bc.active && "opacity-60")}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <Badge variant={bc.active ? 'default' : 'secondary'} className="mb-2">
                            {bc.active ? (bc.stage || 'Actif') : 'Inactif'}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mt-2 -mr-2" asChild>
                            <Link href={`/app/acheteurs/${bc.lead_id}`}><ArrowLeft className="h-3 w-3 rotate-[135deg]" /></Link>
                          </Button>
                        </div>
                        <CardTitle className="text-base leading-tight">
                          Recherche {bc.type_bien?.toLowerCase() || 'bien'}
                        </CardTitle>
                        <CardDescription className="flex items-center mt-1 truncate">
                          <MapPin className="mr-1 h-3 w-3" /> {bc.communes?.join(', ') || 'Secteur indéfini'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="text-muted-foreground font-medium">
                          Budget: {bc.budget_max ? `${(bc.budget_max/1000).toFixed()} k€` : 'Non défini'}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Colonne Latérale: Historique Global */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Historique Global
              </h2>
            </div>
            
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="relative border-l border-muted-foreground/20 pl-6 space-y-6">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4">Aucune activité enregistrée.</p>
                ) : (
                  activities.map((event) => {
                    const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.system
                    const Icon = config.icon
                    const isTask = event.type === 'task'
                    const isDone = isTask && !!event.completed_at
                    const isOverdue = isTask && !isDone && event.due_at && new Date(event.due_at) < new Date()

                    return (
                      <div key={event.id} className="relative">
                        <div className={cn(
                          "absolute -left-9 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm",
                          config.className,
                          isDone && "bg-slate-100 text-slate-400 border-slate-200"
                        )}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-medium", isDone && "text-muted-foreground line-through")}>
                              {event.title || config.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.occurred_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {event.content && (
                            <p className={cn("text-sm whitespace-pre-wrap mt-0.5", isDone ? "text-muted-foreground/70" : "text-foreground/80")}>
                              {event.content}
                            </p>
                          )}
                          {/* Tags pour indiquer la provenance */}
                          <div className="flex gap-2 mt-1">
                            {event.opportunity_id && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">Projet Vendeur</Badge>
                            )}
                            {event.lead_id && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">Recherche Acquéreur</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

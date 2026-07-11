'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRightIcon,
  CalendarClockIcon,
  CheckIcon,
  ContactRoundIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ActionBucket = 'overdue' | 'today' | 'week' | 'later' | 'no_due'

type DashboardAction = {
  id: string
  source: 'opportunity' | 'buyer' | 'opportunity_event' | 'client_event' | 'lead' | 'warm_contact'
  source_label: string
  title: string
  object_label: string
  due_date: string | null
  bucket: ActionBucket
  priority: string
  href: string
  can_complete: boolean
  can_postpone: boolean
}

type DashboardPayload = {
  generated_at: string
  kpis: {
    actions_due: number
    opportunities_active: number
    signed_mandates: number
    network_to_relaunch: number
    hot_properties: number
  }
  actions: DashboardAction[]
  pipeline: {
    sellers: { name: string; value: number }[]
    buyers: { name: string; value: number }[]
  }
  activity_30d: { date: string; label: string; opportunities: number; actions: number }[]
  quality: {
    overdue_rate: number
    actions_without_due_date: number
    opportunities_without_next_action: number
    network_to_relaunch: number
  }
}

const BUCKET_LABELS: Record<ActionBucket, string> = {
  overdue: 'En retard',
  today: "Aujourd'hui",
  week: 'Cette semaine',
  later: 'Plus tard',
  no_due: 'Sans échéance',
}

const BUCKET_STYLES: Record<ActionBucket, string> = {
  overdue: 'border-destructive bg-destructive text-destructive-foreground',
  today: 'border-primary/25 bg-accent text-primary',
  week: 'border-border bg-white text-foreground',
  later: 'border-border bg-muted text-muted-foreground',
  no_due: 'border-dashed border-border bg-white text-muted-foreground',
}

const CHART_COLORS = {
  border: 'var(--border)',
  muted: 'var(--muted-foreground)',
  primary: 'var(--chart-1)',
  success: 'var(--chart-2)',
  surface: 'var(--background)',
}

export function DashboardCockpit() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/market/dashboard', { cache: 'no-store' })
      if (!response.ok) throw new Error('Dashboard unavailable')
      setPayload(await response.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!payload) return []
    if (!normalizedQuery) return payload.actions
    return payload.actions.filter((action) => {
      return [action.title, action.object_label, action.source_label, action.priority]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [payload, query])

  const pipelineData = useMemo(() => {
    if (!payload) return []
    const names = new Set([...payload.pipeline.sellers.map((item) => item.name), ...payload.pipeline.buyers.map((item) => item.name)])
    return Array.from(names).map((name) => ({
      name,
      vendeurs: payload.pipeline.sellers.find((item) => item.name === name)?.value ?? 0,
      acquereurs: payload.pipeline.buyers.find((item) => item.name === name)?.value ?? 0,
    }))
  }, [payload])

  const handleAction = async (action: DashboardAction, operation: 'complete' | 'postpone') => {
    const actionKey = `${action.source}:${action.id}:${operation}`
    setBusyAction(actionKey)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)

    try {
      const response = await fetch('/api/market/dashboard/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: action.id,
          source: action.source,
          operation,
          due_date: operation === 'postpone' ? dueDate.toISOString() : undefined,
        }),
      })
      if (!response.ok) throw new Error('Action update failed')
      await loadDashboard()
    } finally {
      setBusyAction(null)
    }
  }

  const kpis = [
    { label: 'Actions dues', value: payload?.kpis.actions_due ?? 0, detail: 'retard + aujourd’hui' },
    { label: 'Opportunités actives', value: payload?.kpis.opportunities_active ?? 0, detail: 'vendeurs + acquéreurs' },
    { label: 'Mandats signés', value: payload?.kpis.signed_mandates ?? 0, detail: 'vente + recherche' },
    { label: 'Réseau à relancer', value: payload?.kpis.network_to_relaunch ?? 0, detail: 'échéance atteinte' },
    { label: 'Biens chauds', value: payload?.kpis.hot_properties ?? 0, detail: 'hot + golden' },
  ]

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-3 px-4 py-4 md:px-6">
        <header className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-normal text-primary">Mandat OS</p>
            <h1 className="text-2xl font-extrabold tracking-normal text-foreground">Dashboard</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une action..."
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
              {loading ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
              Actualiser
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/opportunities">
                <PlusIcon />
                Nouvelle opportunité
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link href="/app/leads">
                <ContactRoundIcon />
                Ajouter un contact
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="py-3 shadow-sm" size="sm">
              <CardHeader className="px-3">
                <CardTitle className="text-xs font-bold text-muted-foreground">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-3">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-3xl font-extrabold leading-none">{formatNumber(kpi.value)}</span>
                  <span className="max-w-28 text-right text-[11px] leading-tight text-muted-foreground">{kpi.detail}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader className="flex-row items-start justify-between border-b border-border">
              <div>
                <CardTitle>Activité 30 jours</CardTitle>
                <p className="text-xs text-muted-foreground">Opportunités créées et actions planifiées</p>
              </div>
            </CardHeader>
            <CardContent className="h-64 pt-3">
              {payload ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={payload.activity_30d} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART_COLORS.muted }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART_COLORS.muted }} />
                    <Tooltip cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="opportunities" name="Opportunités" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="actions" name="Actions" stroke={CHART_COLORS.success} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartSkeleton />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>Répartition pipeline</CardTitle>
              <p className="text-xs text-muted-foreground">Vendeurs et acquéreurs par statut</p>
            </CardHeader>
            <CardContent className="h-64 pt-3">
              {payload ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData.slice(0, 10)} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: CHART_COLORS.muted }} interval={0} height={52} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART_COLORS.muted }} />
                    <Tooltip cursor={{ fill: CHART_COLORS.surface }} />
                    <Bar dataKey="vendeurs" name="Vendeurs" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="acquereurs" name="Acquéreurs" fill={CHART_COLORS.success} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartSkeleton />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between border-b border-border">
              <div>
                <CardTitle>Actions prioritaires</CardTitle>
                <p className="text-xs text-muted-foreground">{filteredActions.length} action(s) dans le poste de pilotage</p>
              </div>
              <CalendarClockIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-0">
              {loading && !payload ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Chargement
                </div>
              ) : filteredActions.length === 0 ? (
                <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  Aucune action prioritaire à afficher.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredActions.map((action) => (
                    <ActionRow
                      key={`${action.source}:${action.id}`}
                      action={action}
                      busyAction={busyAction}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <aside className="flex flex-col gap-3">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle>Qualité du suivi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <QualityLine label="Actions en retard" value={`${payload?.quality.overdue_rate ?? 0}%`} progress={payload?.quality.overdue_rate ?? 0} />
                <QualityLine label="Actions sans échéance" value={formatNumber(payload?.quality.actions_without_due_date ?? 0)} progress={Math.min((payload?.quality.actions_without_due_date ?? 0) * 8, 100)} />
                <QualityLine label="Sans prochaine action" value={formatNumber(payload?.quality.opportunities_without_next_action ?? 0)} progress={Math.min((payload?.quality.opportunities_without_next_action ?? 0) * 8, 100)} />
                <QualityLine label="Réseau à relancer" value={formatNumber(payload?.quality.network_to_relaunch ?? 0)} progress={Math.min((payload?.quality.network_to_relaunch ?? 0) * 12, 100)} />
              </CardContent>
            </Card>

            <div className="rounded-lg border border-primary/20 bg-foreground py-4 text-white">
              <div className="border-b border-white/10 px-4 pb-4">
                <h2 className="font-heading text-base font-medium leading-snug text-white">Focus semaine</h2>
              </div>
              <div className="space-y-3 px-4 pt-4 text-sm text-white/80">
                <FocusLine label="En retard" value={filteredActions.filter((action) => action.bucket === 'overdue').length} />
                <FocusLine label="Aujourd’hui" value={filteredActions.filter((action) => action.bucket === 'today').length} />
                <FocusLine label="Cette semaine" value={filteredActions.filter((action) => action.bucket === 'week').length} />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}

function ActionRow({
  action,
  busyAction,
  onAction,
}: {
  action: DashboardAction
  busyAction: string | null
  onAction: (action: DashboardAction, operation: 'complete' | 'postpone') => void
}) {
  const completeKey = `${action.source}:${action.id}:complete`
  const postponeKey = `${action.source}:${action.id}:postpone`

  return (
    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[150px_minmax(0,1fr)_180px] lg:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('rounded-md', BUCKET_STYLES[action.bucket])}>
          {BUCKET_LABELS[action.bucket]}
        </Badge>
        <span className="text-xs text-muted-foreground">{action.source_label}</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{action.title}</p>
          <span className="text-xs text-muted-foreground">{action.priority}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {action.object_label} · {formatDueDate(action.due_date, action.bucket)}
        </p>
      </div>
      <div className="flex items-center gap-2 lg:justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link href={action.href}>
            <ArrowUpRightIcon />
            Ouvrir
          </Link>
        </Button>
        {action.can_complete ? (
          <Button variant="ghost" size="sm" onClick={() => onAction(action, 'complete')} disabled={busyAction === completeKey}>
            {busyAction === completeKey ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Fait
          </Button>
        ) : null}
        {action.can_postpone ? (
          <Button variant="ghost" size="sm" onClick={() => onAction(action, 'postpone')} disabled={busyAction === postponeKey}>
            {busyAction === postponeKey ? <Loader2Icon className="animate-spin" /> : <CalendarClockIcon />}
            +7j
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function QualityLine({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(progress, 100))}%` }} />
      </div>
    </div>
  )
}

function FocusLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0 last:pb-0">
      <span>{label}</span>
      <span className="text-lg font-semibold text-white">{formatNumber(value)}</span>
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-md bg-muted" />
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function formatDueDate(value: string | null, bucket: ActionBucket) {
  if (!value) return BUCKET_LABELS[bucket]
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return BUCKET_LABELS[bucket]
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

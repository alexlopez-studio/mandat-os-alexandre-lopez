'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Eye,
  Heart,
  Loader2,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface AudienceSnapshot {
  id: string
  portal: string
  captured_on: string
  views: number
  contacts: number
  favorites: number
  visits: number
  notes: string | null
}

interface AudienceSummary {
  totals: { views: number; contacts: number; favorites: number; visits: number }
  changes: { views: number | null; contacts: number | null }
  portals: AudienceSnapshot[]
  timeline: Array<{ date: string; views: number; contacts: number; favorites: number; visits: number }>
}

const PORTALS = ['iad', 'SeLoger', 'Leboncoin', 'Bien’ici', 'Logic-Immo', 'Figaro Immobilier', 'Facebook', 'Instagram', 'Autre']

function localToday() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

const ADMIN_INPUT_CLASS = 'h-10 rounded-xl px-3 text-sm'

export function AudienceTrackingPanel({ opportunityId }: { opportunityId: string }) {
  const [snapshots, setSnapshots] = useState<AudienceSnapshot[]>([])
  const [summary, setSummary] = useState<AudienceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [portal, setPortal] = useState('iad')
  const [customPortal, setCustomPortal] = useState('')
  const [capturedOn, setCapturedOn] = useState(localToday)
  const [views, setViews] = useState('0')
  const [contacts, setContacts] = useState('0')
  const [favorites, setFavorites] = useState('0')
  const [visits, setVisits] = useState('0')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/market/opportunities/${opportunityId}/audience`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Erreur API')
      setSnapshots(data.snapshots ?? [])
      setSummary(data.summary)
    } catch (error) {
      console.error('[AudienceTrackingPanel]', error)
      toast.error('Impossible de charger les statistiques')
    } finally {
      setLoading(false)
    }
  }, [opportunityId])

  useEffect(() => { void load() }, [load])

  const recentSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => b.captured_on.localeCompare(a.captured_on)).slice(0, 8),
    [snapshots],
  )

  async function save() {
    const portalName = portal === 'Autre' ? customPortal.trim() : portal
    if (!portalName) {
      toast.error('Indiquez le nom du portail')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/market/opportunities/${opportunityId}/audience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal: portalName,
          captured_on: capturedOn,
          views: Number(views),
          contacts: Number(contacts),
          favorites: Number(favorites),
          visits: Number(visits),
          notes,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Erreur API')
      setSnapshots(data.snapshots ?? [])
      setSummary(data.summary)
      setShowForm(false)
      setNotes('')
      toast.success('Relevé enregistré et statistiques mises à jour')
    } catch (error) {
      console.error('[AudienceTrackingPanel save]', error)
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le relevé')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Diffusion & statistiques d’audience</h2>
            <p className="text-xs text-muted-foreground">Suivez la performance et l’évolution de la visibilité sur les portails immobiliers.</p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          className="h-10 font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs px-4 text-xs shrink-0"
        >
          {showForm ? <X className="mr-1.5 size-4" /> : <Plus className="mr-1.5 size-4" />}
          {showForm ? 'Fermer' : 'Nouveau relevé'}
        </Button>
      </div>

      {/* Collapsible Form Card */}
      {showForm && (
        <div className="rounded-2xl border border-primary/30 bg-muted/40 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Ajouter un relevé de portail</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Portail immobilier
              </label>
              <Select value={portal} onValueChange={setPortal}>
                <SelectTrigger className="h-10 rounded-xl bg-card text-xs font-semibold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PORTALS.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {portal === 'Autre' && (
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Nom du portail
                </label>
                <Input
                  value={customPortal}
                  onChange={(event) => setCustomPortal(event.target.value)}
                  placeholder="Ex. Le Figaro"
                  className={ADMIN_INPUT_CLASS}
                />
              </div>
            )}

            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Date du relevé
              </label>
              <Input
                type="date"
                value={capturedOn}
                onChange={(event) => setCapturedOn(event.target.value)}
                className={ADMIN_INPUT_CLASS}
              />
            </div>

            <div className="lg:col-span-2">
              <MetricInput label="Vues" icon={Eye} value={views} onChange={setViews} />
            </div>
            <div className="lg:col-span-2">
              <MetricInput label="Contacts" icon={Send} value={contacts} onChange={setContacts} />
            </div>
            <div className="lg:col-span-2">
              <MetricInput label="Favoris" icon={Heart} value={favorites} onChange={setFavorites} />
            </div>
            <div className="lg:col-span-2">
              <MetricInput label="Visites" icon={CalendarDays} value={visits} onChange={setVisits} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Note interne <span className="font-normal text-muted-foreground/70">(facultatif)</span>
            </label>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex. Campagne sponsorisée lancée cette semaine..."
              className={ADMIN_INPUT_CLASS}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
            <Button variant="outline" onClick={() => setShowForm(false)} className="h-10 font-medium rounded-xl border-input px-4 text-xs">
              Annuler
            </Button>
            <Button onClick={save} disabled={saving} className="h-10 font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs px-5 text-xs">
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Sparkles className="mr-1.5 size-4" />}
              Enregistrer le relevé
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-10 text-center bg-card/40 space-y-2">
          <TrendingUp className="size-10 text-muted-foreground/50 mb-1" />
          <p className="text-sm font-bold text-foreground">Aucun relevé pour le moment</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Ajoutez votre premier relevé de chiffres cumulés (vues, contacts, favoris) pour commencer le suivi d’audience.
          </p>
        </div>
      ) : summary && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Vues cumulées"
              value={summary.totals.views}
              change={summary.changes.views}
              icon={Eye}
              colorClass="border-sky-500/30 bg-sky-500/10 text-sky-600"
            />
            <KpiCard
              label="Contacts reçus"
              value={summary.totals.contacts}
              change={summary.changes.contacts}
              icon={Send}
              colorClass="border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
            />
            <KpiCard
              label="Coup de cœur"
              value={summary.totals.favorites}
              icon={Heart}
              colorClass="border-rose-500/30 bg-rose-500/10 text-rose-600"
            />
            <KpiCard
              label="Visites issues"
              value={summary.totals.visits}
              icon={CalendarDays}
              colorClass="border-amber-500/30 bg-amber-500/10 text-amber-600"
            />
          </div>

          {/* Chart & Recent Snapshots list */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
            {/* Evolution Line Chart */}
            <div className="rounded-2xl border bg-card p-5 shadow-2xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Évolution cumulée de l’audience</h3>
                <p className="text-xs text-muted-foreground">Historique de la somme des derniers relevés connus sur les portails.</p>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.timeline} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                    <XAxis dataKey="date" tickFormatter={formatDate} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '1rem',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                      labelFormatter={(value) => formatDate(String(value))}
                      formatter={(val, name) => [formatNumber(Number(val)), name === 'views' ? 'Vues' : 'Contacts']}
                    />
                    <Line type="monotone" dataKey="views" name="views" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="contacts" name="contacts" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Snapshots List */}
            <div className="rounded-2xl border bg-card shadow-2xs overflow-hidden flex flex-col">
              <div className="border-b border-border/40 px-5 py-3.5 flex items-center justify-between bg-muted/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Derniers relevés</h3>
                <Badge variant="outline" className="border-border text-muted-foreground text-xs font-semibold">
                  {recentSnapshots.length} portails
                </Badge>
              </div>
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[280px]">
                {recentSnapshots.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-bold text-foreground">{row.portal}</p>
                      <p className="text-[11px] text-muted-foreground">📅 {formatDate(row.captured_on)}</p>
                    </div>
                    <div className="shrink-0 text-right space-y-0.5">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-bold text-foreground">👁️ {formatNumber(row.views)}</span>
                        <span className="font-semibold text-emerald-600">✉️ {formatNumber(row.contacts)}</span>
                      </div>
                      {row.favorites > 0 && <p className="text-[11px] text-rose-500 font-medium">❤️ {row.favorites} favoris</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function MetricInput({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string
  icon: typeof Eye
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
        <Icon className="size-3.5 text-muted-foreground" />
        <span>{label}</span>
      </label>
      <Input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={ADMIN_INPUT_CLASS}
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  colorClass,
}: {
  label: string
  value: number
  change?: number | null
  icon: typeof Eye
  colorClass: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={cn("flex size-7 items-center justify-center rounded-xl border text-xs font-bold", colorClass)}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <p className="text-2xl font-bold tracking-tight text-foreground">{formatNumber(value)}</p>
        {change !== null && change !== undefined && (
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg border", change >= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-rose-500/30 bg-rose-500/10 text-rose-600")}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  )
}

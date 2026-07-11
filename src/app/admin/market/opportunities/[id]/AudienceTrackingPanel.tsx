'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Loader2, Plus, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
      toast.error('Indique le nom du portail')
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
      toast.success('Relevé enregistré et portail client actualisé')
    } catch (error) {
      console.error('[AudienceTrackingPanel save]', error)
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le relevé')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-brand" />
            <h2 className="text-base font-semibold">Diffusion & statistiques</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Ajoute un relevé daté pour suivre la performance de l’annonce dans le temps.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((value) => !value)}>
          <Plus className="mr-1 size-4" /> Nouveau relevé
        </Button>
      </div>

      {showForm && (
        <div className="mt-5 rounded-lg border bg-surface p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="space-y-1.5 text-sm font-medium">
              <span>Portail</span>
              <Select value={portal} onValueChange={setPortal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PORTALS.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            {portal === 'Autre' && (
              <label className="space-y-1.5 text-sm font-medium">
                <span>Nom du portail</span>
                <Input value={customPortal} onChange={(event) => setCustomPortal(event.target.value)} />
              </label>
            )}
            <label className="space-y-1.5 text-sm font-medium">
              <span>Date du relevé</span>
              <Input type="date" value={capturedOn} onChange={(event) => setCapturedOn(event.target.value)} />
            </label>
            <MetricInput label="Vues" value={views} onChange={setViews} />
            <MetricInput label="Contacts" value={contacts} onChange={setContacts} />
            <MetricInput label="Favoris" value={favorites} onChange={setFavorites} />
            <MetricInput label="Visites" value={visits} onChange={setVisits} />
          </div>
          <label className="mt-4 block space-y-1.5 text-sm font-medium">
            <span>Note interne <span className="font-normal text-muted-foreground">(facultatif)</span></span>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex. campagne sponsorisée lancée cette semaine" />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />} Enregistrer le relevé
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : snapshots.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed px-5 py-8 text-center">
          <TrendingUp className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Aucun relevé pour le moment</p>
          <p className="mt-1 text-sm text-muted-foreground">Commence avec les chiffres cumulés visibles aujourd’hui sur chaque portail.</p>
        </div>
      ) : summary && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Vues" value={summary.totals.views} change={summary.changes.views} />
            <Kpi label="Contacts" value={summary.totals.contacts} change={summary.changes.contacts} />
            <Kpi label="Favoris" value={summary.totals.favorites} />
            <Kpi label="Visites" value={summary.totals.visits} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Évolution cumulée</h3>
              <p className="mt-1 text-xs text-muted-foreground">Somme des derniers relevés connus pour chaque portail.</p>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip labelFormatter={(value) => formatDate(String(value))} formatter={(value, name) => [formatNumber(Number(value)), name === 'views' ? 'Vues' : 'Contacts']} />
                    <Line type="monotone" dataKey="views" stroke="var(--color-brand)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="contacts" stroke="var(--color-success)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Derniers relevés</h3>
              </div>
              <div className="divide-y">
                {recentSnapshots.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.portal}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(row.captured_on)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{formatNumber(row.views)} vues</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(row.contacts)} contacts</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function MetricInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <Input type="number" min="0" step="1" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Kpi({ label, value, change }: { label: string; value: number; change?: number | null }) {
  return (
    <div className="rounded-lg border bg-surface/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-2xl font-semibold tracking-tight">{formatNumber(value)}</p>
        {change !== null && change !== undefined && (
          <span className={change >= 0 ? 'pb-0.5 text-xs font-semibold text-success' : 'pb-0.5 text-xs font-semibold text-error'}>
            {change > 0 ? '+' : ''}{change} %
          </span>
        )}
      </div>
    </div>
  )
}

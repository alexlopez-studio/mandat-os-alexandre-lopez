'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Database, Download, ExternalLink, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CommuneResult = {
  nom: string
  code: string
  codesPostaux: string[]
  departement: { code: string; nom: string }
}

type DvfZone = {
  id: string
  insee_code: string
  name: string
  zipcode: string | null
  department_code: string | null
  active: boolean
  last_imported_at: string | null
  last_import_year: number | null
  last_import_status: string | null
  last_import_error: string | null
}

type DvfStats = {
  source: { dataset_url: string }
  totals: {
    transactions: number
    median_value: number | null
    median_price_per_m2: number | null
    avg_price_per_m2: number | null
    median_built_surface: number | null
    median_land_surface: number | null
  }
  by_type: Array<{ type: string; count: number; median_price_per_m2: number | null; median_value: number | null }>
  by_year: Array<{ year: number; count: number; median_price_per_m2: number | null; median_value: number | null }>
}

type DvfTransaction = {
  id: string
  mutation_date: string | null
  nature_mutation: string | null
  value: number | null
  street_name: string | null
  postal_code: string | null
  city_name: string | null
  local_type: string | null
  built_surface: number | null
  rooms: number | null
  land_surface: number | null
  price_per_m2: number | null
}

function formatEuro(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)}${suffix}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR')
}

function importYearOptions() {
  const max = new Date().getFullYear() - 1
  return Array.from({ length: Math.max(1, max - 2020) }, (_, index) => max - index)
}

export default function DvfPage() {
  const years = useMemo(importYearOptions, [])
  const [zones, setZones] = useState<DvfZone[]>([])
  const [selectedInsee, setSelectedInsee] = useState('')
  const [selectedYear, setSelectedYear] = useState(String(years[0]))
  const [selectedType, setSelectedType] = useState('all')
  const [stats, setStats] = useState<DvfStats | null>(null)
  const [transactions, setTransactions] = useState<DvfTransaction[]>([])
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importingInsee, setImportingInsee] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [communes, setCommunes] = useState<CommuneResult[]>([])
  const [searching, setSearching] = useState(false)

  const selectedZone = zones.find((zone) => zone.insee_code === selectedInsee) ?? null
  const localTypes = stats?.by_type.map((item) => item.type).filter(Boolean) ?? []

  const loadZones = useCallback(async () => {
    const res = await fetch('/api/market/dvf/zones')
    const data = await res.json()
    const nextZones = data.zones ?? []
    setZones(nextZones)
    setSelectedInsee((current) => current || nextZones[0]?.insee_code || '')
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedInsee) params.set('insee_code', selectedInsee)
      if (selectedYear !== 'all') params.set('year', selectedYear)
      if (selectedType !== 'all') params.set('local_type', selectedType)

      const [statsRes, txRes] = await Promise.all([
        fetch(`/api/market/dvf/stats?${params}`),
        fetch(`/api/market/dvf/transactions?${params}&limit=100`),
      ])

      const [statsData, txData] = await Promise.all([statsRes.json(), txRes.json()])
      setStats(statsData)
      setTransactions(txData.transactions ?? [])
      setTotalTransactions(txData.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [selectedInsee, selectedType, selectedYear])

  useEffect(() => {
    loadZones().catch((error) => {
      console.error(error)
      toast.error('Impossible de charger les communes DVF')
      setLoading(false)
    })
  }, [loadZones])

  useEffect(() => {
    loadDashboard().catch((error) => {
      console.error(error)
      toast.error('Impossible de charger les données DVF')
      setLoading(false)
    })
  }, [loadDashboard])

  async function searchCommunes(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setCommunes([])
      return
    }

    setSearching(true)
    try {
      const endpoint = /^\d{5}$/.test(value.trim())
        ? `/api/market/communes?codePostal=${value.trim()}`
        : `/api/market/communes?q=${encodeURIComponent(value.trim())}`
      const res = await fetch(endpoint)
      const data = await res.json()
      setCommunes(data.communes ?? [])
    } finally {
      setSearching(false)
    }
  }

  async function addCommune(commune: CommuneResult) {
    const res = await fetch('/api/market/dvf/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insee_code: commune.code,
        name: commune.nom,
        zipcode: commune.codesPostaux[0] ?? null,
        department_code: commune.departement.code,
      }),
    })

    if (!res.ok) {
      toast.error('Commune DVF non ajoutée')
      return
    }

    toast.success(`${commune.nom} ajoutée à DVF`)
    setQuery('')
    setCommunes([])
    await loadZones()
    setSelectedInsee(commune.code)
  }

  async function importZone(zone: DvfZone) {
    setImportingInsee(zone.insee_code)
    try {
      const res = await fetch('/api/market/dvf/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insee_code: zone.insee_code,
          name: zone.name,
          zipcode: zone.zipcode,
          year: selectedYear === 'all' ? years[0] : selectedYear,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import impossible')
      toast.success(`DVF importé : ${data.result.importedRows} ligne(s)`)
      await loadZones()
      await loadDashboard()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import DVF impossible')
    } finally {
      setImportingInsee(null)
    }
  }

  async function deleteZone(zone: DvfZone) {
    if (!confirm(`Supprimer ${zone.name} et ses mutations DVF importées ?`)) return
    const res = await fetch(`/api/market/dvf/zones/${zone.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Suppression impossible')
      return
    }
    toast.success(`${zone.name} supprimée`)
    setSelectedInsee('')
    await loadZones()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data & BI marché</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyse des mutations, prix médians et tendances locales depuis les données DVF.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Ajouter une commune</p>
              </div>
              <Input
                value={query}
                onChange={(event) => searchCommunes(event.target.value)}
                placeholder="Commune ou code postal"
                className="h-9"
              />
              {query.length >= 2 && (
                <div className="max-h-56 overflow-auto rounded-md border">
                  {searching ? (
                    <p className="p-3 text-xs text-muted-foreground">Recherche…</p>
                  ) : communes.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">Aucune commune</p>
                  ) : (
                    communes.map((commune) => (
                      <button
                        key={commune.code}
                        type="button"
                        onClick={() => addCommune(commune)}
                        className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent"
                      >
                        <span>
                          <span className="font-medium">{commune.nom}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{commune.codesPostaux.join(', ')}</span>
                        </span>
                        <Badge variant="outline">{commune.code}</Badge>
                      </button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Communes analysées</p>
              </div>
              {zones.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Ajoutez une commune pour commencer à importer les mutations.
                </p>
              ) : (
                <div className="space-y-2">
                  {zones.map((zone) => (
                    <div key={zone.id} className={`rounded-md border p-3 ${selectedInsee === zone.insee_code ? 'border-primary bg-accent/40' : 'bg-white'}`}>
                      <button type="button" onClick={() => setSelectedInsee(zone.insee_code)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{zone.name}</p>
                          <Badge variant="outline">{zone.insee_code}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {zone.zipcode ?? 'CP inconnu'} · import {zone.last_import_year ?? '—'} · {zone.last_import_status ?? 'jamais'}
                        </p>
                        {zone.last_import_error && <p className="mt-1 text-xs text-red-600">{zone.last_import_error}</p>}
                      </button>
                      <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" className="h-8" onClick={() => importZone(zone)} disabled={importingInsee === zone.insee_code}>
                          <Download className={`mr-1 h-3.5 w-3.5 ${importingInsee === zone.insee_code ? 'animate-pulse' : ''}`} />
                          Importer
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => deleteZone(zone)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Select value={selectedInsee || 'all'} onValueChange={(value) => setSelectedInsee(value === 'all' ? '' : value)}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Commune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les communes</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.insee_code}>{zone.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {localTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                {selectedZone ? selectedZone.name : 'Toutes communes'}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Mutations</p><p className="mt-1 text-2xl font-semibold">{formatNumber(stats?.totals.transactions)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Prix médian</p><p className="mt-1 text-2xl font-semibold">{formatEuro(stats?.totals.median_value)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Prix/m² médian</p><p className="mt-1 text-2xl font-semibold">{formatNumber(stats?.totals.median_price_per_m2, ' €/m²')}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Surface médiane</p><p className="mt-1 text-2xl font-semibold">{formatNumber(stats?.totals.median_built_surface, ' m²')}</p></CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Répartition par type</p>
                <div className="mt-3 space-y-2">
                  {(stats?.by_type ?? []).slice(0, 6).map((item) => {
                    const max = Math.max(...(stats?.by_type ?? []).map((type) => type.count), 1)
                    return (
                      <div key={item.type}>
                        <div className="mb-1 flex justify-between gap-3 text-xs">
                          <span>{item.type}</span>
                          <span className="text-muted-foreground">{item.count} · {formatNumber(item.median_price_per_m2, ' €/m²')}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Évolution annuelle</p>
                <div className="mt-3 space-y-2">
                  {(stats?.by_year ?? []).map((item) => (
                    <div key={item.year} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="font-medium">{item.year}</span>
                      <span className="text-muted-foreground">{item.count} mutations · {formatNumber(item.median_price_per_m2, ' €/m²')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm font-semibold">Mutations DVF</p>
                <p className="text-xs text-muted-foreground">{totalTransactions} résultat{totalTransactions > 1 ? 's' : ''}</p>
              </div>
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Adresse</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 text-right font-medium">Prix</th>
                      <th className="p-3 text-right font-medium">Surface</th>
                      <th className="p-3 text-right font-medium">Prix/m²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Chargement…</td></tr>
                    ) : transactions.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Aucune mutation importée pour ce filtre</td></tr>
                    ) : transactions.map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="p-3 text-muted-foreground">{formatDate(tx.mutation_date)}</td>
                        <td className="p-3">
                          <p className="font-medium">{tx.street_name ?? 'Adresse non renseignée'}</p>
                          <p className="text-xs text-muted-foreground">{tx.postal_code} {tx.city_name}</p>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{tx.local_type ?? '—'}</Badge>
                          {tx.rooms != null && <span className="ml-2 text-xs text-muted-foreground">{tx.rooms} p.</span>}
                        </td>
                        <td className="p-3 text-right font-medium">{formatEuro(tx.value)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatNumber(tx.built_surface, ' m²')}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatNumber(tx.price_per_m2, ' €/m²')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Source : données DVF publiques DGFiP / data.gouv, importées localement par commune.</span>
            <a href={stats?.source.dataset_url ?? 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
              data.gouv.fr <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

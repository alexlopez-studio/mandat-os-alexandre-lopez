'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Building2,
  Database,
  Download,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Grid,
  MetricCard,
  PageHeader,
  PageLayout,
  PageSection,
  Panel,
  StatusPill,
} from '@/components/pro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

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
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Marché"
        title="Data & BI"
        description="Analyse des mutations, prix médians et tendances locales depuis les données DVF."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      <PageSection>
        <Grid cols={4}>
          <MetricCard
            label="Mutations"
            value={formatNumber(stats?.totals.transactions)}
            detail="Transactions enregistrées"
            icon={Database}
            tone="neutral"
          />
          <MetricCard
            label="Prix médian"
            value={formatEuro(stats?.totals.median_value)}
            detail="Valeur foncière médiane"
            icon={BarChart3}
            tone="brand"
          />
          <MetricCard
            label="Prix/m² médian"
            value={formatNumber(stats?.totals.median_price_per_m2, ' €/m²')}
            detail="Bâti net vendeur"
            icon={TrendingUp}
            tone="neutral"
          />
          <MetricCard
            label="Surface médiane"
            value={formatNumber(stats?.totals.median_built_surface, ' m²')}
            detail="Surface bâtie médiane"
            icon={Building2}
            tone="neutral"
          />
        </Grid>
      </PageSection>

      <PageSection>
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Colonne gauche : Communes & Gestion */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <Panel
              title="Ajouter une commune"
              description="Rechercher par nom ou code postal pour importer les données DVF"
            >
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => searchCommunes(event.target.value)}
                    placeholder="Commune ou code postal"
                    className="pl-8"
                  />
                </div>

                {query.length >= 2 && (
                  <div className="max-h-56 overflow-auto rounded-lg border border-border bg-card">
                    {searching ? (
                      <p className="p-4 text-xs text-muted-foreground">Recherche en cours…</p>
                    ) : communes.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground">Aucune commune trouvée</p>
                    ) : (
                      communes.map((commune) => (
                        <button
                          key={commune.code}
                          type="button"
                          onClick={() => addCommune(commune)}
                          className="flex w-full items-center justify-between gap-4 border-b border-border p-4 text-left text-sm last:border-0 hover:bg-muted/50"
                        >
                          <span className="min-w-0">
                            <span className="font-semibold text-foreground">{commune.nom}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {commune.codesPostaux.join(', ')}
                            </span>
                          </span>
                          <Badge variant="outline">{commune.code}</Badge>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="Communes analysées"
              description={`${zones.length} commune${zones.length > 1 ? 's' : ''} configurée${zones.length > 1 ? 's' : ''}`}
            >
              {zones.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Ajoutez une commune pour commencer à importer les mutations DVF.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {zones.map((zone) => {
                    const isSelected = selectedInsee === zone.insee_code
                    return (
                      <div
                        key={zone.id}
                        className={cn(
                          'flex flex-col gap-4 rounded-lg border p-4 transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border bg-card hover:bg-muted/30'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedInsee(zone.insee_code)}
                          className="flex flex-col gap-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground">{zone.name}</span>
                            <Badge variant="outline">{zone.insee_code}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {zone.zipcode ?? 'CP non renseigné'} · import {zone.last_import_year ?? '—'}
                          </p>
                          {zone.last_import_status ? (
                            <div className="mt-1">
                              <StatusPill
                                tone={
                                  zone.last_import_status === 'success'
                                    ? 'success'
                                    : zone.last_import_status === 'error'
                                      ? 'danger'
                                      : 'neutral'
                                }
                              >
                                {zone.last_import_status}
                              </StatusPill>
                            </div>
                          ) : null}
                          {zone.last_import_error ? (
                            <p className="mt-1 text-xs text-destructive">{zone.last_import_error}</p>
                          ) : null}
                        </button>

                        <div className="flex items-center gap-2 border-t border-border pt-4">
                          <Button
                            size="sm"
                            className="flex-1 gap-2 font-semibold"
                            onClick={() => importZone(zone)}
                            disabled={importingInsee === zone.insee_code}
                          >
                            <Download
                              className={cn(
                                'size-3.5',
                                importingInsee === zone.insee_code && 'animate-pulse'
                              )}
                            />
                            Importer DVF
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteZone(zone)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Colonne droite : Filtres, Graphiques & Table */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            {/* Barre de filtres */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="w-full sm:w-64">
                <Select
                  value={selectedInsee || 'all'}
                  onValueChange={(value) => setSelectedInsee(value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les communes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les communes</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.insee_code}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-36">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Année" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type de bien" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {localTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <MapPin className="size-4 text-primary" />
                <span>{selectedZone ? selectedZone.name : 'Toutes communes'}</span>
              </div>
            </div>

            {/* Répartition & Évolution */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Panel
                title="Répartition par type"
                description="Distribution du volume et prix/m²"
              >
                <div className="flex flex-col gap-4">
                  {(stats?.by_type ?? []).length === 0 ? (
                    <p className="py-4 text-xs text-muted-foreground">Aucune donnée disponible</p>
                  ) : (
                    (stats?.by_type ?? []).slice(0, 6).map((item) => {
                      const max = Math.max(...(stats?.by_type ?? []).map((type) => type.count), 1)
                      const percentage = Math.max(4, (item.count / max) * 100)
                      return (
                        <div key={item.type} className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{item.type}</span>
                            <span className="text-muted-foreground">
                              {item.count} ({formatNumber(item.median_price_per_m2, ' €/m²')})
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Panel>

              <Panel
                title="Évolution annuelle"
                description="Historique des volumes de ventes"
              >
                <div className="flex flex-col gap-2">
                  {(stats?.by_year ?? []).length === 0 ? (
                    <p className="py-4 text-xs text-muted-foreground">Aucun historique disponible</p>
                  ) : (
                    (stats?.by_year ?? []).map((item) => (
                      <div
                        key={item.year}
                        className="flex items-center justify-between rounded-lg border border-border bg-background p-4 text-xs"
                      >
                        <span className="font-bold text-foreground">{item.year}</span>
                        <span className="text-muted-foreground">
                          {item.count} mutations · {formatNumber(item.median_price_per_m2, ' €/m²')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>

            {/* Tableau des mutations */}
            <Panel
              title="Mutations DVF"
              description={`${totalTransactions} résultat${totalTransactions > 1 ? 's' : ''}`}
            >
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-xs font-bold uppercase tracking-normal text-muted-foreground">
                      <th className="p-4">Date</th>
                      <th className="p-4">Adresse</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 text-right">Prix</th>
                      <th className="p-4 text-right">Surface</th>
                      <th className="p-4 text-right">Prix/m²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                          Chargement des données DVF…
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                          Aucune mutation enregistrée pour ce filtre.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx.id} className="transition-colors hover:bg-muted/40">
                          <td className="p-4 text-xs text-muted-foreground">
                            {formatDate(tx.mutation_date)}
                          </td>
                          <td className="p-4">
                            <p className="font-medium text-foreground">
                              {tx.street_name ?? 'Adresse non renseignée'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tx.postal_code} {tx.city_name}
                            </p>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{tx.local_type ?? '—'}</Badge>
                            {tx.rooms != null && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {tx.rooms} p.
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right font-bold text-foreground">
                            {formatEuro(tx.value)}
                          </td>
                          <td className="p-4 text-right text-xs text-muted-foreground">
                            {formatNumber(tx.built_surface, ' m²')}
                          </td>
                          <td className="p-4 text-right text-xs font-medium text-muted-foreground">
                            {formatNumber(tx.price_per_m2, ' €/m²')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                <span>Source : données DVF publiques DGFiP / data.gouv, importées localement par commune.</span>
                <a
                  href={stats?.source.dataset_url ?? 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium underline hover:text-foreground"
                >
                  data.gouv.fr <ExternalLink className="size-3" />
                </a>
              </div>
            </Panel>
          </div>
        </div>
      </PageSection>
    </PageLayout>
  )
}

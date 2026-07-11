'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { MapPin, RefreshCw, Trash2, Power, PowerOff, CheckCircle2, AlertTriangle, XCircle, Clock, Search, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

interface CommuneResult {
  nom: string
  code: string
  codesPostaux: string[]
  departement: { code: string; nom: string }
  population?: number
}

interface Zone {
  id: string
  name: string
  zipcode: string
  city: string | null
  insee_code: string | null
  active: boolean
  sync_frequency: string
  last_synced_at: string | null
}

interface ZoneWithStats extends Zone {
  property_count: number
  seen_property_count: number
  not_seen_property_count: number
  last_sync_status: string | null
  last_sync_started_at: string | null
  last_success_sync_at: string | null
  last_external_requests: number
  last_estimated_cost_eur: number
  last_blocked_reason: string | null
}

interface StreamEstateBudget {
  sync_enabled: boolean
  manual_balance_eur: number
  cost_per_item_eur?: number
  max_items_per_sync?: number
  unlimited_items?: boolean
  cost_per_request_eur: number
  max_requests_per_sync: number
  min_balance_eur: number
  resync_window_minutes?: number
  estimated_balance_eur: number
  estimated_spent_today_eur: number
  estimated_spent_month_eur: number
  estimated_items_total?: number
  estimated_items_today?: number
  estimated_items_month?: number
  external_items_today?: number
  external_items_month?: number
  external_requests_today: number
  external_requests_month: number
  last_blocked_reason: string | null
}

interface SyncPreview {
  zipcode: string
  requested_max_items: number
  budget_max_items_per_sync: number
  effective_max_items: number
  max_items: number
  total_available: number
  estimated_items: number
  estimated_cost_eur: number
  estimated_balance_after: number
  sync_enabled: boolean
  can_confirm: boolean
  blocked_reason: string | null
  cost_per_item_eur: number
  min_balance_eur: number
  estimated_balance_eur: number
}

interface OrphanProperties {
  count: number
  zipcodes: Array<{ zipcode: string; count: number }>
}

// ── Helpers ────────────────────────────────────────────────────────────────

const VERY_STALE_MINUTES = 7 * 24 * 60 // 7 jours

// Fraîcheur alignée sur la fenêtre anti-re-sync : tant qu'on est dans la fenêtre, une nouvelle
// sync serait ignorée (zone à jour). Au-delà, une resync est possible — c'est normal, pas alarmant.
function freshnessStatus(
  last_synced_at: string | null,
  last_sync_status: string | null,
  resyncWindowMinutes: number,
) {
  if (last_sync_status === 'error') return 'error'
  if (last_sync_status === 'blocked') return 'blocked'
  if (!last_synced_at) return 'never'
  const ageMin = (Date.now() - new Date(last_synced_at).getTime()) / 60000
  if (resyncWindowMinutes > 0 && ageMin < resyncWindowMinutes) return 'fresh'
  if (ageMin > VERY_STALE_MINUTES) return 'stale'
  return 'syncable'
}

function FreshnessBadge({
  last_synced_at,
  last_sync_status,
  resyncWindowMinutes = 360,
}: {
  last_synced_at: string | null
  last_sync_status: string | null
  resyncWindowMinutes?: number
}) {
  const status = freshnessStatus(last_synced_at, last_sync_status, resyncWindowMinutes)
  const map = {
    fresh: { icon: CheckCircle2, label: 'À jour', cls: 'text-green-700 bg-green-50 border-green-200' },
    syncable: { icon: RefreshCw, label: 'Resync possible', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
    stale: { icon: AlertTriangle, label: 'Ancien', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    error: { icon: XCircle, label: 'Erreur', cls: 'text-red-700 bg-red-50 border-red-200' },
    blocked: { icon: AlertTriangle, label: 'Bloquée', cls: 'text-amber-800 bg-amber-50 border-amber-200' },
    never: { icon: Clock, label: 'Jamais synced', cls: 'text-muted-foreground bg-muted border-border' },
  }
  const { icon: Icon, label, cls } = map[status]
  return (
    <span className={`flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  )
}

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Jamais'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  return `Il y a ${Math.floor(h / 24)}j`
}

function formatResyncWindow(minutes: number): string {
  if (minutes <= 0) return 'désactivée'
  if (minutes < 60) return `${minutes} min`
  const h = minutes / 60
  return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ── Commune search ──────────────────────────────────────────────────────────

function CommuneSearch({ onSelect }: { onSelect: (c: CommuneResult, zip: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CommuneResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCommune, setSelectedCommune] = useState<CommuneResult | null>(null)
  const [selectedZip, setSelectedZip] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function search(q: string) {
    setQuery(q)
    setSelectedCommune(null)
    setSelectedZip('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        // Si c'est un code postal (5 chiffres) → chercher par codePostal
        const isZip = /^\d{5}$/.test(q)
        const url = isZip
          ? `/api/market/communes?codePostal=${q}`
          : `/api/market/communes?q=${encodeURIComponent(q)}`
        const res = await fetch(url)
        const { communes } = await res.json()
        setResults(communes ?? [])
        setShowDropdown(true)
      } catch { setResults([]) } finally { setLoading(false) }
    }, 300)
  }

  function pickCommune(commune: CommuneResult) {
    setSelectedCommune(commune)
    setQuery(commune.nom)
    setShowDropdown(false)
    setResults([])
    // Auto-sélectionner le ZIP si commune en a un seul
    if (commune.codesPostaux.length === 1) {
      setSelectedZip(commune.codesPostaux[0])
    } else {
      setSelectedZip('')
    }
  }

  function confirm() {
    if (!selectedCommune || !selectedZip) return
    onSelect(selectedCommune, selectedZip)
    setQuery('')
    setSelectedCommune(null)
    setSelectedZip('')
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Nom de commune ou code postal (ex : Barjols, 83670…)"
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="pl-9"
          />
          {loading && (
            <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-lg overflow-hidden">
            {results.slice(0, 8).map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickCommune(c)}
                className="flex w-full items-start justify-between px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{c.nom}</span>
                  <span className="text-xs text-muted-foreground ml-2">{c.departement?.nom}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {c.codesPostaux.join(', ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Si commune sélectionnée avec plusieurs codes postaux : choix du CP */}
      {selectedCommune && selectedCommune.codesPostaux.length > 1 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong>{selectedCommune.nom}</strong> a plusieurs codes postaux — choisissez celui à surveiller :
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedCommune.codesPostaux.map((zip) => (
              <button
                key={zip}
                type="button"
                onClick={() => setSelectedZip(zip)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  selectedZip === zip
                    ? 'bg-primary text-white border-primary'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {zip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Récap + bouton ajouter */}
      {selectedCommune && selectedZip && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
          <div className="text-sm">
            <span className="font-semibold">{selectedCommune.nom}</span>
            <span className="text-muted-foreground ml-2">· {selectedZip} · {selectedCommune.departement?.nom}</span>
            <span className="text-muted-foreground ml-2">· INSEE {selectedCommune.code}</span>
          </div>
          <Button size="sm" onClick={confirm}>
            <MapPin className="mr-1 h-3.5 w-3.5" /> Ajouter
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ZonesPage() {
  const [zones, setZones] = useState<ZoneWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const [showNew, setShowNew] = useState(false)
  const [deleteInfo, setDeleteInfo] = useState<{ zone: ZoneWithStats; deletedProperties?: number } | null>(null)
  const [budget, setBudget] = useState<StreamEstateBudget | null>(null)
  const [orphanProperties, setOrphanProperties] = useState<OrphanProperties | null>(null)
  const [purgingOrphans, setPurgingOrphans] = useState(false)
  const [syncDraft, setSyncDraft] = useState<{ zipcode: string; insee: string | null; communeName: string | null; label: string; maxItems: string }>({
    zipcode: '',
    insee: null,
    communeName: null,
    label: '',
    maxItems: '30',
  })
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmingSync, setConfirmingSync] = useState(false)
  const syncPanelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [zonesRes, statsRes] = await Promise.all([
        fetch('/api/market/zones?limit=100'),
        fetch('/api/market/sync-stats'),
      ])
      const { zones: rawZones } = await zonesRes.json()
      const stats = await statsRes.json()
      setBudget(stats.stream_estate_budget ?? null)
      setOrphanProperties(stats.orphan_properties ?? null)

      const statsMap: Record<string, {
        property_count: number
        seen_property_count: number
        not_seen_property_count: number
        last_sync_status: string | null
        last_sync_started_at: string | null
        last_success_sync_at: string | null
        last_external_requests: number
        last_estimated_cost_eur: number
        last_blocked_reason: string | null
      }> = {}
      for (const z of stats.zones ?? []) {
        statsMap[z.zone_id] = {
          property_count: z.property_count,
          seen_property_count: z.seen_property_count,
          not_seen_property_count: z.not_seen_property_count,
          last_sync_status: z.last_sync_status,
          last_sync_started_at: z.last_sync_started_at,
          last_success_sync_at: z.last_success_sync_at,
          last_external_requests: z.last_external_requests,
          last_estimated_cost_eur: z.last_estimated_cost_eur,
          last_blocked_reason: z.last_blocked_reason,
        }
      }

      setZones((rawZones ?? []).map((z: Zone) => ({
        ...z,
        property_count: statsMap[z.id]?.property_count ?? 0,
        seen_property_count: statsMap[z.id]?.seen_property_count ?? 0,
        not_seen_property_count: statsMap[z.id]?.not_seen_property_count ?? 0,
        last_sync_status: statsMap[z.id]?.last_sync_status ?? null,
        last_sync_started_at: statsMap[z.id]?.last_sync_started_at ?? null,
        last_success_sync_at: statsMap[z.id]?.last_success_sync_at ?? null,
        last_external_requests: statsMap[z.id]?.last_external_requests ?? 0,
        last_estimated_cost_eur: statsMap[z.id]?.last_estimated_cost_eur ?? 0,
        last_blocked_reason: statsMap[z.id]?.last_blocked_reason ?? null,
      })))
    } catch (err) {
      console.error('Erreur chargement zones', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!budget) return
    setSyncDraft((current) => {
      if (current.zipcode) return current
      const fallbackMax = budget.max_items_per_sync ?? budget.max_requests_per_sync ?? 30
      return { ...current, maxItems: String(fallbackMax) }
    })
  }, [budget])

  async function addZone(commune: CommuneResult, zipcode: string) {
    await fetch('/api/market/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: commune.nom,
        zipcode,
        city: commune.nom,
        insee_code: commune.code,
        sync_frequency: 'daily',
      }),
    })
    setShowNew(false)
    await load()
  }

  async function toggleZone(zone: ZoneWithStats) {
    await fetch(`/api/market/zones/${zone.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !zone.active }),
    })
    await load()
  }

  async function deleteZone(zone: ZoneWithStats) {
    const res = await fetch(`/api/market/zones/${zone.id}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleteInfo({ zone, deletedProperties: data.deleted_properties ?? 0 })
    setTimeout(() => setDeleteInfo(null), 4000)
    await load()
  }

  async function previewSync(zipcode: string, maxItems: number, inseeCode: string | null = null) {
    if (!/^\d{5}$/.test(zipcode)) {
      toast.error('Choisis un code postal valide avant de prévisualiser')
      return null
    }
    setPreviewLoading(true)
    try {
      // En illimité, on n'envoie pas max_items : le serveur tire toute la base en ligne (borné budget).
      const previewBody: Record<string, unknown> = { zipcode, insee_code: inseeCode }
      if (!budget?.unlimited_items) previewBody.max_items = maxItems
      const res = await fetch('/api/market/sync-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewBody),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(`Prévisualisation impossible : ${data.error ?? res.statusText}`)
        setSyncPreview(null)
        return null
      }
      setSyncPreview(data)
      return data as SyncPreview
    } catch (err) {
      toast.error(`Prévisualisation impossible : ${err instanceof Error ? err.message : String(err)}`)
      setSyncPreview(null)
      return null
    } finally {
      setPreviewLoading(false)
    }
  }

  async function confirmSync(force = false) {
    const zipcode = syncDraft.zipcode.trim()
    const inseeCode = syncDraft.insee
    const maxItems = Math.max(1, Math.floor(Number(syncDraft.maxItems) || 1))
    if (!/^\d{5}$/.test(zipcode)) {
      toast.error('Choisis un code postal valide avant de confirmer')
      return
    }

    if (!syncPreview || syncPreview.zipcode !== zipcode || syncPreview.max_items !== maxItems) {
      const refreshed = await previewSync(zipcode, maxItems, inseeCode)
      if (!refreshed) return
      if (!refreshed.can_confirm) {
        toast.error('Le plafond demandé dépasse le budget disponible')
        return
      }
    } else if (!syncPreview.can_confirm) {
      toast.error('Le plafond demandé dépasse le budget disponible')
      return
    }

    setConfirmingSync(true)
    setSyncing((prev) => ({ ...prev, [zipcode]: true }))
    try {
      const syncBody: Record<string, unknown> = { zipcode, force, insee_code: inseeCode, name: syncDraft.communeName, city: syncDraft.communeName }
      if (!budget?.unlimited_items) syncBody.max_items = maxItems
      const res = await fetch('/api/market/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncBody),
      })
      const data = await res.json()
      if (!res.ok) {
        const reason = data.blocked_reason ? ` (${data.blocked_reason})` : ''
        toast.error(`Sync refusée : ${data.error ?? res.statusText}${reason}`)
      } else if (data.from_cache) {
        // La fenêtre anti-re-sync a court-circuité l'appel : aucune dépense.
        const windowLabel = typeof data.resync_window_minutes === 'number'
          ? ` · resync auto après ${formatResyncWindow(data.resync_window_minutes)}`
          : ''
        toast(`${zipcode} déjà à jour — synchronisé ${formatLastSync(data.last_synced_at)} (aucun appel API)`, {
          description: `${data.fetched ?? 0} bien(s) déjà en base${windowLabel}`,
          action: {
            label: 'Forcer la resync',
            onClick: () => { void confirmSync(true) },
          },
        })
      } else if (data.partial) {
        toast.warning(`Sync partielle de ${zipcode} — plafond de ${maxItems} item(s) atteint (${data.fetched ?? 0} récupéré(s)). Augmente le plafond pour tout récupérer.`)
        setSyncPreview(null)
        setSyncDraft((current) => ({ ...current, zipcode: '', insee: null, communeName: null, label: '' }))
      } else {
        toast.success(`${zipcode} synchronisé — ${data.fetched ?? 0} bien(s), ${data.billed_items ?? 0} item(s), ${formatEuro(Number(data.estimated_cost_eur ?? 0))} estimés`)
        setSyncPreview(null)
        setSyncDraft((current) => ({ ...current, zipcode: '', insee: null, communeName: null, label: '' }))
      }
      await load()
    } catch (err) {
      toast.error(`Erreur réseau : ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setConfirmingSync(false)
      setSyncing((prev) => ({ ...prev, [zipcode]: false }))
    }
  }

  async function prefillSyncFromZone(zone: ZoneWithStats) {
    const maxItems = budget?.max_items_per_sync ?? budget?.max_requests_per_sync ?? 30
    setSyncDraft({
      zipcode: zone.zipcode,
      insee: zone.insee_code,
      communeName: zone.city ?? zone.name,
      label: zone.name,
      maxItems: String(maxItems),
    })
    if (syncPanelRef.current) {
      syncPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const preview = await previewSync(zone.zipcode, maxItems, zone.insee_code)
    if (preview && !preview.can_confirm) {
      toast.error('Ce plafond dépasse le budget disponible')
    }
  }

  async function purgeOrphanProperties() {
    const count = orphanProperties?.count ?? 0
    if (count === 0) return
    const zipcodes = orphanProperties?.zipcodes.slice(0, 8).map((item) => `${item.zipcode} (${item.count})`).join(', ')
    if (!confirm(`Supprimer ${count} bien${count > 1 ? 's' : ''} hors zones surveillées ?\n\nCP concernés : ${zipcodes}${(orphanProperties?.zipcodes.length ?? 0) > 8 ? ', …' : ''}\n\nCette action ne supprime aucune zone.`)) {
      return
    }

    setPurgingOrphans(true)
    try {
      const res = await fetch('/api/market/properties?scope=orphans', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(`Purge impossible : ${data.error ?? res.statusText}`)
      } else {
        toast.success(`${data.deleted_properties ?? 0} bien(s) hors zones supprimé(s)`)
      }
      await load()
    } catch (err) {
      toast.error(`Erreur purge : ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPurgingOrphans(false)
    }
  }

  const activeCount = zones.filter((z) => z.active).length
  const syncBlockedByBudget = Boolean(
    budget && (!budget.sync_enabled || budget.estimated_balance_eur <= budget.min_balance_eur),
  )

  // Explique pourquoi « Confirmer la sync » est (in)disponible, pour ne pas laisser un bouton grisé muet.
  const confirmReason = (() => {
    if (!syncDraft.zipcode) return 'Sélectionne un code postal pour prévisualiser.'
    if (!syncPreview) return 'Clique « Prévisualiser » pour estimer le coût, puis confirme.'
    if (syncPreview.can_confirm) return 'Prêt : la confirmation relance une vérification serveur avant l’import.'
    if (syncPreview.blocked_reason === 'stream_estate_sync_disabled') return 'Sync désactivée — active-la dans Réglages › Budget Stream Estate.'
    if (syncPreview.blocked_reason === 'stream_estate_max_items_exceeded') return `Plafond demandé (${syncPreview.requested_max_items}) supérieur au plafond autorisé (${syncPreview.budget_max_items_per_sync}).`
    if (syncPreview.blocked_reason === 'stream_estate_budget_insufficient') return 'Budget insuffisant — augmente le « Solde manuel » dans Réglages › Budget Stream Estate.'
    return 'Confirmation indisponible pour ce réglage.'
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zones surveillées</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? '…' : `${activeCount} active${activeCount > 1 ? 's' : ''} sur ${zones.length} — commune par commune`}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNew(!showNew)}>
          <MapPin className="mr-1 h-4 w-4" /> Ajouter une commune
        </Button>
      </div>

      {budget && (
        <Card className={budget.sync_enabled ? '' : 'border-amber-200 bg-amber-50/60'}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Synchronisation Stream Estate par code postal</p>
                <Badge
                  variant="outline"
                  className={budget.sync_enabled
                    ? 'text-[10px] bg-green-50 text-green-700 border-green-200'
                    : 'text-[10px] bg-amber-50 text-amber-800 border-amber-200'}
                >
                  {budget.sync_enabled ? 'Active' : 'Désactivée'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Une action synchronise uniquement le CP sélectionné. Plafond : {budget.unlimited_items
                  ? 'illimité (toute la base en ligne)'
                  : `${budget.max_items_per_sync ?? budget.max_requests_per_sync} item${(budget.max_items_per_sync ?? budget.max_requests_per_sync) > 1 ? 's' : ''} par sync`}.
                {typeof budget.resync_window_minutes === 'number' && ` Resync auto après ${formatResyncWindow(budget.resync_window_minutes)} (forçable).`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Solde estimé</p>
                <p className="font-semibold tabular-nums">{formatEuro(budget.estimated_balance_eur)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Coût/item</p>
                <p className="font-semibold tabular-nums">{formatEuro(budget.cost_per_item_eur ?? budget.cost_per_request_eur)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Items aujourd’hui</p>
                <p className="font-semibold tabular-nums">{budget.external_items_today ?? budget.external_requests_today}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Dépensé mois</p>
                <p className="font-semibold tabular-nums">{formatEuro(budget.estimated_spent_month_eur)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {orphanProperties && orphanProperties.count > 0 && (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  {orphanProperties.count} bien{orphanProperties.count > 1 ? 's' : ''} en base sans zone surveillée
                </p>
                <p className="mt-1 text-xs text-red-800">
                  Ces biens ne sont rattachés à aucune zone actuelle. CP concernés : {orphanProperties.zipcodes.slice(0, 8).map((item) => `${item.zipcode} (${item.count})`).join(', ')}
                  {orphanProperties.zipcodes.length > 8 ? ', …' : ''}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={purgeOrphanProperties}
              disabled={purgingOrphans}
              className="border-red-200 bg-white text-red-800 hover:bg-red-100"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {purgingOrphans ? 'Purge…' : 'Purger les biens hors zones'}
            </Button>
          </CardContent>
        </Card>
      )}

      <section ref={syncPanelRef} className="rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Sync contrôlée Stream Estate</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choisis un code postal, fixe un plafond d&apos;items, puis prévisualise le coût avant de lancer l&apos;import.
            </p>
          </div>
          <Badge
            variant="outline"
            className={`w-fit text-[10px] ${
              budget?.sync_enabled
                ? 'text-green-700 border-green-200 bg-green-50'
                : 'text-amber-800 border-amber-200 bg-amber-50'
            }`}
          >
            {budget?.sync_enabled ? 'Sync autorisée' : 'Sync désactivée'}
          </Badge>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <CommuneSearch
              onSelect={(commune, zip) => {
                setSyncDraft((current) => ({
                  ...current,
                  zipcode: zip,
                  insee: commune.code,
                  communeName: commune.nom,
                  label: `${commune.nom} · ${zip}`,
                }))
                setSyncPreview(null)
              }}
            />
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="space-y-1">
                <span className="text-[11px] font-medium">Code postal</span>
                <Input
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="83670"
                  value={syncDraft.zipcode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
                    // CP saisi à la main → on perd la précision commune (INSEE).
                    setSyncDraft((current) => ({ ...current, zipcode: value, insee: null, communeName: null, label: '' }))
                    setSyncPreview(null)
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium">Max items</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={budget?.unlimited_items ? '' : syncDraft.maxItems}
                  placeholder={budget?.unlimited_items ? 'Illimité' : undefined}
                  disabled={budget?.unlimited_items}
                  onChange={(e) => {
                    setSyncDraft((current) => ({ ...current, maxItems: e.target.value }))
                    setSyncPreview(null)
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
              {syncDraft.zipcode ? (
                <>
                  <span><strong className="text-foreground">{syncDraft.label || `CP ${syncDraft.zipcode}`}</strong> · {budget?.unlimited_items ? 'toute la base en ligne' : `plafond ${syncDraft.maxItems || '1'} item(s)`}</span>
                  {syncDraft.insee ? (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200" title={`Filtrage Stream Estate par code INSEE ${syncDraft.insee} : seuls les biens de cette commune sont récupérés.`}>
                      Commune exacte · INSEE {syncDraft.insee}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200" title="Sans code INSEE, le filtrage se fait par code postal et peut inclure les communes voisines partageant ce CP.">
                      CP seul · communes voisines incluses
                    </Badge>
                  )}
                </>
              ) : (
                <span>Commence par sélectionner une commune ou saisir un code postal.</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Estimation <span className="font-normal text-green-700">· gratuit</span></p>
                <p className="text-[11px] text-muted-foreground">Comptage sans création de zone ni consommation de crédit</p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  syncPreview?.can_confirm
                    ? 'text-green-700 border-green-200 bg-green-50'
                    : syncPreview
                      ? 'text-amber-800 border-amber-200 bg-amber-50'
                      : 'text-muted-foreground border-border bg-muted'
                }`}
              >
                {previewLoading ? 'Prévu…' : syncPreview?.can_confirm ? 'OK' : syncPreview ? 'À revoir' : 'En attente'}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md border px-3 py-2">
                <p className="text-muted-foreground">Items estimés</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{syncPreview ? syncPreview.estimated_items : '—'}</p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-muted-foreground">Coût estimé</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{syncPreview ? formatEuro(syncPreview.estimated_cost_eur) : '—'}</p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-muted-foreground">Total trouvé</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{syncPreview ? syncPreview.total_available : '—'}</p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-muted-foreground">Solde après</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{syncPreview ? formatEuro(syncPreview.estimated_balance_after) : '—'}</p>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              {syncPreview?.blocked_reason === 'stream_estate_sync_disabled'
                ? 'La sync est désactivée dans le budget.'
                : syncPreview?.blocked_reason === 'stream_estate_max_items_exceeded'
                  ? `Le plafond demandé (${syncPreview.requested_max_items}) dépasse le plafond global autorisé (${syncPreview.budget_max_items_per_sync}).`
                : syncPreview?.blocked_reason === 'stream_estate_budget_insufficient'
                  ? 'Le plafond demandé dépasse le budget disponible.'
                  : syncPreview
                    ? `Prévision basée sur ${syncPreview.total_available} bien(s) côté API avec un plafond effectif de ${syncPreview.effective_max_items} item(s).`
                    : 'Aucune prévisualisation chargée pour l’instant.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-[11px] ${syncPreview && !syncPreview.can_confirm ? 'text-amber-700' : 'text-muted-foreground'}`}>
            {confirmReason}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => previewSync(syncDraft.zipcode.trim(), Math.max(1, Math.floor(Number(syncDraft.maxItems) || 1)), syncDraft.insee)}
              disabled={previewLoading || !syncDraft.zipcode}
            >
              {previewLoading ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
              Prévisualiser
            </Button>
            <Button
              size="sm"
              onClick={() => confirmSync()}
              disabled={confirmingSync || previewLoading || !syncPreview?.can_confirm}
              title={confirmReason}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${confirmingSync ? 'animate-spin' : ''}`} />
              Confirmer la sync
            </Button>
          </div>
        </div>
      </section>

      {/* Toast suppression */}
      {deleteInfo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{deleteInfo.zone.name}</strong> supprimée
          {deleteInfo.deletedProperties
            ? ` · ${deleteInfo.deletedProperties} bien${deleteInfo.deletedProperties > 1 ? 's' : ''} supprimé${deleteInfo.deletedProperties > 1 ? 's' : ''} de la base`
            : ' · Les biens sont conservés (autre zone active sur ce code postal)'}
        </div>
      )}

      {/* Formulaire ajout commune */}
      {showNew && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground mb-3">
              Recherchez une commune française par nom ou code postal. Les données proviennent de l'API officielle <strong>geo.api.gouv.fr</strong>.
            </p>
            <CommuneSearch onSelect={addZone} />
            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des zones */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-[80px] rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : zones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <MapPin className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">Aucune commune configurée</p>
            <p className="text-xs">Ajoutez des communes pour commencer à surveiller le marché</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {zones.map((zone) => (
            <Card key={zone.id} className={zone.active ? '' : 'opacity-60'}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{zone.name}</p>
                      <Badge
                        variant="outline"
                        className={zone.active
                          ? 'text-[10px] bg-green-50 text-green-700 border-green-200'
                          : 'text-[10px] bg-gray-50 text-gray-500 border-gray-200'}
                      >
                        {zone.active ? 'Actif' : 'Inactif'}
                      </Badge>
                      <FreshnessBadge last_synced_at={zone.last_synced_at} last_sync_status={zone.last_sync_status} resyncWindowMinutes={budget?.resync_window_minutes} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        CP {zone.zipcode}
                        {zone.insee_code && <span className="ml-1 opacity-60">· INSEE {zone.insee_code}</span>}
                      </p>
                      {zone.insee_code ? (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200" title="Filtrage Stream Estate par code INSEE : seuls les biens de cette commune sont récupérés.">
                          Commune exacte
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200" title="Sans code INSEE, le filtrage se fait par code postal et peut inclure les communes voisines partageant ce CP.">
                          CP seul · communes voisines incluses
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground sm:grid-cols-4">
                      <span><strong className="text-foreground">{zone.property_count}</strong> en base</span>
                      <span><strong className="text-foreground">{zone.seen_property_count}</strong> revu{zone.seen_property_count > 1 ? 's' : ''}</span>
                      <span className={zone.not_seen_property_count > 0 ? 'text-amber-700' : ''}>
                        <strong className={zone.not_seen_property_count > 0 ? 'text-amber-800' : 'text-foreground'}>{zone.not_seen_property_count}</strong> non revu{zone.not_seen_property_count > 1 ? 's' : ''}
                      </span>
                      <span><strong className="text-foreground">{zone.last_external_requests}</strong> item{zone.last_external_requests > 1 ? 's' : ''} · {formatEuro(zone.last_estimated_cost_eur)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Dernière sync : {formatLastSync(zone.last_synced_at)}
                      {zone.last_success_sync_at ? ` · Dernier succès : ${formatLastSync(zone.last_success_sync_at)}` : ''}
                      {zone.last_blocked_reason ? ` · ${zone.last_blocked_reason}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/app/properties?zipcode=${encodeURIComponent(zone.zipcode)}`}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title={`Voir les biens du CP ${zone.zipcode}`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => prefillSyncFromZone(zone)}
                    disabled={syncing[zone.zipcode] || syncBlockedByBudget}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                    title={syncBlockedByBudget ? 'Sync Stream Estate bloquée par budget ou désactivée' : `Prévisualiser la sync du CP ${zone.zipcode}`}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing[zone.zipcode] ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => toggleZone(zone)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title={zone.active ? 'Désactiver' : 'Activer'}
                  >
                    {zone.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer ${zone.name} ?\n\nSi aucune autre zone active n'utilise le code postal ${zone.zipcode}, les ${zone.property_count} biens associés seront également supprimés de la base.`)) {
                        deleteZone(zone)
                      }
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Note info */}
      <p className="text-[10px] text-muted-foreground text-center">
        Source : <a href="https://geo.api.gouv.fr" target="_blank" rel="noreferrer" className="underline hover:text-foreground">geo.api.gouv.fr</a> — API officielle des communes françaises (Etalab / DINUM)
      </p>
    </div>
  )
}

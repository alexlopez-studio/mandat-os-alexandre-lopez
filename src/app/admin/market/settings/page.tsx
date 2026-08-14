'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BrainCircuit,
  Calendar,
  Clock3,
  Import,
  Loader2,
  MapPin,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { AiIntegrationsSettings } from './AiIntegrationsSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LiquidTemplateEditor, PageHeader, PageLayout, PageSection } from '@/components/pro'
import { cn } from '@/lib/utils'


import {
  DEFAULT_RDV_TEMPLATES,
  LIQUID_VARIABLES,
  MEETING_TYPES,
  parseRdvTemplates,
  renderLiquidTemplate,
  type RdvTemplatesMap,
} from '@/lib/rdv-templates'


type CommuneResult = {
  nom: string
  code: string
  codesPostaux: string[]
  departement: { code: string; nom: string }
}

type Zone = {
  id: string
  name: string
  zipcode: string
  city: string | null
  insee_code: string | null
  active: boolean
  last_synced_at: string | null
  property_count?: number
  last_sync_status?: string | null
}

type SyncPreview = {
  zipcode: string
  requested_max_items: number
  budget_max_items_per_sync: number
  effective_max_items: number
  max_items: number
  property_types?: number[]
  total_available: number
  provider_total_available?: number
  online_exact?: number
  total_exact?: number
  online_all_time?: number
  estimated_kept?: number
  import_window_days?: number
  estimated_items: number
  estimated_cost_eur: number
  preview_capped?: boolean
  online_only?: boolean
  sync_enabled: boolean
  can_confirm: boolean
  blocked_reason: string | null
  cost_per_item_eur: number
  min_balance_eur: number
  estimated_balance_eur: number
}

type StreamEstateBudget = {
  sync_enabled: boolean
  manual_balance_eur: number
  cost_per_item_eur?: number
  max_items_per_sync?: number
  unlimited_items?: boolean
  cost_per_request_eur: number
  max_requests_per_sync: number
  min_balance_eur: number
  monthly_budget_eur?: number
  estimated_month_remaining_eur?: number
  webhook_event_cost_eur?: number
  resync_window_minutes?: number
  estimated_balance_eur: number
  estimated_spent_total_eur: number
  estimated_spent_today_eur: number
  estimated_spent_month_eur: number
  external_items_today?: number
  external_items_month?: number
  external_requests_today: number
  external_requests_month: number
  webhook_events_today?: number
  webhook_events_month?: number
  last_blocked_reason: string | null
}

type SyncStats = {
  last_sync_at: string | null
  zones: Array<{
    zone_id: string
    property_count: number
    last_sync_status: string | null
  }>
  stream_estate_budget?: StreamEstateBudget
}

type SyncRun = {
  id: string
  status: string
  started_at: string | null
  fetched_count: number | null
  created_count: number | null
  updated_count: number | null
  external_item_count: number | null
  external_request_count: number | null
  estimated_cost_eur: number | null
  blocked_reason: string | null
  error_message: string | null
  monitored_zones: { name: string; zipcode: string; city: string | null } | null
}

type SyncTarget = {
  name: string
  zipcode: string
  inseeCode: string | null
}

type SettingsSection = 'stream_estate' | 'ia' | 'integrations' | 'rdv_templates' | 'profil'

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: any; hint: string }> = [
  { id: 'stream_estate', label: 'Stream Estate', icon: WalletCards, hint: 'Communes, zones & consommation API' },
  { id: 'ia', label: 'Intelligence Artificielle', icon: BrainCircuit, hint: 'Moteurs IA, DeepSeek, OpenAI...' },
  { id: 'integrations', label: 'Intégrations & Connecteurs', icon: ShieldCheck, hint: 'Google, Granola, Telegram' },
  { id: 'rdv_templates', label: 'Modèles de Rendez-vous & SMS', icon: Calendar, hint: 'Messages automatiques & Liquid syntax' },

  { id: 'profil', label: 'Informations personnelles', icon: UserRound, hint: 'Profil & contact' },
]


const PROPERTY_TYPE_OPTIONS = [
  { value: 0, label: 'Appartement' },
  { value: 1, label: 'Maison' },
  { value: 5, label: 'Terrain' },
]

// Codes annonceur Stream Estate : 0 = particulier, 1 = professionnel.
const PUBLISHER_TYPE_OPTIONS = [
  { value: 0, label: 'Particulier (PAP)' },
  { value: 1, label: 'Agence' },
]

const PERSONAL_DEFAULTS = {
  fullName: 'Alexandre Lopez',
  email: 'local-preview@iad.fr',
  phone: '06 13 18 01 68',
  title: 'Conseiller immobilier iad',
}

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Jamais'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h} h`
  return `Il y a ${Math.floor(h / 24)} j`
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  children: React.ReactNode
}) {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-border bg-muted text-muted-foreground',
  }

  return (
    <Badge variant="outline" className={`h-auto rounded-full text-[10px] font-bold ${classes[tone]}`}>
      {children}
    </Badge>
  )
}

function RunStatus({ status }: { status: string }) {
  if (status === 'success') return <StatusBadge tone="success">Succès</StatusBadge>
  if (status === 'blocked') return <StatusBadge tone="warning">Bloquée</StatusBadge>
  if (status === 'error') return <StatusBadge tone="danger">Erreur</StatusBadge>
  return <StatusBadge tone="neutral">En cours</StatusBadge>
}

function zoneStatusLabel(status: string | null | undefined): string {
  if (status === 'success') return 'À jour'
  if (status === 'blocked') return 'Bloquée'
  if (status === 'error') return 'Erreur'
  if (status === 'running') return 'En cours'
  return 'À vérifier'
}

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const [section, setSection] = useState<SettingsSection>('stream_estate')
  const [stats, setStats] = useState<SyncStats | null>(null)
  const [runs, setRuns] = useState<SyncRun[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)

  const [maxItemsPerSync, setMaxItemsPerSync] = useState('30')
  const [unlimitedItems, setUnlimitedItems] = useState(false)

  const [communeQuery, setCommuneQuery] = useState('')
  const [communes, setCommunes] = useState<CommuneResult[]>([])
  const [communeLoading, setCommuneLoading] = useState(false)
  const [selectedCommune, setSelectedCommune] = useState<CommuneResult | null>(null)
  const [selectedZip, setSelectedZip] = useState('')
  const [syncTarget, setSyncTarget] = useState<SyncTarget | null>(null)
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null)
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<number[]>([0, 1, 5])
  const [selectedPublisherTypes, setSelectedPublisherTypes] = useState<number[]>([0])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [zoneDraft, setZoneDraft] = useState({ name: '', zipcode: '', insee_code: '' })
  const [zoneSaving, setZoneSaving] = useState<string | null>(null)
  const [zoneDeleting, setZoneDeleting] = useState<string | null>(null)

  const [personalFullName, setPersonalFullName] = useState(PERSONAL_DEFAULTS.fullName)
  const [personalEmail, setPersonalEmail] = useState(PERSONAL_DEFAULTS.email)
  const [personalPhone, setPersonalPhone] = useState(PERSONAL_DEFAULTS.phone)
  const [personalTitle, setPersonalTitle] = useState(PERSONAL_DEFAULTS.title)
  const [personalSaving, setPersonalSaving] = useState(false)

  const [rdvTemplates, setRdvTemplates] = useState<RdvTemplatesMap>(DEFAULT_RDV_TEMPLATES)
  const [rdvTemplatesSaving, setRdvTemplatesSaving] = useState(false)
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('rendez_vous_r1')



  const budget = stats?.stream_estate_budget
  const budgetBlocked = Boolean(budget && budget.estimated_balance_eur <= budget.min_balance_eur)
  const defaultMaxItems = budget?.max_items_per_sync ?? budget?.max_requests_per_sync ?? 30

  const monthItems = budget?.external_items_month ?? budget?.external_requests_month ?? 0
  const monthCost = budget?.estimated_spent_month_eur ?? 0
  const todayItems = budget?.external_items_today ?? budget?.external_requests_today ?? 0
  const monthWebhookEvents = budget?.webhook_events_month ?? 0
  const costPerItem = budget?.cost_per_item_eur ?? budget?.cost_per_request_eur ?? 0
  const onlineCount = syncPreview?.online_exact ?? syncPreview?.total_available ?? 0
  const totalWithExpired = syncPreview?.total_exact ?? syncPreview?.provider_total_available ?? null
  const estimatedKept = syncPreview?.estimated_kept ?? null
  // Annonces jamais marquées expirées par Stream Estate mais figées depuis
  // longtemps : la fenêtre d'import évite de les payer.
  const ghostCount = Math.max(0, (syncPreview?.online_all_time ?? 0) - onlineCount)

  const load = useCallback(async () => {
    try {
      const [statsRes, runsRes, zonesRes] = await Promise.all([
        fetch('/api/market/sync-stats'),
        fetch('/api/market/sync-runs?limit=8'),
        fetch('/api/market/zones?limit=100&sort=name.asc'),
      ])

      const statsData = await statsRes.json()
      const runsData = await runsRes.json()
      const zonesData = await zonesRes.json()
      const statsMap = new Map<string, SyncStats['zones'][number]>(
        (statsData.zones ?? []).map((zone: SyncStats['zones'][number]) => [zone.zone_id, zone]),
      )

      setStats(statsData)
      setRuns(runsData.runs ?? [])
      setZones((zonesData.zones ?? []).map((zone: Zone) => ({
        ...zone,
        property_count: statsMap.get(zone.id)?.property_count ?? 0,
        last_sync_status: statsMap.get(zone.id)?.last_sync_status ?? null,
      })))
    } catch (err) {
      console.error('Erreur chargement paramètres', err)
      toast.error('Impossible de charger les paramètres')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const req = searchParams.get('section')
    if (req === 'import' || req === 'communes' || req === 'consommation' || req === 'stream_estate') {
      setSection('stream_estate')
    } else if (req === 'ia' || req === 'integrations' || req === 'rdv_templates' || req === 'profil') {
      setSection(req)
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/market/settings')
      .then((res) => res.json())
      .then((data) => {
        const settings = data?.settings ?? {}

        setUnlimitedItems(Boolean(settings.stream_estate_unlimited_items))

        if (settings.stream_estate_max_items_per_sync !== undefined) {
          setMaxItemsPerSync(String(settings.stream_estate_max_items_per_sync))
        } else if (settings.stream_estate_max_requests_per_sync !== undefined) {
          setMaxItemsPerSync(String(settings.stream_estate_max_requests_per_sync))
        }

        setPersonalFullName(String(settings.personal_full_name ?? PERSONAL_DEFAULTS.fullName))
        setPersonalEmail(String(settings.personal_email ?? PERSONAL_DEFAULTS.email))
        setPersonalPhone(String(settings.personal_phone ?? PERSONAL_DEFAULTS.phone))
        setPersonalTitle(String(settings.personal_title ?? PERSONAL_DEFAULTS.title))

        if (settings.rdv_templates) {
          setRdvTemplates(parseRdvTemplates(settings.rdv_templates))
        }
      })
      .catch((err) => {
        console.error('Erreur chargement app_settings:', err)
        toast.error('Impossible de charger les réglages')
      })
  }, [])

  async function saveRdvTemplates() {
    setRdvTemplatesSaving(true)
    try {
      const res = await fetch('/api/market/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rdv_templates: JSON.stringify(rdvTemplates),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.error ?? 'Erreur API')
      toast.success('Modèles de RDV & SMS sauvegardés')
    } catch (err) {
      console.error('Erreur sauvegarde rdv_templates:', err)
      toast.error('Impossible de sauvegarder les modèles de RDV')
    } finally {
      setRdvTemplatesSaving(false)
    }
  }


  function searchCommunes(value: string) {
    setCommuneQuery(value)
    setSelectedCommune(null)
    setSelectedZip('')
    setSyncPreview(null)

    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.trim().length < 2) {
      setCommunes([])
      return
    }

    searchTimer.current = setTimeout(async () => {
      setCommuneLoading(true)
      try {
        const isZip = /^\d{5}$/.test(value.trim())
        const url = isZip
          ? `/api/market/communes?codePostal=${value.trim()}`
          : `/api/market/communes?q=${encodeURIComponent(value.trim())}`
        const res = await fetch(url)
        const data = await res.json()
        setCommunes(data.communes ?? [])
      } catch (err) {
        console.error('Recherche commune impossible:', err)
        setCommunes([])
      } finally {
        setCommuneLoading(false)
      }
    }, 250)
  }

  function pickCommune(commune: CommuneResult) {
    setSelectedCommune(commune)
    setCommuneQuery(commune.nom)
    setCommunes([])
    setSyncPreview(null)

    if (commune.codesPostaux.length === 1) {
      const zip = commune.codesPostaux[0]
      setSelectedZip(zip)
      void attachAndPreview(commune, zip)
    } else {
      setSelectedZip('')
      setSyncTarget(null)
    }
  }

  function chooseZip(commune: CommuneResult, zip: string) {
    setSelectedZip(zip)
    void attachAndPreview(commune, zip)
  }

  async function attachAndPreview(commune: CommuneResult, zip: string) {
    const target: SyncTarget = { name: commune.nom, zipcode: zip, inseeCode: commune.code }
    setSyncTarget(target)
    setSyncPreview(null)
    await previewTarget(target)
  }

  function targetFromZone(zone: Zone): SyncTarget {
    return {
      name: zone.city ?? zone.name,
      zipcode: zone.zipcode,
      inseeCode: zone.insee_code,
    }
  }

  function previewZoneInImport(zone: Zone) {
    const target = targetFromZone(zone)
    setSection('stream_estate')
    setSelectedCommune(null)
    setCommuneQuery(target.name)
    setSelectedZip(target.zipcode)
    void previewTarget(target)
  }

  async function previewTarget(
    target = syncTarget,
    propertyTypes = selectedPropertyTypes,
    publisherTypes = selectedPublisherTypes,
  ) {
    if (!target) {
      toast.error('Rattache une commune avant de prévisualiser')
      return null
    }

    setPreviewLoading(true)
    try {
      const body: Record<string, unknown> = {
        zipcode: target.zipcode,
        insee_code: target.inseeCode,
        property_types: propertyTypes,
        publisher_types: publisherTypes,
      }
      if (!unlimitedItems) {
        body.max_items = Math.max(1, Math.floor(Number(maxItemsPerSync) || defaultMaxItems))
      }

      const res = await fetch('/api/market/sync-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Prévisualisation impossible')

      setSyncTarget(target)
      setSyncPreview(data)
      return data as SyncPreview
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
      setSyncPreview(null)
      return null
    } finally {
      setPreviewLoading(false)
    }
  }

  function togglePropertyType(value: number) {
    const next = selectedPropertyTypes.includes(value)
      ? selectedPropertyTypes.filter((item) => item !== value)
      : [...selectedPropertyTypes, value].sort((a, b) => a - b)

    if (next.length === 0) {
      toast.error('Garde au moins un type de bien')
      return
    }

    setSelectedPropertyTypes(next)
    setSyncPreview(null)
    if (syncTarget) void previewTarget(syncTarget, next)
  }

  function togglePublisherType(value: number) {
    const next = selectedPublisherTypes.includes(value)
      ? selectedPublisherTypes.filter((item) => item !== value)
      : [...selectedPublisherTypes, value].sort((a, b) => a - b)

    if (next.length === 0) {
      toast.error('Garde au moins un type de vendeur')
      return
    }

    setSelectedPublisherTypes(next)
    // Le comptage gratuit est re-lancé : inclure les agences change fortement
    // le volume, donc le coût affiché avant validation.
    setSyncPreview(null)
    if (syncTarget) void previewTarget(syncTarget, selectedPropertyTypes, next)
  }

  async function confirmImport() {
    if (!syncTarget) {
      toast.error('Rattache une commune avant d’importer')
      return
    }

    const preview = syncPreview ?? await previewTarget(syncTarget)
    if (!preview) return
    if (!preview.can_confirm) {
      toast.error('Import bloqué par le budget ou les garde-fous Stream Estate')
      return
    }

    setImporting(true)
    try {
      const body: Record<string, unknown> = {
        zipcode: syncTarget.zipcode,
        insee_code: syncTarget.inseeCode,
        name: syncTarget.name,
        city: syncTarget.name,
        property_types: selectedPropertyTypes,
        publisher_types: selectedPublisherTypes,
      }
      if (!unlimitedItems) {
        body.max_items = Math.max(1, Math.floor(Number(maxItemsPerSync) || defaultMaxItems))
      }

      const res = await fetch('/api/market/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Importation impossible')

      // `skipped` = annonces écartées par les critères de qualité (hors ligne, prix
      // incohérent…), `expired` = biens sortis du marché par la réconciliation.
      const details = [
        `${data.created ?? 0} créé(s)`,
        `${data.updated ?? 0} mis à jour`,
        ...(data.skipped ? [`${data.skipped} écarté(s)`] : []),
        ...(data.expired ? [`${data.expired} retiré(s) du marché`] : []),
      ].join(', ')
      toast.success(`Import terminé : ${details} (${fmtEur(data.estimated_cost_eur ?? 0)})`)
      setCommuneQuery('')
      setSelectedCommune(null)
      setSelectedZip('')
      setSyncTarget(null)
      setSyncPreview(null)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  /**
   * Recalcule les biens déjà importés depuis leur payload stocké : corrige les
   * fiches pointant vers une annonce morte et sort du marché celles qui ne sont
   * plus en ligne. Gratuit — aucun appel facturé à Stream Estate.
   */
  async function repairListings() {
    setRepairing(true)
    try {
      const res = await fetch('/api/market/sync/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Nettoyage impossible')

      toast.success(
        `Nettoyage terminé : ${data.repaired ?? 0} fiche(s) corrigée(s), ` +
        `${data.expired ?? 0} sortie(s) du marché sur ${data.scanned ?? 0} bien(s)`
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setRepairing(false)
    }
  }

  function declineImport() {
    setSyncTarget(null)
    setSyncPreview(null)
    setSelectedCommune(null)
    setSelectedZip('')
    setCommuneQuery('')
    toast.info('Appel payant refusé — aucun bien importé')
  }

  function startZoneEdit(zone: Zone) {
    setEditingZoneId(zone.id)
    setZoneDraft({
      name: zone.name,
      zipcode: zone.zipcode,
      insee_code: zone.insee_code ?? '',
    })
  }

  async function saveZone(id: string) {
    setZoneSaving(id)
    try {
      const res = await fetch(`/api/market/zones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: zoneDraft.name.trim(),
          zipcode: zoneDraft.zipcode.trim(),
          insee_code: zoneDraft.insee_code.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Modification impossible')

      toast.success('Commune mise à jour')
      setEditingZoneId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setZoneSaving(null)
    }
  }

  async function deleteZone(zone: Zone) {
    if (!confirm(`Supprimer la commune "${zone.name}" des zones surveillées ?`)) return
    setZoneDeleting(zone.id)
    try {
      const res = await fetch(`/api/market/zones/${zone.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Suppression impossible')

      toast.success(`Commune "${zone.name}" supprimée`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setZoneDeleting(null)
    }
  }

  async function savePersonalInfo() {
    setPersonalSaving(true)
    try {
      const res = await fetch('/api/market/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personal_full_name: personalFullName.trim(),
          personal_email: personalEmail.trim(),
          personal_phone: personalPhone.trim(),
          personal_title: personalTitle.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Enregistrement profil impossible')

      toast.success('Informations personnelles mises à jour')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setPersonalSaving(false)
    }
  }

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Paramètres"
        title="Réglages Mandat OS"
        description="Gérer le service Stream Estate (communes & consommation API), l'IA, les Intégrations et votre Profil."
      />

      <PageSection>
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Menu latéral */}
          <nav className="flex gap-2 overflow-x-auto pb-1 lg:col-span-3 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
            {SECTIONS.map((item) => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all lg:w-full cursor-pointer shadow-xs",
                    active 
                      ? "border-primary bg-primary/10 text-primary font-bold" 
                      : "border-border/60 bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium"
                  )}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <span className="block whitespace-nowrap text-sm font-bold lg:whitespace-normal">{item.label}</span>
                    <span className="hidden text-xs text-muted-foreground font-medium lg:block mt-0.5">{item.hint}</span>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Contenu de la section active */}
          <div className="min-w-0 space-y-6 lg:col-span-9">
            {section === 'stream_estate' ? (
              <div className="space-y-6">
                {/* 1. Header Card */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">API Stream Estate — Aspiration & Zones</h2>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Gestion des communes surveillées, importation de nouvelles zones et suivi du budget d'aspiration.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-bold rounded-full text-xs px-3 py-1 self-start sm:self-auto">
                      Stream Estate Actif
                    </Badge>
                  </div>
                </div>

                {/* 2. KPI Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Items ce mois</p>
                    <p className="text-2xl font-bold text-foreground">{fmt(monthItems)}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Consommé : <strong className="text-foreground font-bold">{fmtEur(monthCost)}</strong>
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Items aujourd’hui</p>
                    <p className="text-2xl font-bold text-foreground">{fmt(todayItems)}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Dernière sync : <strong className="text-foreground font-bold">{relativeTime(stats?.last_sync_at ?? null)}</strong>
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tarification API</p>
                    <p className="text-2xl font-bold text-foreground">{fmtEur(costPerItem)}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Par bien importé · <strong className="text-foreground font-bold">{fmt(monthWebhookEvents)}</strong> webhooks
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Zones surveillées</p>
                    <p className="text-2xl font-bold text-foreground">{zones.length}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Communes actives : <strong className="text-foreground font-bold">{zones.filter(z => z.active).length}</strong>
                    </p>
                  </div>
                </div>

                {/* 3. Importer une commune Card */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-5">
                  <div className="border-b pb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Import className="size-4 text-primary" />
                        Importer une nouvelle commune
                      </h3>
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold rounded-full text-[10px]">
                        Stream Estate API
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Saisis une commune, consulte gratuitement les annonces en ligne, puis valide l’appel payant pour ajouter la zone.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Recherche Commune */}
                    <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
                      <Label htmlFor="stream-estate-commune" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Nom ou Code Postal de la commune
                      </Label>
                      <div className="relative mt-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="stream-estate-commune"
                          value={communeQuery}
                          placeholder="Saisir une commune, ex : Barjols"
                          className="pl-9 h-10 rounded-xl bg-background"
                          onChange={(event) => searchCommunes(event.target.value)}
                        />
                        {communeLoading ? (
                          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
                        ) : null}
                        {communes.length > 0 ? (
                          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-card shadow-xs">
                            {communes.map((commune) => (
                              <button
                                key={commune.code}
                                type="button"
                                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-xs hover:bg-muted font-medium"
                                onClick={() => pickCommune(commune)}
                              >
                                <span>
                                  <span className="font-bold text-foreground">{commune.nom}</span>
                                  <span className="ml-2 text-muted-foreground">{commune.departement.nom}</span>
                                </span>
                                <span className="shrink-0 text-muted-foreground font-bold">{commune.codesPostaux.join(', ')}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {selectedCommune && selectedCommune.codesPostaux.length > 1 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">Choisir le code postal :</span>
                          {selectedCommune.codesPostaux.map((zipcode) => (
                            <button
                              key={zipcode}
                              type="button"
                              onClick={() => chooseZip(selectedCommune, zipcode)}
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                                selectedZip === zipcode ? "border-primary bg-primary text-white" : "border-border bg-background text-foreground hover:bg-muted"
                              )}
                            >
                              {zipcode}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Types de biens à importer
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PROPERTY_TYPE_OPTIONS.map((option) => {
                          const active = selectedPropertyTypes.includes(option.value)
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => togglePropertyType(option.value)}
                              className={cn(
                                "rounded-full border px-4 py-1.5 text-xs font-bold transition-all",
                                active
                                  ? "border-primary bg-primary text-white shadow-xs"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                              )}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Qui vend
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PUBLISHER_TYPE_OPTIONS.map((option) => {
                          const active = selectedPublisherTypes.includes(option.value)
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => togglePublisherType(option.value)}
                              className={cn(
                                "rounded-full border px-4 py-1.5 text-xs font-bold transition-all",
                                active
                                  ? "border-primary bg-primary text-white shadow-xs"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                              )}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Les biens en agence sont bien plus nombreux : le comptage ci-dessous
                        chiffre l’import avant de payer. Utile pour repérer les mandats qui
                        traînent et les vendeurs prêts à changer d’agence.
                      </p>
                    </div>

                    {/* Commune rattachée */}
                    {syncTarget ? (
                      <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Commune rattachée aux actions</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="text-xl font-bold leading-tight text-foreground">{syncTarget.name}</p>
                          {syncTarget.inseeCode ? (
                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                              Commune exacte (INSEE {syncTarget.inseeCode})
                            </Badge>
                          ) : (
                            <StatusBadge tone="warning">CP seul</StatusBadge>
                          )}
                          <Badge variant="outline" className="rounded-full text-[10px] font-bold">CP {syncTarget.zipcode}</Badge>
                        </div>
                      </div>
                    ) : null}

                    {/* Prévisualisation */}
                    {syncTarget ? (
                      <div className={cn(
                        "rounded-xl border p-4 shadow-xs space-y-3",
                        !syncPreview || syncPreview.can_confirm ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
                      )}>
                        {previewLoading ? (
                          <p className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Comptage des annonces en ligne…
                          </p>
                        ) : syncPreview ? (
                          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div className="space-y-1.5">
                              <p className={cn("text-base font-bold", syncPreview.can_confirm ? 'text-emerald-950' : 'text-amber-950')}>
                                {fmt(onlineCount)} annonce{onlineCount > 1 ? 's' : ''} facturée{onlineCount > 1 ? 's' : ''}
                                {estimatedKept != null ? <> → environ {fmt(estimatedKept)} bien{estimatedKept > 1 ? 's' : ''} retenu{estimatedKept > 1 ? 's' : ''}</> : null}
                              </p>
                              <p className="text-xs text-muted-foreground font-medium">
                                {ghostCount > 0 ? (
                                  <>
                                    <strong>{fmt(ghostCount)}</strong> annonce{ghostCount > 1 ? 's' : ''} plus mise{ghostCount > 1 ? 's' : ''} à jour
                                    depuis {syncPreview.import_window_days} j {ghostCount > 1 ? 'sont écartées' : 'est écartée'} avant facturation.{' '}
                                  </>
                                ) : null}
                                {totalWithExpired != null ? <>Total incl. expirées : <strong>{fmt(totalWithExpired)}</strong>. </> : null}
                              </p>
                              <p className="text-xs font-bold text-foreground pt-1">
                                Appel payant si validation : {fmtEur(syncPreview.estimated_cost_eur)}
                              </p>
                            </div>
                              <div className="flex flex-wrap gap-2 md:justify-end">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => void confirmImport()}
                                  disabled={importing || previewLoading}
                                  className="rounded-full font-bold bg-primary text-white shadow-xs hover:bg-primary/90"
                                >
                                  {importing ? <Loader2 className="animate-spin size-4 mr-1.5" /> : <Import className="size-4 mr-1.5" />}
                                  Valider l’appel payant
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={declineImport}
                                  disabled={importing || previewLoading}
                                  className="rounded-full font-semibold"
                                >
                                  <X className="size-4 mr-1" />
                                  Refuser
                                </Button>
                              </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 4. Communes surveillées Card */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
                  <div className="border-b pb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        Communes surveillées ({zones.length})
                      </h3>
                      <p className="text-xs text-muted-foreground font-medium">
                        Les communes sont modifiables et supprimables. « Preview » ouvre l’écran d’import sur la commune choisie.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void repairListings()}
                      disabled={repairing}
                      className="h-8 rounded-full text-xs font-semibold shrink-0"
                    >
                      {repairing ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
                      Nettoyer les biens importés
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {loading ? (
                      <div className="h-24 animate-pulse rounded-xl bg-muted" />
                    ) : zones.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground font-medium">
                        Aucune commune surveillée pour le moment.
                      </div>
                    ) : (
                      zones.map((zone) => (
                        <div
                          key={zone.id}
                          className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          {editingZoneId === zone.id ? (
                            <>
                              <div className="grid flex-1 gap-2 md:grid-cols-3">
                                <Input value={zoneDraft.name} onChange={(event) => setZoneDraft((current) => ({ ...current, name: event.target.value }))} className="h-9 rounded-xl text-xs" />
                                <Input value={zoneDraft.zipcode} onChange={(event) => setZoneDraft((current) => ({ ...current, zipcode: event.target.value }))} className="h-9 rounded-xl text-xs" />
                                <Input value={zoneDraft.insee_code} onChange={(event) => setZoneDraft((current) => ({ ...current, insee_code: event.target.value }))} placeholder="INSEE optionnel" className="h-9 rounded-xl text-xs" />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => void saveZone(zone.id)} disabled={zoneSaving === zone.id} className="rounded-full text-xs font-bold">
                                  {zoneSaving === zone.id ? <Loader2 className="animate-spin size-3" /> : <Save className="size-3" />}
                                  Enregistrer
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingZoneId(null)} className="rounded-full text-xs font-semibold">Annuler</Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="size-10 shrink-0 flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                                  <MapPin className="size-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-bold text-foreground text-sm">{zone.name}</p>
                                    <Badge variant="outline" className="rounded-full text-[10px] font-bold">CP {zone.zipcode}</Badge>
                                    {zone.insee_code ? (
                                      <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                        INSEE {zone.insee_code}
                                      </Badge>
                                    ) : (
                                      <StatusBadge tone="warning">CP seul</StatusBadge>
                                    )}
                                    {!zone.active ? <StatusBadge tone="neutral">Inactive</StatusBadge> : null}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground font-medium">Dernière sync : {relativeTime(zone.last_synced_at)}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 justify-between md:justify-end">
                                <div className="text-right text-xs">
                                  <span className="block font-bold text-foreground">{zone.property_count ?? 0} biens</span>
                                  <StatusBadge tone={zone.last_sync_status === 'error' ? 'danger' : zone.last_sync_status === 'blocked' ? 'warning' : 'success'}>
                                    {zoneStatusLabel(zone.last_sync_status)}
                                  </StatusBadge>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button type="button" variant="outline" size="sm" onClick={() => previewZoneInImport(zone)} className="h-8 rounded-full text-xs font-semibold">
                                    <Search className="size-3 mr-1" /> Preview
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => startZoneEdit(zone)} className="h-8 rounded-full text-xs font-semibold">
                                    <Pencil className="size-3 mr-1" /> Modifier
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => void deleteZone(zone)} disabled={zoneDeleting === zone.id} className="h-8 rounded-full text-xs text-destructive hover:text-destructive">
                                    {zoneDeleting === zone.id ? <Loader2 className="animate-spin size-3" /> : <Trash2 className="size-3" />}
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 5. Synchronizations History Table */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
                  <div className="border-b pb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Clock3 className="size-4 text-primary" />
                      Historique des synchronisations Stream Estate
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground font-bold">
                          <th className="px-3 py-2.5 text-left">Zone</th>
                          <th className="px-3 py-2.5 text-left">Date</th>
                          <th className="px-3 py-2.5 text-right">Biens</th>
                          <th className="px-3 py-2.5 text-right">Items API</th>
                          <th className="px-3 py-2.5 text-right">Coût</th>
                          <th className="px-3 py-2.5 text-left">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground font-medium">Aucun historique de synchronisation.</td>
                          </tr>
                        ) : runs.map((run) => (
                          <tr key={run.id} className="border-b last:border-b-0 font-medium">
                            <td className="px-3 py-2.5 font-bold text-foreground">{run.monitored_zones?.name ?? '—'} <span className="text-muted-foreground font-normal">{run.monitored_zones?.zipcode}</span></td>
                            <td className="px-3 py-2.5 text-muted-foreground">{run.started_at ? new Date(run.started_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                            <td className="px-3 py-2.5 text-right font-bold">{run.fetched_count ?? 0}</td>
                            <td className="px-3 py-2.5 text-right">{run.external_item_count ?? run.external_request_count ?? 0}</td>
                            <td className="px-3 py-2.5 text-right font-bold">{fmtEur(Number(run.estimated_cost_eur ?? 0))}</td>
                            <td className="px-3 py-2.5"><RunStatus status={run.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {section === 'ia' ? <AiIntegrationsSettings mode="ia" /> : null}

            {section === 'integrations' ? <AiIntegrationsSettings mode="integrations" /> : null}

            {section === 'rdv_templates' ? (
              <div className="space-y-6">
                {/* Header Card */}
                <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">Modèles de Rendez-vous & Textes SMS (Liquid)</h2>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Configurez les intitulés par défaut et les textes de rappel SMS envoyés aux clients selon le type de rendez-vous.
                      </p>
                    </div>
                    <Button
                      onClick={saveRdvTemplates}
                      disabled={rdvTemplatesSaving}
                      className="rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-5 shadow-2xs cursor-pointer shrink-0"
                    >
                      {rdvTemplatesSaving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
                      Enregistrer les modèles
                    </Button>
                  </div>

                  {/* Liquid Cheat Sheet */}
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Variables Liquid disponibles dans vos SMS :
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {LIQUID_VARIABLES.map((v) => (
                        <div key={v.tag} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
                          <code className="font-mono font-bold text-primary">{v.tag}</code>
                          <span className="text-muted-foreground">• {v.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dropdown Selector for Rendez-vous Type */}
                <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Type de Rendez-vous à configurer
                    </Label>
                    <p className="text-xs text-muted-foreground font-medium">
                      Sélectionnez la catégorie ci-contre pour afficher et éditer son modèle.
                    </p>
                  </div>
                  <Select value={selectedTemplateType} onValueChange={setSelectedTemplateType}>
                    <SelectTrigger className="h-10 w-full sm:w-80 rounded-xl bg-background border-input font-bold text-xs cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map((t) => {
                        const Icon = t.icon
                        return (
                          <SelectItem key={t.value} value={t.value} className="text-xs font-semibold cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Icon className="size-4 text-primary shrink-0" />
                              <span>{t.label}</span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Selected Template Card */}
                {(() => {
                  const type = MEETING_TYPES.find((t) => t.value === selectedTemplateType) || MEETING_TYPES[0]
                  const Icon = type.icon
                  const currentTpl = rdvTemplates[type.value] ?? DEFAULT_RDV_TEMPLATES[type.value] ?? { title: type.label, sms_template: '' }
                  const samplePreview = renderLiquidTemplate(currentTpl.sms_template, {
                    client: { first_name: 'Jean', last_name: 'Dupont' },
                    rdv: { date: '15 mars 2026', time: '14h30', type: type.label },
                    property: { address: '12 rue des Vignes' },
                    agent: { name: personalFullName || 'Alexandre Lopez' },
                  })

                  return (
                    <div key={type.value} className="rounded-2xl border bg-card p-6 shadow-xs space-y-5">
                      <div className="flex items-center gap-3 border-b pb-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                          <Icon className="size-5" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">{type.label}</h3>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Intitulé par défaut du Rendez-vous
                          </Label>
                          <Input
                            value={currentTpl.title}
                            onChange={(e) => {
                              const newTitle = e.target.value
                              setRdvTemplates((prev) => ({
                                ...prev,
                                [type.value]: { ...currentTpl, title: newTitle },
                              }))
                            }}
                            className="h-10 rounded-xl bg-background text-xs font-semibold"
                          />
                        </div>

                        <LiquidTemplateEditor
                          label="Texte du SMS de rappel (Liquid)"
                          value={currentTpl.sms_template}
                          onChange={(newSms) => {
                            setRdvTemplates((prev) => ({
                              ...prev,
                              [type.value]: { ...currentTpl, sms_template: newSms },
                            }))
                          }}
                          rows={5}
                          clientData={{
                            first_name: 'Jean',
                            last_name: 'Dupont',
                            date: '15 mars 2026',
                            time: '14h30',
                            type: type.label,
                            address: '12 rue des Vignes',
                            agent_name: personalFullName || 'Alexandre Lopez',
                          }}
                        />

                        {/* Dual SMS Reminders Settings */}
                        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                          <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Automatisation des envois SMS (2 envois prévus)
                          </span>

                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* Rappel / Confirmation 1 */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-foreground">
                                SMS 1 : Envoi de confirmation
                              </Label>
                              <select
                                value={currentTpl.sms_reminder_1_trigger || 'immediate'}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setRdvTemplates((prev) => ({
                                    ...prev,
                                    [type.value]: { ...currentTpl, sms_reminder_1_trigger: val },
                                  }))
                                }}
                                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold cursor-pointer"
                              >
                                <option value="immediate">Immédiat (Dès la validation du rendez-vous dans l'app)</option>
                                <option value="24h">24 heures avant le rendez-vous</option>
                                <option value="48h">48 heures avant le rendez-vous</option>
                              </select>
                            </div>

                            {/* Rappel 2 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentTpl.sms_reminder_2_enabled ?? true}
                                    onChange={(e) => {
                                      const checked = e.target.checked
                                      setRdvTemplates((prev) => ({
                                        ...prev,
                                        [type.value]: { ...currentTpl, sms_reminder_2_enabled: checked },
                                      }))
                                    }}
                                    className="rounded size-3.5 border-input accent-primary cursor-pointer"
                                  />
                                  <span>SMS 2 : Rappel automatique</span>
                                </Label>
                              </div>
                              <select
                                disabled={!currentTpl.sms_reminder_2_enabled}
                                value={currentTpl.sms_reminder_2_trigger || 'eve_18h'}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setRdvTemplates((prev) => ({
                                    ...prev,
                                    [type.value]: { ...currentTpl, sms_reminder_2_trigger: val },
                                  }))
                                }}
                                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
                              >
                                <option value="eve_18h">La veille du rendez-vous à 18h00 (Recommandé)</option>
                                <option value="2h">2 heures avant le rendez-vous</option>
                                <option value="4h">4 heures avant le rendez-vous</option>
                                <option value="24h">24 heures avant le rendez-vous</option>
                              </select>
                            </div>

                          </div>
                        </div>

                      </div>
                    </div>
                  )
                })()}


              </div>
            ) : null}



            {section === 'profil' ? (
              <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
                <div className="border-b pb-4 space-y-1">
                  <h2 className="text-base font-bold text-foreground">Informations personnelles</h2>
                  <p className="text-xs text-muted-foreground font-medium">
                    Ces informations serviront aux prochains écrans de profil, signatures et points de contact.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom complet</Label>
                    <Input value={personalFullName} onChange={(event) => setPersonalFullName(event.target.value)} className="h-10 rounded-xl bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fonction</Label>
                    <Input value={personalTitle} onChange={(event) => setPersonalTitle(event.target.value)} className="h-10 rounded-xl bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input type="email" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} className="h-10 rounded-xl bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</Label>
                    <Input value={personalPhone} onChange={(event) => setPersonalPhone(event.target.value)} className="h-10 rounded-xl bg-background" />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t">
                  <Button onClick={savePersonalInfo} disabled={personalSaving} className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold px-5">
                    {personalSaving ? <Loader2 className="animate-spin size-4 mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                    Enregistrer le profil
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PageSection>
    </PageLayout>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground font-medium">Chargement des paramètres...</div>}>
      <SettingsPageContent />
    </Suspense>
  )
}

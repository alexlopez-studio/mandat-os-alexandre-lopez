'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    ArrowLeft,
    BadgeEuro,
    Building2,
    Calendar,
    CheckCircle2,
    ExternalLink,
    FileText,
    Home,
    Loader2,
    Mail,
    MapPin,
    Phone,
    RefreshCw,
    Save,
    Send,
    Sparkles,
    UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Prospect {
    id: string
    email: string | null
    first_name: string
    last_name: string
    phone: string | null
    created_at: string
}

interface LeadEvent {
    id: string
    kind: string
    payload: Record<string, unknown>
    created_by: string | null
    created_at: string
}

interface SellerProperty {
    id: string
    adresse: string | null
    type_bien: string | null
    surface: number | null
    surface_terrain: number | null
    nb_pieces: number | null
    delai: string | null
    prix_estime: number | null
}

interface LinkedOpportunity {
    id: string
    title: string
    stage: string | null
    priority: string | null
}

interface LeadDetail {
    id: string
    prospect_id: string
    tool: string
    status: string
    source_channel: string | null
    priority: string
    next_action: string | null
    due_date: string | null
    follow_up_at: string | null
    form_data: Record<string, unknown>
    results: Record<string, unknown>
    commune: string | null
    magic_link_sent_at: string | null
    magic_link_expires_at: string
    created_at: string
    updated_at: string
    prospect: Prospect
    events: LeadEvent[]
    seller_property: SellerProperty | null
    opportunity: LinkedOpportunity | null
}

interface ComparableProperty {
    id: string
    title: string | null
    city: string | null
    zipcode: string | null
    property_type: string | null
    price: number | null
    surface: number | null
    land_surface: number | null
    rooms: number | null
    price_per_m2: number | null
    status: string | null
    url: string | null
    first_seen_at: string | null
    seller_type: string | null
}

interface CrmDraft {
    first_name: string
    last_name: string
    email: string
    phone: string
    source_channel: string
    priority: string
    commune: string
    adresse: string
    type_bien: string
    surface: string
    surface_terrain: string
    nb_pieces: string
    prix_estime: string
    delai: string
    next_action: string
    due_date: string
    follow_up_at: string
}

const STATUS_LABELS: Record<string, string> = {
    nouveau: 'Nouveau',
    contacte: 'Contacté',
    r1: 'R1',
    mandat: 'Mandat',
    sous_compromis: 'Sous compromis',
    vendu: 'Vendu',
    perdu: 'Perdu',
}

const STATUS_COLORS: Record<string, string> = {
    nouveau: 'bg-blue-100 text-blue-800 border-blue-200',
    contacte: 'bg-amber-100 text-amber-800 border-amber-200',
    r1: 'bg-purple-100 text-purple-800 border-purple-200',
    mandat: 'bg-green-100 text-green-800 border-green-200',
    sous_compromis: 'bg-teal-100 text-teal-800 border-teal-200',
    vendu: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    perdu: 'bg-gray-100 text-gray-600 border-gray-200',
}

const PRIORITY_LABELS: Record<string, string> = {
    low: 'Basse',
    medium: 'Moyenne',
    high: 'Haute',
    critical: 'Urgente',
}

const PRIORITY_CLASSES: Record<string, string> = {
    low: 'bg-gray-50 text-gray-600 border-gray-200',
    medium: 'bg-blue-50 text-blue-700 border-blue-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
}

const SOURCE_LABELS: Record<string, string> = {
    flyer: 'Flyer',
    porte_a_porte: 'Porte-à-porte',
    appel_entrant: 'Appel entrant',
    prospection: 'Prospection',
    recommandation: 'Recommandation',
    estimation_site: 'Estimation site',
    annonce_particulier: 'Annonce particulier',
    annonce_agence: 'Annonce agence',
    autre: 'Autre',
}

const PROPERTY_TYPES = [
    { value: 'maison', label: 'Maison' },
    { value: 'appartement', label: 'Appartement' },
    { value: 'terrain', label: 'Terrain' },
    { value: 'immeuble', label: 'Immeuble' },
    { value: 'autre', label: 'Autre' },
]

const EVENT_KIND_LABELS: Record<string, string> = {
    status_change: 'Changement de statut',
    note: 'Note ajoutée',
    magic_link_resent: 'Lien renvoyé',
    rgpd_delete: 'Suppression RGPD',
    system: 'Système',
}

function formatShortDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
    })
}

function formatPrice(value: number | null | undefined): string {
    if (value == null) return '—'
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(value)
}

function formatNumber(value: number | null | undefined, suffix = ''): string {
    if (value == null) return '—'
    return `${new Intl.NumberFormat('fr-FR').format(value)}${suffix}`
}

function textValue(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function numberDraft(value: number | null | undefined): string {
    return value == null ? '' : String(value)
}

function getContactName(lead: LeadDetail): string {
    return [lead.prospect.first_name, lead.prospect.last_name].filter(Boolean).join(' ').trim() || 'Contact vendeur'
}

function draftFromLead(lead: LeadDetail): CrmDraft {
    const seller = lead.seller_property
    return {
        first_name: lead.prospect.first_name ?? '',
        last_name: lead.prospect.last_name ?? '',
        email: lead.prospect.email ?? '',
        phone: lead.prospect.phone ?? '',
        source_channel: lead.source_channel ?? 'prospection',
        priority: lead.priority ?? 'medium',
        commune: lead.commune ?? '',
        adresse: seller?.adresse ?? '',
        type_bien: seller?.type_bien ?? 'maison',
        surface: numberDraft(seller?.surface),
        surface_terrain: numberDraft(seller?.surface_terrain),
        nb_pieces: numberDraft(seller?.nb_pieces),
        prix_estime: numberDraft(seller?.prix_estime),
        delai: seller?.delai ?? '',
        next_action: lead.next_action ?? '',
        due_date: lead.due_date ?? '',
        follow_up_at: lead.follow_up_at ?? '',
    }
}

export default function LeadDetailPage() {
    const params = useParams()
    const id = params.id as string

    const [lead, setLead] = useState<LeadDetail | null>(null)
    const [draft, setDraft] = useState<CrmDraft | null>(null)
    const [comparables, setComparables] = useState<ComparableProperty[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [changingStatus, setChangingStatus] = useState(false)
    const [noteText, setNoteText] = useState('')
    const [sendingNote, setSendingNote] = useState(false)
    const [resending, setResending] = useState(false)
    const [creatingOpportunity, setCreatingOpportunity] = useState(false)

    const fetchLead = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/leads/' + id)
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
            setLead(json.data)
            setDraft(draftFromLead(json.data))
        } catch (err) {
            console.error('[LeadDetailPage] fetch error:', err)
            toast.error('Impossible de charger le contact')
        } finally {
            setLoading(false)
        }
    }, [id])

    const fetchComparables = useCallback(async () => {
        try {
            const res = await fetch('/api/leads/' + id + '/comparables')
            const json = await res.json()
            if (json.success) setComparables(json.data ?? [])
        } catch (err) {
            console.error('[LeadDetailPage] comparables error:', err)
        }
    }, [id])

    useEffect(() => {
        fetchLead()
        fetchComparables()
    }, [fetchLead, fetchComparables])

    const sortedEvents = useMemo(
        () => [...(lead?.events ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        [lead?.events],
    )

    async function saveCrm() {
        if (!draft) return
        setSaving(true)
        try {
            const res = await fetch('/api/leads/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: draft.first_name,
                    last_name: draft.last_name,
                    email: draft.email || null,
                    phone: draft.phone || null,
                    source_channel: draft.source_channel,
                    priority: draft.priority,
                    commune: draft.commune || null,
                    adresse: draft.adresse || null,
                    type_bien: draft.type_bien || null,
                    surface: draft.surface || null,
                    surface_terrain: draft.surface_terrain || null,
                    nb_pieces: draft.nb_pieces || null,
                    prix_estime: draft.prix_estime || null,
                    delai: draft.delai || null,
                    next_action: draft.next_action || null,
                    due_date: draft.due_date || null,
                    follow_up_at: draft.follow_up_at || null,
                    created_by: 'admin',
                }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
            setLead(json.data)
            setDraft(draftFromLead(json.data))
            await fetchComparables()
            toast.success('Fiche contact mise à jour')
        } catch (err) {
            console.error('[LeadDetailPage] save error:', err)
            toast.error('Impossible de mettre à jour la fiche')
        } finally {
            setSaving(false)
        }
    }

    async function changeStatus(newStatus: string) {
        setChangingStatus(true)
        try {
            const res = await fetch('/api/leads/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, created_by: 'admin' }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
            await fetchLead()
            toast.success('Statut mis à jour')
        } catch (err) {
            console.error('[LeadDetailPage] changeStatus error:', err)
            toast.error('Impossible de changer le statut')
        } finally {
            setChangingStatus(false)
        }
    }

    async function addNote() {
        if (!noteText.trim()) return
        setSendingNote(true)
        try {
            const res = await fetch('/api/leads/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: noteText.trim(), created_by: 'admin' }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
            setNoteText('')
            setLead(json.data)
            toast.success('Note ajoutée')
        } catch (err) {
            console.error('[LeadDetailPage] addNote error:', err)
            toast.error('Impossible d’ajouter la note')
        } finally {
            setSendingNote(false)
        }
    }

    async function resendMagicLink() {
        if (!lead?.prospect.email) return
        setResending(true)
        try {
            const res = await fetch('/api/leads/' + id + '/resend', { method: 'POST' })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
            await fetchLead()
            toast.success('Lien renvoyé')
        } catch (err) {
            console.error('[LeadDetailPage] resend error:', err)
            toast.error('Impossible de renvoyer le lien')
        } finally {
            setResending(false)
        }
    }

    async function createOpportunity() {
        setCreatingOpportunity(true)
        try {
            const res = await fetch('/api/leads/' + id + '/opportunity', { method: 'POST' })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
            setLead((current) => current ? { ...current, opportunity: json.data } : current)
            toast.success(json.existing ? 'Opportunité déjà existante' : 'Opportunité créée')
        } catch (err) {
            console.error('[LeadDetailPage] opportunity error:', err)
            toast.error('Impossible de créer l’opportunité')
        } finally {
            setCreatingOpportunity(false)
        }
    }

    if (loading) {
        return <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">Chargement...</div>
    }

    if (!lead || !draft) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
                <p className="text-muted-foreground">Contact introuvable</p>
                <Link href="/app/leads" className="text-sm text-primary underline">Retour à la liste</Link>
            </div>
        )
    }

    const contactName = getContactName(lead)
    const sourceLabel = SOURCE_LABELS[lead.source_channel ?? ''] ?? 'Source à qualifier'
    const priorityLabel = PRIORITY_LABELS[lead.priority] ?? lead.priority

    return (
        <div className="space-y-6">
            <Link href="/app/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="size-4" /> Retour aux contacts
            </Link>

            <div className="rounded-xl border bg-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-bold text-foreground">{contactName}</h1>
                            <span className={'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ' + (STATUS_COLORS[lead.status] ?? STATUS_COLORS.nouveau)}>
                                {STATUS_LABELS[lead.status] ?? lead.status}
                            </span>
                            <span className={'inline-flex rounded-full border px-3 py-1 text-xs font-semibold ' + (PRIORITY_CLASSES[lead.priority] ?? PRIORITY_CLASSES.medium)}>
                                {priorityLabel}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                            {lead.prospect.phone && <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {lead.prospect.phone}</span>}
                            {lead.prospect.email && <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" /> {lead.prospect.email}</span>}
                            {lead.commune && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {lead.commune}</span>}
                            <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> Créé le {formatShortDate(lead.created_at)}</span>
                            <Badge variant="outline">{sourceLabel}</Badge>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lead.opportunity ? (
                            <Button variant="outline" asChild>
                                <Link href="/app/opportunities"><ExternalLink className="mr-1 size-4" /> Voir l’opportunité</Link>
                            </Button>
                        ) : (
                            <Button onClick={createOpportunity} disabled={creatingOpportunity}>
                                {creatingOpportunity ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Sparkles className="mr-1 size-4" />}
                                Créer une opportunité
                            </Button>
                        )}
                        {lead.status !== 'contacte' && (
                            <Button variant="outline" onClick={() => changeStatus('contacte')} disabled={changingStatus}>
                                <CheckCircle2 className="mr-1 size-4" /> Contacté
                            </Button>
                        )}
                        {lead.prospect.email && (
                            <Button variant="outline" onClick={resendMagicLink} disabled={resending}>
                                {resending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Send className="mr-1 size-4" />}
                                Renvoyer le lien
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                <div className="space-y-6">
                    <div className="rounded-xl border bg-card p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <UserRound className="size-4" /> Contact et qualification
                            </h2>
                            <Button size="sm" onClick={saveCrm} disabled={saving}>
                                {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                                Enregistrer
                            </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Prénom</span>
                                <Input value={draft.first_name} onChange={(e) => setDraft((d) => d && { ...d, first_name: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Nom</span>
                                <Input value={draft.last_name} onChange={(e) => setDraft((d) => d && { ...d, last_name: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Téléphone</span>
                                <Input value={draft.phone} onChange={(e) => setDraft((d) => d && { ...d, phone: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Email</span>
                                <Input type="email" value={draft.email} onChange={(e) => setDraft((d) => d && { ...d, email: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Source</span>
                                <select value={draft.source_channel} onChange={(e) => setDraft((d) => d && { ...d, source_channel: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Priorité</span>
                                <select value={draft.priority} onChange={(e) => setDraft((d) => d && { ...d, priority: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Home className="size-4" /> Bien vendeur potentiel
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-4">
                            <label className="space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium text-muted-foreground">Commune</span>
                                <Input value={draft.commune} onChange={(e) => setDraft((d) => d && { ...d, commune: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Type</span>
                                <select value={draft.type_bien} onChange={(e) => setDraft((d) => d && { ...d, type_bien: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Timing</span>
                                <Input value={draft.delai} onChange={(e) => setDraft((d) => d && { ...d, delai: e.target.value })} />
                            </label>
                            <label className="space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium text-muted-foreground">Adresse / secteur</span>
                                <Input value={draft.adresse} onChange={(e) => setDraft((d) => d && { ...d, adresse: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Surface</span>
                                <Input type="number" min="0" value={draft.surface} onChange={(e) => setDraft((d) => d && { ...d, surface: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Terrain</span>
                                <Input type="number" min="0" value={draft.surface_terrain} onChange={(e) => setDraft((d) => d && { ...d, surface_terrain: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Pièces</span>
                                <Input type="number" min="0" value={draft.nb_pieces} onChange={(e) => setDraft((d) => d && { ...d, nb_pieces: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Prix pressenti</span>
                                <Input type="number" min="0" value={draft.prix_estime} onChange={(e) => setDraft((d) => d && { ...d, prix_estime: e.target.value })} />
                            </label>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Calendar className="size-4" /> Prochaines actions
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-4">
                            <label className="space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium text-muted-foreground">Action</span>
                                <Input value={draft.next_action} onChange={(e) => setDraft((d) => d && { ...d, next_action: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Échéance</span>
                                <Input type="date" value={draft.due_date} onChange={(e) => setDraft((d) => d && { ...d, due_date: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Relance</span>
                                <Input type="date" value={draft.follow_up_at} onChange={(e) => setDraft((d) => d && { ...d, follow_up_at: e.target.value })} />
                            </label>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Building2 className="size-4" /> Marché comparable
                        </h2>
                        {comparables.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucune annonce comparable en base pour cette commune.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="py-2 pr-3 text-left font-medium">Bien</th>
                                            <th className="py-2 pr-3 text-right font-medium">Prix</th>
                                            <th className="py-2 pr-3 text-right font-medium">Surface</th>
                                            <th className="py-2 pr-3 text-right font-medium">Prix/m²</th>
                                            <th className="py-2 text-right font-medium">Fiche</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparables.map((property) => (
                                            <tr key={property.id} className="border-b last:border-0">
                                                <td className="max-w-[260px] py-3 pr-3">
                                                    <div className="line-clamp-1 font-medium">{property.title ?? property.property_type ?? 'Annonce marché'}</div>
                                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                        <span>{property.city}{property.zipcode ? ` ${property.zipcode}` : ''}</span>
                                                        {property.status && <Badge variant="outline" className="text-[10px]">{property.status}</Badge>}
                                                        {property.seller_type && <span>{property.seller_type}</span>}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap py-3 pr-3 text-right font-medium">{formatPrice(property.price)}</td>
                                                <td className="whitespace-nowrap py-3 pr-3 text-right text-muted-foreground">{formatNumber(property.surface, ' m²')}</td>
                                                <td className="whitespace-nowrap py-3 pr-3 text-right text-muted-foreground">{formatNumber(property.price_per_m2, ' €/m²')}</td>
                                                <td className="py-3 text-right">
                                                    <Link href={'/app/properties/' + property.id} className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-accent">
                                                        Ouvrir
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <aside className="space-y-6">
                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <RefreshCw className="size-4" /> Statut contact
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => changeStatus(key)}
                                    disabled={changingStatus || key === lead.status}
                                    className={
                                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                                        (key === lead.status
                                            ? 'border-primary bg-primary text-white'
                                            : 'border-border text-muted-foreground hover:border-primary hover:text-primary')
                                    }
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <FileText className="size-4" /> Note
                        </h2>
                        <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={4}
                            placeholder="Compte-rendu d’appel, objection, contexte terrain..."
                        />
                        <Button size="sm" className="mt-3 w-full" onClick={addNote} disabled={sendingNote || !noteText.trim()}>
                            {sendingNote ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                            Ajouter la note
                        </Button>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <BadgeEuro className="size-4" /> Résultats estimation
                        </h2>
                        {Object.keys(lead.results ?? {}).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucun résultat calculé pour ce contact.</p>
                        ) : (
                            <div className="grid gap-2">
                                {Object.entries(lead.results).slice(0, 8).map(([key, value]) => {
                                    const display = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
                                    if (!display) return null
                                    return (
                                        <div key={key} className="rounded-lg bg-muted/30 px-3 py-2">
                                            <div className="text-[10px] font-semibold uppercase text-muted-foreground">{key.replace(/_/g, ' ')}</div>
                                            <div className="mt-0.5 truncate text-sm font-medium">{display}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-3 text-sm font-semibold text-foreground">Lien résultat</h2>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            {lead.prospect.email ? (
                                <p>
                                    {lead.magic_link_sent_at
                                        ? `Envoyé le ${formatShortDate(lead.magic_link_sent_at)}`
                                        : 'Pas encore envoyé'}
                                </p>
                            ) : (
                                <p>Aucun email renseigné pour ce contact.</p>
                            )}
                            <a href={'/resultats/' + lead.id} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                                /resultats/{lead.id.slice(0, 8)}... <ExternalLink className="size-3" />
                            </a>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <RefreshCw className="size-4" /> Historique ({sortedEvents.length})
                        </h2>
                        {sortedEvents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
                        ) : (
                            <div className="space-y-3">
                                {sortedEvents.map((event) => {
                                    const text = textValue(event.payload?.text)
                                    const status = textValue(event.payload?.status)
                                    return (
                                        <div key={event.id} className="rounded-lg border bg-muted/20 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-foreground">{EVENT_KIND_LABELS[event.kind] ?? event.kind}</span>
                                                <span className="shrink-0 text-xs text-muted-foreground">{formatShortDate(event.created_at)}</span>
                                            </div>
                                            {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
                                            {status && (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    Nouveau statut : <span className="font-medium text-foreground">{STATUS_LABELS[status] ?? status}</span>
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    )
}

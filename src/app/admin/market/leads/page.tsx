'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EyeIcon, Search, ChevronLeft, ChevronRight, RefreshCw, Plus, Loader2, Phone, MapPin, Send } from 'lucide-react'
import { toast } from 'sonner'
import { LeadStatsCards } from '@/components/admin/LeadStatsCards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AcheteursListClient } from '../acheteurs/AcheteursListClient'

interface Prospect {
    id: string
    email: string | null
    first_name: string
    last_name: string
    phone: string | null
}

interface SellerProperty {
    adresse: string | null
    type_bien: string | null
    surface: number | null
    surface_terrain: number | null
    nb_pieces: number | null
    delai: string | null
    prix_estime: number | null
}

interface LeadRow {
    id: string
    tool: string
    status: string
    source_channel: string | null
    priority: string
    next_action: string | null
    due_date: string | null
    follow_up_at: string | null
    commune: string | null
    magic_link_sent_at: string | null
    created_at: string
    updated_at: string
    prospect: Prospect
    seller_property: SellerProperty | null
    opportunity: { id: string; title: string; stage: string | null; priority: string | null } | null
}

interface Pagination {
    page: number
    pageSize: number
    total: number
    totalPages: number
}

interface CreateDraft {
    contactType: 'seller' | 'buyer'
    sellerName: string
    phone: string
    email: string
    sourceChannel: string
    priority: string
    commune: string
    adresse: string
    typeBien: string
    surface: string
    surfaceTerrain: string
    nbPieces: string
    delai: string
    prixEstime: string
    nextAction: string
    dueDate: string
    followUpAt: string
    note: string
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
    perdu: 'bg-gray-100 text-gray-500 border-gray-200',
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

function emptyDraft(contactType: 'seller' | 'buyer' = 'seller'): CreateDraft {
    return {
        contactType,
        sellerName: '',
        phone: '',
        email: '',
        sourceChannel: 'prospection',
        priority: 'medium',
        commune: '',
        adresse: '',
        typeBien: 'maison',
        surface: '',
        surfaceTerrain: '',
        nbPieces: '',
        delai: '',
        prixEstime: '',
        nextAction: 'Qualifier le projet vendeur',
        dueDate: '',
        followUpAt: '',
        note: '',
    }
}

function formatShortDate(value: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatPrice(value: number | null) {
    if (value == null) return null
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

export default function LeadsListPage() {
    const router = useRouter()
    const [leads, setLeads] = useState<LeadRow[]>([])
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
    })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [sourceFilter, setSourceFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [communeFilter, setCommuneFilter] = useState('')
    const [toolFilter, setToolFilter] = useState('vendre')
    const [contactTab, setContactTab] = useState<'seller' | 'buyer'>('seller')
    const [createOpen, setCreateOpen] = useState(false)
    const [draft, setDraft] = useState<CreateDraft>(emptyDraft())
    const [creating, setCreating] = useState(false)
    const [invitingId, setInvitingId] = useState<string | null>(null)

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('page', String(pagination.page))
            params.set('page_size', '20')
            if (statusFilter) params.set('status', statusFilter)
            if (toolFilter) params.set('tool', toolFilter)
            if (sourceFilter) params.set('source', sourceFilter)
            if (priorityFilter) params.set('priority', priorityFilter)
            if (communeFilter.trim()) params.set('commune', communeFilter.trim())
            if (search.trim()) params.set('q', search.trim())

            const res = await fetch('/api/leads/list?' + params.toString())
            const json = await res.json()
            if (json.success) {
                setLeads(json.data)
                setPagination(json.pagination)
            }
        } catch (err) {
            console.error('[LeadsListPage] fetch error:', err)
            toast.error('Impossible de charger les contacts')
        } finally {
            setLoading(false)
        }
    }, [pagination.page, statusFilter, toolFilter, sourceFilter, priorityFilter, communeFilter, search])

    useEffect(() => {
        const timer = setTimeout(() => fetchLeads(), 300)
        return () => clearTimeout(timer)
    }, [fetchLeads])

    function goToPage(page: number) {
        setPagination((p) => ({ ...p, page }))
    }

    function openCreate() {
        setDraft(emptyDraft(contactTab))
        setCreateOpen(true)
    }

    async function submitCreate() {
        if (!draft.sellerName.trim() && !draft.phone.trim() && !draft.email.trim()) {
            toast.error('Ajoute au moins un nom, un téléphone ou un email')
            return
        }
        setCreating(true)
        try {
            if (draft.contactType === 'buyer') {
                const res = await fetch('/api/market/buyers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name: draft.sellerName,
                        email: draft.email || null,
                        phone: draft.phone || null,
                        type_bien: draft.typeBien || null,
                        communes: draft.commune ? draft.commune.split(',').map((value) => value.trim()).filter(Boolean) : null,
                        budget_max: draft.prixEstime ? Number(draft.prixEstime) : null,
                        surface_min: draft.surface ? Number(draft.surface) : null,
                        pieces_min: draft.nbPieces ? Number(draft.nbPieces) : null,
                        criteres: draft.note ? draft.note.split(',').map((value) => value.trim()).filter(Boolean) : null,
                        active: true,
                        stage: 'Nouveau contact',
                        next_action: draft.nextAction || 'Qualifier la recherche acquéreur',
                        due_date: draft.dueDate || null,
                    }),
                })
                const json = await res.json()
                if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
                toast.success('Contact acquéreur créé')
                setCreateOpen(false)
                router.push(`/app/acheteurs/${json.buyer.lead_id}`)
                return
            }

            const res = await fetch('/api/leads/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seller_name: draft.sellerName,
                    phone: draft.phone,
                    email: draft.email,
                    source_channel: draft.sourceChannel,
                    priority: draft.priority,
                    commune: draft.commune,
                    adresse: draft.adresse,
                    type_bien: draft.typeBien,
                    surface: draft.surface,
                    surface_terrain: draft.surfaceTerrain,
                    nb_pieces: draft.nbPieces,
                    delai: draft.delai,
                    prix_estime: draft.prixEstime,
                    next_action: draft.nextAction,
                    due_date: draft.dueDate || null,
                    follow_up_at: draft.followUpAt || null,
                    note: draft.note,
                }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')
            toast.success('Contact vendeur créé')
            setCreateOpen(false)
            router.push(json.data.opportunity?.id
                ? `/app/opportunities/${json.data.opportunity.id}`
                : `/app/leads/${json.data.lead.id}`)
        } catch (err) {
            console.error('[LeadsListPage] create error:', err)
            toast.error('Impossible de créer le contact')
        } finally {
            setCreating(false)
        }
    }

    async function inviteClient(lead: LeadRow) {
        if (lead.opportunity?.stage !== 'Mandat signé') {
            toast.error('Espace client disponible après mandat signé')
            return
        }
        if (!lead.prospect.email) {
            toast.error('Ajoute un email au contact avant invitation')
            return
        }

        setInvitingId(lead.id)
        try {
            const res = await fetch('/api/client/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_id: lead.id }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Erreur API')

            if (json.data?.action_link) {
                await navigator.clipboard?.writeText(json.data.action_link)
                toast.success('Espace client préparé, lien copié')
            } else {
                toast.success('Invitation espace client envoyée')
            }
            if (json.data?.dossier_id) router.push(`/app/clients/${json.data.dossier_id}`)
        } catch (err) {
            console.error('[LeadsListPage] invite client error:', err)
            toast.error(err instanceof Error ? err.message : 'Impossible d’inviter le client')
        } finally {
            setInvitingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Contacts vendeurs, estimations site et projets à qualifier
                    </p>
                </div>
                <Button onClick={openCreate} className="w-full sm:w-auto">
                    <Plus className="mr-2 size-4" /> Ajouter un contact
                </Button>
            </div>

            <Tabs value={contactTab} onValueChange={(value) => {
                const next = value === 'buyer' ? 'buyer' : 'seller'
                setContactTab(next)
                setToolFilter(next === 'seller' ? 'vendre' : 'acheter')
                setPagination((p) => ({ ...p, page: 1 }))
            }}>
                <TabsList>
                    <TabsTrigger value="seller">Vendeurs</TabsTrigger>
                    <TabsTrigger value="buyer">Acquéreurs</TabsTrigger>
                </TabsList>

                <TabsContent value="seller" className="space-y-6">
            <LeadStatsCards />

            <div className="flex flex-col gap-4 px-4 lg:px-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[220px] max-w-sm flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher nom, téléphone, email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Input
                        value={communeFilter}
                        onChange={(e) => setCommuneFilter(e.target.value)}
                        placeholder="Commune"
                        className="w-36"
                    />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                        <option value="">Tous statuts</option>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                        <option value="">Toutes sources</option>
                        {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                        <option value="">Toutes priorités</option>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                        <option value="vendre">Vendeurs</option>
                        <option value="">Tous types</option>
                        <option value="acheter">Acheteurs</option>
                        <option value="audit">Audit</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => fetchLeads()}>
                        <RefreshCw className="mr-1 size-4" /> Actualiser
                    </Button>
                </div>
            </div>

            <div className="px-4 lg:px-6">
                <div className="rounded-xl border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Projet vendeur</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Relance</th>
                                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Chargement...</td>
                                    </tr>
                                ) : leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Aucun contact vendeur trouvé</td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => {
                                        const contactName = [lead.prospect.first_name, lead.prospect.last_name].filter(Boolean).join(' ').trim() || 'Contact sans nom'
                                        const seller = lead.seller_property
                                        const price = formatPrice(seller?.prix_estime ?? null)
                                        return (
                                            <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-foreground">{contactName}</div>
                                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                        {lead.prospect.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{lead.prospect.phone}</span>}
                                                        {lead.prospect.email && <span>{lead.prospect.email}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant="outline" className="w-fit">{SOURCE_LABELS[lead.source_channel ?? ''] ?? '—'}</Badge>
                                                        <span className={'inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + (PRIORITY_CLASSES[lead.priority] ?? PRIORITY_CLASSES.medium)}>
                                                            {PRIORITY_LABELS[lead.priority] ?? lead.priority}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{seller?.type_bien ?? 'Bien à qualifier'}</div>
                                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                        {lead.commune && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{lead.commune}</span>}
                                                        {seller?.surface != null && <span>{seller.surface} m²</span>}
                                                        {price && <span>{price}</span>}
                                                        {lead.opportunity && <span className="text-primary">Opportunité créée</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ' + (STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-700')}>
                                                        {STATUS_LABELS[lead.status] ?? lead.status}
                                                    </span>
                                                </td>
                                                <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                                                    <span className="line-clamp-2">{lead.next_action ?? '—'}</span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                                                    {formatShortDate(lead.due_date ?? lead.follow_up_at)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        {lead.prospect.email && lead.opportunity?.stage === 'Mandat signé' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => inviteClient(lead)}
                                                                disabled={invitingId === lead.id}
                                                                className="inline-flex items-center gap-1 rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                {invitingId === lead.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                                                                Espace
                                                            </button>
                                                        ) : lead.prospect.email ? (
                                                            <span className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                                                Après mandat signé
                                                            </span>
                                                        ) : null}
                                                        <Link href={'/app/leads/' + lead.id} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                                                            <EyeIcon className="size-3.5" /> Ouvrir
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <div className="text-xs text-muted-foreground">
                                {pagination.total} résultat{pagination.total > 1 ? 's' : ''} — Page {pagination.page} / {pagination.totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)}>
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
                </TabsContent>

                <TabsContent value="buyer">
                    <AcheteursListClient />
                </TabsContent>
            </Tabs>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Ajouter un contact</DialogTitle>
                        <DialogDescription>Choisis vendeur ou acquéreur. Le contact alimentera le bon parcours Affaires.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">Type de contact</span>
                            <select
                                value={draft.contactType}
                                onChange={(e) => setDraft(emptyDraft(e.target.value === 'buyer' ? 'buyer' : 'seller'))}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="seller">Vendeur</option>
                                <option value="buyer">Acquéreur</option>
                            </select>
                        </label>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium">{draft.contactType === 'buyer' ? 'Acquéreur' : 'Vendeur'}</span>
                                <Input value={draft.sellerName} onChange={(e) => setDraft((d) => ({ ...d, sellerName: e.target.value }))} placeholder="Nom du contact" />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Source</span>
                                <select value={draft.sourceChannel} onChange={(e) => setDraft((d) => ({ ...d, sourceChannel: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Téléphone</span>
                                <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="06..." />
                            </label>
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium">Email</span>
                                <Input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} placeholder="optionnel" />
                            </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-4">
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium">{draft.contactType === 'buyer' ? 'Communes recherchées' : 'Commune'}</span>
                                <Input value={draft.commune} onChange={(e) => setDraft((d) => ({ ...d, commune: e.target.value }))} placeholder={draft.contactType === 'buyer' ? 'Barjols, Cotignac' : 'Barjols'} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Type</span>
                                <select value={draft.typeBien} onChange={(e) => setDraft((d) => ({ ...d, typeBien: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                </select>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Priorité</span>
                                <select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium">Adresse / secteur</span>
                                <Input value={draft.adresse} onChange={(e) => setDraft((d) => ({ ...d, adresse: e.target.value }))} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">{draft.contactType === 'buyer' ? 'Surface min.' : 'Surface'}</span>
                                <Input type="number" min="0" value={draft.surface} onChange={(e) => setDraft((d) => ({ ...d, surface: e.target.value }))} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Terrain</span>
                                <Input type="number" min="0" value={draft.surfaceTerrain} onChange={(e) => setDraft((d) => ({ ...d, surfaceTerrain: e.target.value }))} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Pièces</span>
                                <Input type="number" min="0" value={draft.nbPieces} onChange={(e) => setDraft((d) => ({ ...d, nbPieces: e.target.value }))} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">{draft.contactType === 'buyer' ? 'Budget max' : 'Prix estimé'}</span>
                                <Input type="number" min="0" value={draft.prixEstime} onChange={(e) => setDraft((d) => ({ ...d, prixEstime: e.target.value }))} />
                            </label>
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium">Timing</span>
                                <Input value={draft.delai} onChange={(e) => setDraft((d) => ({ ...d, delai: e.target.value }))} placeholder="3 mois, moyen terme..." />
                            </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-4">
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium">Prochaine action</span>
                                <Input value={draft.nextAction} onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Échéance</span>
                                <Input type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">Relance</span>
                                <Input type="date" value={draft.followUpAt} onChange={(e) => setDraft((d) => ({ ...d, followUpAt: e.target.value }))} />
                            </label>
                        </div>

                        <label className="block space-y-1">
                            <span className="text-xs font-medium">{draft.contactType === 'buyer' ? 'Critères additionnels' : 'Note'}</span>
                            <Textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} rows={3} placeholder={draft.contactType === 'buyer' ? 'jardin, plain-pied, garage...' : 'Contexte de prospection, objection, urgence...'} />
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</Button>
                        <Button onClick={submitCreate} disabled={creating}>
                            {creating ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Plus className="mr-1 size-4" />}
                            Créer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

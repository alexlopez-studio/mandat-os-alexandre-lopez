'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Flame, Plus, Upload, Search, Pencil, Trash2, X, Phone, Mail,
  CalendarClock, AlertTriangle, Users, MessageSquare, CheckCircle2,
  PhoneCall, Send, Handshake, StickyNote, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────
type WarmStatus = 'a_contacter' | 'contacte' | 'relance' | 'termine'

type Contact = {
  id: string
  full_name: string
  relation: string | null
  phone: string | null
  email: string | null
  status: WarmStatus
  referrals: string[]
  follow_up_date: string | null
  notes: string | null
  source: string
  last_contacted_at: string | null
  created_at: string
}

type EventType = 'call' | 'email' | 'message' | 'meeting' | 'note' | 'status_change' | 'referral' | 'import'
type ContactEvent = {
  id: string
  contact_id: string
  type: EventType
  content: string | null
  occurred_at: string
}

// ── Métadonnées statut ───────────────────────────────────────
const STATUS_META: Record<WarmStatus, { label: string; cls: string }> = {
  a_contacter: { label: 'À contacter', cls: 'bg-muted text-muted-foreground' },
  contacte: { label: 'Contacté', cls: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300' },
  relance: { label: 'Relance', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300' },
  termine: { label: 'Converti', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300' },
}
const STATUS_ORDER: WarmStatus[] = ['a_contacter', 'contacte', 'relance', 'termine']

const ACTIVITY_META: Record<Exclude<EventType, 'status_change' | 'import' | 'referral'>, { label: string; icon: typeof PhoneCall }> = {
  call: { label: 'Appel', icon: PhoneCall },
  email: { label: 'Email', icon: Send },
  message: { label: 'Message', icon: MessageSquare },
  meeting: { label: 'Rendez-vous', icon: Handshake },
  note: { label: 'Note', icon: StickyNote },
}

const EVENT_ICON: Record<EventType, typeof PhoneCall> = {
  call: PhoneCall, email: Send, message: MessageSquare, meeting: Handshake,
  note: StickyNote, status_change: CheckCircle2, referral: Users, import: Upload,
}

// ── Helpers date ─────────────────────────────────────────────
function dateClass(d: string | null): 'overdue' | 'today' | 'future' | 'empty' {
  if (!d) return 'empty'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dd = new Date(d); dd.setHours(0, 0, 0, 0)
  if (dd < today) return 'overdue'
  if (dd.getTime() === today.getTime()) return 'today'
  return 'future'
}
function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const EMPTY_FORM = {
  full_name: '', relation: '', phone: '', email: '',
  status: 'a_contacter' as WarmStatus, follow_up_date: '', notes: '',
}

export function WarmListClient() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | WarmStatus>('all')
  const [search, setSearch] = useState('')

  // Modal ajout/édition
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [referrals, setReferrals] = useState<string[]>([])
  const [referralInput, setReferralInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Sheet détail / timeline
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [events, setEvents] = useState<ContactEvent[]>([])
  const [activityType, setActivityType] = useState<EventType>('call')
  const [activityContent, setActivityContent] = useState('')

  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Chargement ─────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/market/warm-contacts')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setContacts((json.contacts as Contact[]).map((c) => ({ ...c, referrals: c.referrals ?? [] })))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadContacts() }, [loadContacts])

  // ── Stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = contacts.length
    const contactes = contacts.filter((c) => c.status !== 'a_contacter').length
    const recos = contacts.reduce((s, c) => s + (c.referrals?.length ?? 0), 0)
    const termines = contacts.filter((c) => c.status === 'termine').length
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const overdue = contacts.filter((c) => {
      if (!c.follow_up_date || c.status === 'termine') return false
      const d = new Date(c.follow_up_date); d.setHours(0, 0, 0, 0)
      return d <= today
    }).length
    return { total, contactes, recos, termines, overdue }
  }, [contacts])

  // ── Filtrage ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return contacts
      .filter((c) => filter === 'all' || c.status === filter)
      .filter((c) => {
        if (!q) return true
        return (
          c.full_name.toLowerCase().includes(q) ||
          (c.relation ?? '').toLowerCase().includes(q) ||
          (c.notes ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q) ||
          (c.referrals ?? []).join(' ').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        if (!a.follow_up_date && !b.follow_up_date) return a.full_name.localeCompare(b.full_name)
        if (!a.follow_up_date) return 1
        if (!b.follow_up_date) return -1
        return new Date(a.follow_up_date).getTime() - new Date(b.follow_up_date).getTime()
      })
  }, [contacts, filter, search])

  // ── Modal ──────────────────────────────────────────────────
  function openModal(c?: Contact) {
    if (c) {
      setEditingId(c.id)
      setForm({
        full_name: c.full_name, relation: c.relation ?? '', phone: c.phone ?? '',
        email: c.email ?? '', status: c.status, follow_up_date: c.follow_up_date ?? '',
        notes: c.notes ?? '',
      })
      setReferrals([...(c.referrals ?? [])])
    } else {
      setEditingId(null)
      setForm({ ...EMPTY_FORM })
      setReferrals([])
    }
    setReferralInput('')
    setModalOpen(true)
  }

  function addReferral() {
    const v = referralInput.trim()
    if (v && !referrals.includes(v)) setReferrals((r) => [...r, v])
    setReferralInput('')
  }

  async function saveContact() {
    if (!form.full_name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    setSaving(true)
    const pending = referralInput.trim()
    const finalReferrals = pending && !referrals.includes(pending) ? [...referrals, pending] : referrals
    const payload = {
      full_name: form.full_name.trim(),
      relation: form.relation.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: form.status,
      follow_up_date: form.follow_up_date || null,
      notes: form.notes.trim(),
      referrals: finalReferrals,
    }
    try {
      const url = editingId ? `/api/market/warm-contacts/${editingId}` : '/api/market/warm-contacts'
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      toast.success(editingId ? 'Contact mis à jour' : 'Contact ajouté')
      setModalOpen(false)
      await loadContacts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function deleteContact(id: string) {
    if (!confirm('Supprimer ce contact et son historique ?')) return
    try {
      const res = await fetch(`/api/market/warm-contacts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur suppression')
      toast.success('Contact supprimé')
      if (sheetId === id) setSheetId(null)
      await loadContacts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  // ── Import ─────────────────────────────────────────────────
  function triggerImport() { fileRef.current?.click() }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const content = await file.text()
      const res = await fetch('/api/market/warm-contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import échoué')
      toast.success(
        `${json.imported} contact${json.imported > 1 ? 's' : ''} importé${json.imported > 1 ? 's' : ''}` +
        (json.skipped ? ` · ${json.skipped} ignoré${json.skipped > 1 ? 's' : ''} (doublons)` : ''),
      )
      await loadContacts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur import')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Timeline ───────────────────────────────────────────────
  const loadEvents = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/market/warm-contacts/${id}/events`)
      const json = await res.json()
      if (res.ok) setEvents(json.events as ContactEvent[])
    } catch { /* silencieux */ }
  }, [])

  function openSheet(id: string) {
    setSheetId(id)
    setActivityType('call')
    setActivityContent('')
    setEvents([])
    loadEvents(id)
  }

  async function addActivity() {
    if (!sheetId) return
    if (activityType === 'note' && !activityContent.trim()) {
      toast.error('Écrivez une note')
      return
    }
    try {
      const res = await fetch(`/api/market/warm-contacts/${sheetId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activityType, content: activityContent.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setActivityContent('')
      toast.success('Activité enregistrée')
      await loadEvents(sheetId)
      await loadContacts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function quickStatus(id: string, status: WarmStatus) {
    try {
      const res = await fetch(`/api/market/warm-contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Erreur')
      await loadContacts()
      if (sheetId === id) await loadEvents(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const sheetContact = contacts.find((c) => c.id === sheetId) ?? null

  // ── Rendu ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white">
          <Flame className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Réseau</h1>
          <p className="text-xs text-muted-foreground">Cercle proche, partenaires, prescripteurs et contacts relationnels</p>
        </div>
        {stats.overdue > 0 && (
          <Badge className="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {stats.overdue} relance{stats.overdue > 1 ? 's' : ''} à faire
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total contacts" value={stats.total} className="text-orange-500" icon={Users} />
        <StatCard label="Contactés" value={stats.contactes} className="text-blue-500" icon={MessageSquare} />
        <StatCard label="Recommandations" value={stats.recos} className="text-violet-500" icon={Handshake} />
        <StatCard label="Convertis" value={stats.termines} className="text-emerald-500" icon={CheckCircle2} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Tous</FilterBtn>
        {STATUS_ORDER.map((s) => (
          <FilterBtn key={s} active={filter === s} onClick={() => setFilter(s)}>
            {STATUS_META[s].label}
          </FilterBtn>
        ))}
        <div className="relative ml-auto flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".vcf,.csv,text/vcard,text/csv"
          className="hidden"
          onChange={onFileSelected}
        />
        <Button variant="outline" size="sm" onClick={triggerImport} disabled={importing}>
          {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          Importer
        </Button>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => openModal()}>
          <Plus className="mr-1.5 h-4 w-4" /> Ajouter
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Recommandations</TableHead>
              <TableHead>Relance</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <Flame className="mx-auto mb-2 h-8 w-8 text-orange-300" />
                  {contacts.length === 0
                    ? 'Aucun contact. Ajoutez votre première personne ou importez un fichier.'
                    : 'Aucun résultat pour ce filtre.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const dc = dateClass(c.follow_up_date)
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openSheet(c.id)}>
                    <TableCell>
                      <div className="font-medium">{c.full_name}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {c.relation && <span>{c.relation}</span>}
                        {c.phone && <span className="inline-flex items-center gap-0.5"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.email && <span className="inline-flex items-center gap-0.5"><Mail className="h-3 w-3" />{c.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_META[c.status].cls}>{STATUS_META[c.status].label}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.referrals?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {c.referrals.map((r, i) => (
                            <span key={i} className="rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-600 dark:bg-violet-950 dark:text-violet-300">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs whitespace-nowrap',
                        dc === 'overdue' && 'font-semibold text-red-500',
                        dc === 'today' && 'font-semibold text-orange-500',
                        dc === 'future' && 'text-muted-foreground',
                        dc === 'empty' && 'text-muted-foreground/60',
                      )}>
                        {dc !== 'empty' && <CalendarClock className="h-3 w-3" />}
                        {dc === 'today' ? "Aujourd'hui" : fmtDate(c.follow_up_date)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="line-clamp-2 text-xs text-muted-foreground">{c.notes || '—'}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openModal(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteContact(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal ajout/édition */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le contact' : 'Nouveau contact'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Nom complet *">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jean Dupont" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06 12 34 56 78" />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@email.fr" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Relation / Lien">
                <Input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Ami, voisin, famille..." />
              </Field>
              <Field label="Statut">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as WarmStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Recommandations reçues">
              <Input
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReferral() } }}
                placeholder="Nom d'un contact recommandé, puis Entrée"
              />
              {referrals.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {referrals.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-600 dark:bg-violet-950 dark:text-violet-300">
                      {r}
                      <button type="button" onClick={() => setReferrals(referrals.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Date de relance">
              <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Résumé de l'échange, infos utiles..." />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={saveContact} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet détail + timeline */}
      <Sheet open={!!sheetId} onOpenChange={(o) => !o && setSheetId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          {sheetContact && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {sheetContact.full_name}
                  <Badge className={STATUS_META[sheetContact.status].cls}>{STATUS_META[sheetContact.status].label}</Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-4 px-4 pb-6">
                {/* Coordonnées */}
                <div className="flex flex-col gap-1 text-sm">
                  {sheetContact.relation && <div className="text-muted-foreground">{sheetContact.relation}</div>}
                  {sheetContact.phone && <a href={`tel:${sheetContact.phone}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="h-3.5 w-3.5" />{sheetContact.phone}</a>}
                  {sheetContact.email && <a href={`mailto:${sheetContact.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="h-3.5 w-3.5" />{sheetContact.email}</a>}
                  {sheetContact.last_contacted_at && (
                    <div className="text-xs text-muted-foreground">Dernier contact : {fmtDateTime(sheetContact.last_contacted_at)}</div>
                  )}
                </div>

                {/* Statut rapide */}
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        onClick={() => quickStatus(sheetContact.id, s)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition',
                          sheetContact.status === s ? STATUS_META[s].cls + ' border-transparent' : 'text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {sheetContact.notes && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap text-sm">{sheetContact.notes}</p>
                  </div>
                )}

                {/* Ajout d'activité */}
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Enregistrer une activité</p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(Object.keys(ACTIVITY_META) as (keyof typeof ACTIVITY_META)[]).map((t) => {
                      const Icon = ACTIVITY_META[t].icon
                      return (
                        <button
                          key={t}
                          onClick={() => setActivityType(t)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition',
                            activityType === t ? 'border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300' : 'hover:bg-muted',
                          )}
                        >
                          <Icon className="h-3 w-3" />{ACTIVITY_META[t].label}
                        </button>
                      )
                    })}
                  </div>
                  <Textarea
                    value={activityContent}
                    onChange={(e) => setActivityContent(e.target.value)}
                    placeholder={activityType === 'note' ? 'Votre note...' : 'Détails (optionnel)...'}
                    className="mb-2 min-h-14"
                  />
                  <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600" onClick={addActivity}>
                    Ajouter à l'historique
                  </Button>
                </div>

                {/* Timeline */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Historique</p>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune activité pour l'instant.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {events.map((ev) => {
                        const Icon = EVENT_ICON[ev.type] ?? StickyNote
                        return (
                          <li key={ev.id} className="flex gap-2.5">
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">{fmtDateTime(ev.occurred_at)}</div>
                              {ev.content && <div className="text-sm">{ev.content}</div>}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Sous-composants ──────────────────────────────────────────
function StatCard({ label, value, className, icon: Icon }: { label: string; value: number; className?: string; icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn('h-4 w-4', className)} />
      </div>
      <div className={cn('mt-1 text-2xl font-bold', className)}>{value}</div>
    </div>
  )
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active ? 'border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

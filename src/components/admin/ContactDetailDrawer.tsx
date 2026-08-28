'use client'

import { useState } from 'react'
import {
  Ban,
  Check,
  Flame,
  Pencil,
  Play,
  Plus,
  User,
  UserCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { StatusPill } from '@/components/pro'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  CONTACT_TYPES,
  CONTACT_TYPE_META,
  normalizeContactTypes,
  type ContactType,
} from '@/lib/contact-types'
import {
  formatFrenchDate,
  generateSalutation,
  parseContactMeta,
  serializeContactMeta,
  type ContactProfileMeta,
} from '@/lib/contact-profile'
import { cn } from '@/lib/utils'

export interface ContactData {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  relation: string | null
  source: string | null
  types: string[] | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
  last_contact?: string | null
  next_action?: string | null
}

interface ContactDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: ContactData | null
  onContactUpdated?: (updatedContact: ContactData) => void
}

export function ContactDetailDrawer({
  open,
  onOpenChange,
  contact,
  onContactUpdated,
}: ContactDetailDrawerProps) {
  if (!contact) return null

  const meta: ContactProfileMeta = parseContactMeta(contact.relation)

  // Modals state
  const [coordDialogOpen, setCoordDialogOpen] = useState(false)
  const [automationDialogOpen, setAutomationDialogOpen] = useState<
    'birth' | 'transaction' | 'review' | 'recommendation' | null
  >(null)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Coordonnées edit form
  const [coordForm, setCoordForm] = useState({
    civilite: meta.civilite || '',
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    salutation: meta.salutation || generateSalutation(contact.first_name, meta.civilite),
    email: contact.email || '',
    phone: contact.phone || '',
    address: meta.address || '',
  })

  // Automations edit state
  const [automationValue, setAutomationValue] = useState('')

  // Types / Profil edit state
  const [selectedTypes, setSelectedTypes] = useState<ContactType[]>(
    normalizeContactTypes(contact.types)
  )

  const initials = `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase() || '?'
  const primaryType: ContactType = (contact.types?.[0] as ContactType) || 'vendeur'
  const isFutureSeller = Boolean(meta.is_future_seller)
  const doNotContact = Boolean(meta.do_not_contact)
  const wishesEnabled = meta.wishes_enabled ?? true

  async function updateContactData(
    updatedFields: Partial<ContactData>,
    updatedMeta: ContactProfileMeta
  ) {
    setSaving(true)
    try {
      const payload = {
        ...updatedFields,
        relation: serializeContactMeta(updatedMeta),
      }

      const res = await fetch(`/api/market/contacts/${contact!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Erreur mise à jour')

      const updated: ContactData = {
        ...contact!,
        ...updatedFields,
        relation: serializeContactMeta(updatedMeta),
      }

      toast.success('Informations enregistrées')
      onContactUpdated?.(updated)
    } catch (err) {
      console.error(err)
      toast.error('Impossible de sauvegarder les modifications')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleFutureSeller = async () => {
    const nextMeta: ContactProfileMeta = {
      ...meta,
      is_future_seller: !isFutureSeller,
    }
    await updateContactData({}, nextMeta)
  }

  const handleToggleDoNotContact = async () => {
    const nextMeta: ContactProfileMeta = {
      ...meta,
      do_not_contact: !doNotContact,
    }
    await updateContactData({}, nextMeta)
  }

  const handleToggleWishes = async () => {
    const nextMeta: ContactProfileMeta = {
      ...meta,
      wishes_enabled: !wishesEnabled,
    }
    await updateContactData({}, nextMeta)
  }

  const handleSaveCoordonnees = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextMeta: ContactProfileMeta = {
      ...meta,
      civilite: (coordForm.civilite as 'M.' | 'Mme' | '') || null,
      salutation: coordForm.salutation || null,
      address: coordForm.address || null,
    }
    await updateContactData(
      {
        first_name: coordForm.first_name,
        last_name: coordForm.last_name,
        email: coordForm.email || null,
        phone: coordForm.phone || null,
      },
      nextMeta
    )
    setCoordDialogOpen(false)
  }

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault()
    let nextMeta: ContactProfileMeta = { ...meta }
    if (automationDialogOpen === 'birth') {
      nextMeta.birth_date = automationValue || null
    } else if (automationDialogOpen === 'transaction') {
      nextMeta.transaction_date = automationValue || null
    } else if (automationDialogOpen === 'review') {
      nextMeta.review_request = automationValue || null
    } else if (automationDialogOpen === 'recommendation') {
      nextMeta.recommendation_request = automationValue || null
    }
    await updateContactData({}, nextMeta)
    setAutomationDialogOpen(null)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateContactData({ types: selectedTypes }, meta)
    setProfileDialogOpen(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full overflow-y-auto p-6 bg-background text-foreground"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-base shrink-0">
                {initials}
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold leading-tight text-foreground">
                  {contact.first_name || ''} {(contact.last_name || '').toUpperCase()}
                </h2>
                <div className="flex items-center gap-2">
                  <Select
                    value={primaryType}
                    onValueChange={(val) => {
                      const nextTypes = [val, ...(contact.types?.filter((t) => t !== val) || [])]
                      void updateContactData({ types: nextTypes }, meta)
                    }}
                  >
                    <SelectTrigger className="h-6 rounded-md bg-muted/60 px-2 text-xs font-semibold text-foreground border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONTACT_TYPE_META[t]?.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <StatusPill tone={doNotContact ? 'danger' : 'success'}>
                    {doNotContact ? 'Ne pas contacter' : 'Actif'}
                  </StatusPill>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Quick Action Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFutureSeller}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors shadow-xs',
                isFutureSeller
                  ? 'bg-amber-600 text-primary-foreground hover:bg-amber-700'
                  : 'bg-amber-600/90 text-primary-foreground hover:bg-amber-700'
              )}
            >
              <Flame className="size-4 fill-current" />
              {isFutureSeller ? 'Futur vendeur (Actif)' : 'Marquer futur vendeur'}
            </button>

            <button
              type="button"
              onClick={handleToggleDoNotContact}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                doNotContact
                  ? 'border-destructive bg-destructive/10 text-destructive'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <Ban className="size-4" />
              {doNotContact ? 'Bloqué (Ne pas contacter)' : 'Ne pas contacter'}
            </button>
          </div>

          {/* Top 2 Metric Cards */}
          <div className="mt-6 grid grid-cols-2 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="space-y-0 pr-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Dernier contact
              </p>
              <p className="text-sm font-bold text-foreground">
                {contact.last_contact || 'Jamais'}
              </p>
            </div>
            <div className="space-y-0 pl-4 border-l border-border">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Prochaine action
              </p>
              <p className="text-sm font-bold text-foreground">
                {contact.next_action || 'Aucune'}
              </p>
            </div>
          </div>

          {/* Section COORDONNÉES */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Coordonnées
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCoordForm({
                    civilite: meta.civilite || '',
                    first_name: contact.first_name || '',
                    last_name: contact.last_name || '',
                    salutation: meta.salutation || generateSalutation(contact.first_name, meta.civilite),
                    email: contact.email || '',
                    phone: contact.phone || '',
                    address: meta.address || '',
                  })
                  setCoordDialogOpen(true)
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Modifier
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 shadow-sm text-sm">
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Civilité</p>
                <p className="font-semibold text-foreground">{meta.civilite || '—'}</p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Dans les messages</p>
                <p className="font-semibold text-foreground">
                  {meta.salutation || generateSalutation(contact.first_name, meta.civilite)}
                </p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Prénom</p>
                <p className="font-semibold text-foreground">{contact.first_name || '—'}</p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Nom</p>
                <p className="font-semibold text-foreground">
                  {(contact.last_name || '').toUpperCase() || '—'}
                </p>
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Email</p>
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="font-semibold text-primary hover:underline line-clamp-1"
                  >
                    {contact.email}
                  </a>
                ) : (
                  <p className="font-semibold text-muted-foreground">—</p>
                )}
              </div>
              <div className="space-y-0">
                <p className="text-xs text-muted-foreground">Téléphone</p>
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  <p className="font-semibold text-muted-foreground">—</p>
                )}
              </div>
              <div className="col-span-2 space-y-0 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">Adresse de domicile</p>
                <p className="font-semibold text-foreground">{meta.address || '—'}</p>
              </div>
            </div>
          </div>

          {/* Section AUTOMATISATIONS ACTIVES */}
          <div className="mt-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Automatisations actives
            </h3>

            <div className="space-y-4">
              {/* 1. Anniversaire client */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Anniversaire">
                    🎂
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Anniversaire client</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.birth_date
                        ? formatFrenchDate(meta.birth_date)
                        : 'Date de naissance non renseignée'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAutomationValue(meta.birth_date || '')
                    setAutomationDialogOpen('birth')
                  }}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5"
                >
                  {meta.birth_date ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {meta.birth_date ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>

              {/* 2. Vœux de fin d'année */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Vœux">
                    🎉
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Vœux de fin d'année</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Envoyés entre le 28 et le 31 décembre
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleWishes}
                  className={cn(
                    'size-8 rounded-full flex items-center justify-center transition-colors',
                    wishesEnabled
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                  title={wishesEnabled ? 'Désactiver les vœux' : 'Activer les vœux'}
                >
                  <Play className="size-4 fill-current ml-0.5" />
                </button>
              </div>

              {/* 3. Date de transaction */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Transaction">
                    🏠
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Date de transaction</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.transaction_date
                        ? formatFrenchDate(meta.transaction_date)
                        : 'Aucune transaction'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAutomationValue(meta.transaction_date || '')
                    setAutomationDialogOpen('transaction')
                  }}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5"
                >
                  {meta.transaction_date ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {meta.transaction_date ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>

              {/* 4. Demande d'avis */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Avis">
                    ⭐
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Demande d'avis</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.review_request || 'Aucune demande programmée'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAutomationValue(meta.review_request || '')
                    setAutomationDialogOpen('review')
                  }}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5"
                >
                  {meta.review_request ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {meta.review_request ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>

              {/* 5. Recommandation */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xl" role="img" aria-label="Recommandation">
                    🤝
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Recommandation</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.recommendation_request || 'Aucune demande programmée'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAutomationValue(meta.recommendation_request || '')
                    setAutomationDialogOpen('recommendation')
                  }}
                  className="h-8 gap-2 rounded-full text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5"
                >
                  {meta.recommendation_request ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {meta.recommendation_request ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </div>

          {/* Section RÉSUMÉ RELATIONNEL */}
          <div className="mt-6 space-y-4 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Résumé relationnel
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedTypes(normalizeContactTypes(contact.types))
                  setProfileDialogOpen(true)
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Modifier
              </button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <User className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs uppercase font-bold text-muted-foreground">Profil</p>
                  <p className="font-semibold text-foreground">
                    {contact.types?.map((t) => CONTACT_TYPE_META[t as ContactType]?.label || t).join(', ') || 'Vendeur'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-border pt-4">
                <UserCheck className="size-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Dans la base depuis le {formatFrenchDate(contact.created_at)}
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal Modification Coordonnées */}
      <Dialog open={coordDialogOpen} onOpenChange={setCoordDialogOpen}>
        <DialogContent className="bg-card">
          <form onSubmit={handleSaveCoordonnees}>
            <DialogHeader>
              <DialogTitle>Modifier les coordonnées</DialogTitle>
              <DialogDescription>
                Mettez à jour les informations d'identité et de contact.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Civilité</Label>
                  <Select
                    value={coordForm.civilite}
                    onValueChange={(val) =>
                      setCoordForm((prev) => ({
                        ...prev,
                        civilite: val,
                        salutation: generateSalutation(prev.first_name, val),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M.">M.</SelectItem>
                      <SelectItem value="Mme">Mme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dans les messages</Label>
                  <Input
                    value={coordForm.salutation}
                    onChange={(e) =>
                      setCoordForm((prev) => ({ ...prev, salutation: e.target.value }))
                    }
                    placeholder="« Bonjour Dupont, »"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={coordForm.first_name}
                    onChange={(e) =>
                      setCoordForm((prev) => ({
                        ...prev,
                        first_name: e.target.value,
                        salutation: generateSalutation(e.target.value, prev.civilite),
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={coordForm.last_name}
                    onChange={(e) =>
                      setCoordForm((prev) => ({ ...prev, last_name: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={coordForm.email}
                  onChange={(e) => setCoordForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@exemple.fr"
                />
              </div>

              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  type="tel"
                  value={coordForm.phone}
                  onChange={(e) => setCoordForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="06 12 34 56 78"
                />
              </div>

              <div className="space-y-2">
                <Label>Adresse de domicile</Label>
                <Input
                  value={coordForm.address}
                  onChange={(e) => setCoordForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="12 rue de la Paix, 83110 Sanary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCoordDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Modification Automatisation */}
      <Dialog
        open={automationDialogOpen !== null}
        onOpenChange={(open) => !open && setAutomationDialogOpen(null)}
      >
        <DialogContent className="bg-card">
          <form onSubmit={handleSaveAutomation}>
            <DialogHeader>
              <DialogTitle>
                {automationDialogOpen === 'birth' && 'Anniversaire client'}
                {automationDialogOpen === 'transaction' && 'Date de transaction'}
                {automationDialogOpen === 'review' && "Demande d'avis"}
                {automationDialogOpen === 'recommendation' && 'Recommandation'}
              </DialogTitle>
              <DialogDescription>
                {automationDialogOpen === 'birth' && 'Renseignez la date de naissance pour le suivi automatique.'}
                {automationDialogOpen === 'transaction' && 'Renseignez la date de la vente ou de l’achat.'}
                {automationDialogOpen === 'review' && 'Programmez ou enregistrez une demande d’avis client.'}
                {automationDialogOpen === 'recommendation' && 'Renseignez une note ou un rappel de parrainage.'}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <Label>
                {automationDialogOpen === 'birth' || automationDialogOpen === 'transaction'
                  ? 'Date (AAAA-MM-JJ)'
                  : 'Détail / Programmation'}
              </Label>
              <Input
                type={automationDialogOpen === 'birth' || automationDialogOpen === 'transaction' ? 'date' : 'text'}
                value={automationValue}
                onChange={(e) => setAutomationValue(e.target.value)}
                placeholder={
                  automationDialogOpen === 'review'
                    ? 'Ex: Avis Google demandé le 15 sept'
                    : automationDialogOpen === 'recommendation'
                      ? 'Ex: Relance parrainage dans 6 mois'
                      : ''
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAutomationDialogOpen(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                Valider
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Modification Profil */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="bg-card">
          <form onSubmit={handleSaveProfile}>
            <DialogHeader>
              <DialogTitle>Profil et typologies</DialogTitle>
              <DialogDescription>
                Sélectionnez les rôles et typologies associés à ce contact.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {CONTACT_TYPES.map((type) => {
                const checked = selectedTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setSelectedTypes((prev) =>
                        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
                      )
                    }
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border p-4 text-sm font-medium transition-colors',
                      checked
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-card text-foreground hover:bg-muted/50'
                    )}
                  >
                    <span>{CONTACT_TYPE_META[type]?.label}</span>
                    {checked && <Check className="size-4" />}
                  </button>
                )
              })}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProfileDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

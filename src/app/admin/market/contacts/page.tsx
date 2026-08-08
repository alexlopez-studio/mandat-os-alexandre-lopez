'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Loader2, UserRound, Phone, Mail, ExternalLink, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  source: string | null
}

export default function ContactsListPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone: '' })

  const loadContacts = useCallback(async (query: string = '') => {
    try {
      setLoading(true)
      const res = await fetch(`/api/market/contacts/search?q=${encodeURIComponent(query)}&limit=100`)
      if (!res.ok) throw new Error('Failed to fetch contacts')
      const json = await res.json()
      setContacts(json.contacts || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      loadContacts(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, loadContacts])

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.first_name && !formData.last_name && !formData.email && !formData.phone) {
      toast.error('Veuillez remplir au moins un champ')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch('/api/market/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (!res.ok) throw new Error('Erreur lors de la création')
      
      const { contact } = await res.json()
      toast.success('Contact créé avec succès')
      setIsDialogOpen(false)
      setFormData({ first_name: '', last_name: '', email: '', phone: '' })
      
      // Optionally route to the new contact or reload list
      router.push(`/app/contacts/${contact.id}`)
    } catch (err) {
      toast.error('Erreur lors de la création du contact')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Annuaire des Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Retrouvez ici tous vos contacts (vendeurs, acquéreurs, réseau).
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateContact}>
              <DialogHeader>
                <DialogTitle>Nouveau contact</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Prénom</Label>
                    <Input id="first_name" value={formData.first_name} onChange={(e) => setFormData(p => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nom</Label>
                    <Input id="last_name" value={formData.last_name} onChange={(e) => setFormData(p => ({ ...p, last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer le contact
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, téléphone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        {loading && contacts.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserRound className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">Aucun contact trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">Modifiez vos critères de recherche.</p>
          </div>
        ) : (
          <div className="divide-y">
            {contacts.map((contact) => {
              const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact sans nom'
              const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'C'

              return (
                <Link
                  key={contact.id}
                  href={`/app/contacts/${contact.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium leading-none">{displayName}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {contact.phone && (
                        <span className="flex items-center truncate">
                          <Phone className="mr-1 h-3 w-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center truncate">
                          <Mail className="mr-1 h-3 w-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.source && (
                        <span className="flex items-center truncate">
                          <ExternalLink className="mr-1 h-3 w-3" />
                          {contact.source}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

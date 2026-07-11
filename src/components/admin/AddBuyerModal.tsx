'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import communesData from '@/data/communes.json'

interface AddBuyerModalProps {
  onBuyerAdded?: () => void
  onBuyerSelected?: (leadId: string) => void
}

type CommuneEntry = {
  name: string
  postalCode: string
  department: string
  region: string
}

const COMMUNES: CommuneEntry[] = (communesData as CommuneEntry[]).sort((a, b) =>
  a.name.localeCompare(b.name, 'fr')
)

export function AddBuyerModal({ onBuyerAdded, onBuyerSelected }: AddBuyerModalProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type_bien: '',
    communes: [] as string[],
    budget_max: '',
    surface_min: '',
    pieces_min: '',
  })
  const [communeSearch, setCommuneSearch] = useState('')

  const filteredCommunes = communeSearch
    ? COMMUNES.filter(
        (c) =>
          c.name.toLowerCase().includes(communeSearch.toLowerCase()) ||
          c.postalCode.includes(communeSearch)
      ).slice(0, 20)
    : []

  const addCommune = (commune: string) => {
    if (!form.communes.includes(commune)) {
      setForm((prev) => ({ ...prev, communes: [...prev.communes, commune] }))
    }
    setCommuneSearch('')
  }

  const removeCommune = (commune: string) => {
    setForm((prev) => ({
      ...prev,
      communes: prev.communes.filter((c) => c !== commune),
    }))
  }

  const canSave =
    form.type_bien || form.communes.length > 0 || form.budget_max

  const handleSubmit = async () => {
    if (!canSave) return

    setSaving(true)
    try {
      const res = await fetch('/api/market/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_bien: form.type_bien || null,
          communes: form.communes.length > 0 ? form.communes : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          surface_min: form.surface_min ? Number(form.surface_min) : null,
          pieces_min: form.pieces_min ? Number(form.pieces_min) : null,
          active: true,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la création')
        return
      }

      toast.success('Acquéreur ajouté avec succès')
      setOpen(false)
      resetForm()

      if (onBuyerAdded) onBuyerAdded()
      if (data.buyer && onBuyerSelected) onBuyerSelected(data.buyer.lead_id)
    } catch (e) {
      console.error('Erreur création acheteur:', e)
      toast.error('Erreur serveur')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm({
      type_bien: '',
      communes: [],
      budget_max: '',
      surface_min: '',
      pieces_min: '',
    })
    setCommuneSearch('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvel acquéreur</DialogTitle>
          <DialogDescription>
            Ajoutez les critères de recherche d'un acquéreur
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type de bien */}
          <div className="space-y-2">
            <Label htmlFor="type_bien">Type de bien recherché</Label>
            <Select
              value={form.type_bien}
              onValueChange={(value) => setForm((prev) => ({ ...prev, type_bien: value }))}
            >
              <SelectTrigger id="type_bien">
                <SelectValue placeholder="Tous types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="maison">Maison</SelectItem>
                <SelectItem value="appartement">Appartement</SelectItem>
                <SelectItem value="terrain">Terrain</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Communes */}
          <div className="space-y-2">
            <Label>Communes recherchées</Label>
            <div className="relative">
              <Input
                placeholder="Rechercher une commune..."
                value={communeSearch}
                onChange={(e) => setCommuneSearch(e.target.value)}
              />
              {communeSearch && filteredCommunes.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-y-auto">
                  {filteredCommunes.map((c) => (
                    <button
                      key={`${c.postalCode}-${c.name}`}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => addCommune(c.name)}
                    >
                      {c.name} ({c.postalCode})
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.communes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.communes.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1"
                  >
                    {c}
                    <button
                      type="button"
                      className="hover:text-destructive"
                      onClick={() => removeCommune(c)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Budget max */}
          <div className="space-y-2">
            <Label htmlFor="budget_max">Budget maximum (€)</Label>
            <Input
              id="budget_max"
              type="number"
              placeholder="Ex: 300000"
              value={form.budget_max}
              onChange={(e) => setForm((prev) => ({ ...prev, budget_max: e.target.value }))}
            />
          </div>

          {/* Surface min */}
          <div className="space-y-2">
            <Label htmlFor="surface_min">Surface minimale (m²)</Label>
            <Input
              id="surface_min"
              type="number"
              placeholder="Ex: 70"
              value={form.surface_min}
              onChange={(e) => setForm((prev) => ({ ...prev, surface_min: e.target.value }))}
            />
          </div>

          {/* Nb pièces min */}
          <div className="space-y-2">
            <Label htmlFor="pieces_min">Nombre de pièces minimum</Label>
            <Input
              id="pieces_min"
              type="number"
              placeholder="Ex: 3"
              value={form.pieces_min}
              onChange={(e) => setForm((prev) => ({ ...prev, pieces_min: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Ajouter l'acquéreur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
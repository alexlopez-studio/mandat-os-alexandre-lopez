'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Users,
  MapPin,
  Euro,
  Loader2,
  Plus,
  Pencil,
  EyeOff,
  Eye,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Buyer {
  id: string
  lead_id: string
  type_bien: string | null
  communes: string[] | null
  budget_max: number | null
  surface_min: number | null
  pieces_min: number | null
  criteres: string[] | null
  active: boolean
  matched_at: string | null
  created_at: string
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

export function AcheteursListClient() {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const loadBuyers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (showInactive) params.set('active', 'all')
      else params.set('active', 'true')
      params.set('limit', '200')

      const res = await fetch(`/api/market/buyers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setBuyers(data.buyers ?? [])
      }
    } catch (e) {
      console.error('Erreur chargement:', e)
    } finally {
      setLoading(false)
    }
  }, [search, showInactive])

  useEffect(() => {
    loadBuyers()
  }, [loadBuyers])

  const toggleActive = async (leadId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/market/buyers/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      })
      if (res.ok) {
        toast.success(currentActive ? 'Acquéreur désactivé' : 'Acquéreur réactivé')
        loadBuyers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (e) {
      console.error('Erreur toggle:', e)
      toast.error('Erreur serveur')
    }
  }

  const softDelete = async (leadId: string) => {
    try {
      const res = await fetch(`/api/market/buyers/${leadId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Acquéreur désactivé')
        loadBuyers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (e) {
      console.error('Erreur suppression:', e)
      toast.error('Erreur serveur')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acquéreurs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion des profils d'acquéreurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? (
              <><Eye className="h-4 w-4 mr-1" /> Tous</>
            ) : (
              <><EyeOff className="h-4 w-4 mr-1" /> Actifs uniquement</>
            )}
          </Button>
          <Button asChild size="sm">
            <Link href="/app/acheteurs/nouveau">
              <Plus className="h-4 w-4 mr-1" />
              Nouvel acquéreur
            </Link>
          </Button>
        </div>
      </div>

      {/* Filtre */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Rechercher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par type de bien, commune, lead_id..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Chargement...
            </div>
          ) : buyers.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun acquéreur trouvé</p>
              <p className="text-xs mt-1">
                {search ? 'Essayez de modifier votre recherche' : 'Créez votre premier acquéreur'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Type de bien</th>
                    <th className="text-left px-4 py-3 font-medium">Communes</th>
                    <th className="text-left px-4 py-3 font-medium">Budget max</th>
                    <th className="text-left px-4 py-3 font-medium">Surface min</th>
                    <th className="text-left px-4 py-3 font-medium">Pièces min</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Statut</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((buyer) => (
                    <tr key={buyer.lead_id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium">
                          {buyer.type_bien ? (
                            <>{buyer.type_bien === 'appartement' ? '🏢' : buyer.type_bien === 'maison' ? '🏡' : '🏠'} {buyer.type_bien}</>
                          ) : 'Non spécifié'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {buyer.communes?.length ? (
                            buyer.communes.slice(0, 3).map((c) => (
                              <Badge key={c} variant="secondary" className="text-[10px]">
                                <MapPin className="h-3 w-3 mr-0.5" />
                                {c}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {(buyer.communes?.length ?? 0) > 3 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{(buyer.communes?.length ?? 0) - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {buyer.budget_max ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Euro className="h-3 w-3 text-muted-foreground" />
                            {formatPrice(buyer.budget_max)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {buyer.surface_min ? `${buyer.surface_min} m²` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {buyer.pieces_min ? `${buyer.pieces_min} pièces` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(buyer.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={buyer.active ? 'default' : 'secondary'} className="text-[10px]">
                          {buyer.active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link href={`/app/acheteurs/${buyer.lead_id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActive(buyer.lead_id, buyer.active)}
                            title={buyer.active ? 'Désactiver' : 'Réactiver'}
                          >
                            {buyer.active ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-destructive"
                            onClick={() => softDelete(buyer.lead_id)}
                            title="Désactiver"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
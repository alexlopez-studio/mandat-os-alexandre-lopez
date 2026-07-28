'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Loader2, Sparkles, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type EstimationImport = {
  id: string
  opportunity_id: string | null
  kind: string
  source: string
  contact_name: string | null
  property_address: string | null
  property_city: string | null
  price_low: number | null
  price_high: number | null
  price_m2: number | null
  confidence: number | null
  summary: string | null
  status: 'pending' | 'applied' | 'rejected'
  created_at: string
  applied_at: string | null
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) throw new Error(data?.error ?? 'Erreur inattendue')
  return data.data
}

export default function EstimationImportsPage() {
  const [imports, setImports] = useState<EstimationImport[]>([])
  const [loading, setLoading] = useState(true)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [opportunityIdDrafts, setOpportunityIdDrafts] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/estimation-imports?status=pending')
      const data = await parseJson(res)
      setImports(data as EstimationImport[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function linkToOpportunity(importId: string) {
    const opportunityId = opportunityIdDrafts[importId]?.trim()
    if (!opportunityId) {
      toast.error('Identifiant d’opportunité requis')
      return
    }
    setLinkingId(importId)
    try {
      const res = await fetch(`/api/estimation-imports/${importId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      })
      await parseJson(res)
      toast.success('Import rattaché — ouvrez la fiche opportunité pour l’appliquer')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rattachement impossible')
    } finally {
      setLinkingId(null)
    }
  }

  async function reject(importId: string) {
    setRejectingId(importId)
    try {
      const res = await fetch(`/api/estimation-imports/${importId}/reject`, { method: 'POST' })
      await parseJson(res)
      toast.success('Import rejeté')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejet impossible')
    } finally {
      setRejectingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Imports d’estimation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Données extraites automatiquement (skill Claude) en attente de revue avant application à un avis de valeur.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : imports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Aucun import en attente.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {imports.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {item.property_address || item.contact_name || 'Import sans adresse'}
                      {item.property_city ? ` — ${item.property_city}` : ''}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Source : {item.source} · {new Date(item.created_at).toLocaleString('fr-FR')}
                      {item.confidence != null ? ` · confiance ${Math.round(item.confidence * 100)}%` : ''}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{item.kind}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.summary ? <p className="text-sm">{item.summary}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {item.price_low?.toLocaleString('fr-FR') ?? '—'} € – {item.price_high?.toLocaleString('fr-FR') ?? '—'} €
                  {item.price_m2 ? ` · ${item.price_m2.toLocaleString('fr-FR')} €/m²` : ''}
                </p>

                {item.opportunity_id ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/opportunities/${item.opportunity_id}`}>
                      <ExternalLink className="mr-1 size-3.5" /> Ouvrir la fiche opportunité pour appliquer
                    </Link>
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="ID de l’opportunité à rattacher"
                      className="h-8 w-64 text-xs"
                      value={opportunityIdDrafts[item.id] ?? ''}
                      onChange={(e) => setOpportunityIdDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <Button size="sm" onClick={() => linkToOpportunity(item.id)} disabled={linkingId === item.id}>
                      {linkingId === item.id ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 size-3.5" />}
                      Rattacher
                    </Button>
                  </div>
                )}

                <Button size="sm" variant="ghost" onClick={() => reject(item.id)} disabled={rejectingId === item.id}>
                  {rejectingId === item.id ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <XCircle className="mr-1 size-3.5" />}
                  Rejeter
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

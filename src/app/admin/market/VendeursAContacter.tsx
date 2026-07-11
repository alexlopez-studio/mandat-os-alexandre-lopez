'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Flame, Timer, TrendingDown, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SellerPhase } from '@/lib/mandat/types'
import { SellerPhaseBadge } from '@/app/dashboard/radar/_components/SellerPhaseBadge'
import { SellerTypeBadge } from './DimensionBadges'

interface MandateScore {
  score: number
  phase: SellerPhase
  days_online: number
  price_drops_count: number
  total_drop_percent: number
}

interface PropertyRow {
  id: string
  title: string | null
  city: string | null
  zipcode: string | null
  price: number | null
  seller_type: string | null
  mandate_score?: MandateScore | null
}

// Phases prioritaires pour la prise de contact (fenêtre d'or vendeur).
const CONTACT_PHASES: SellerPhase[] = ['golden', 'hot']
const MAX_ROWS = 8

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function reasonLine(ms: MandateScore): string {
  const parts: string[] = [`${ms.days_online} j en ligne`]
  if (ms.price_drops_count > 0) {
    parts.push(`${ms.price_drops_count} baisse${ms.price_drops_count > 1 ? 's' : ''} (-${ms.total_drop_percent}%)`)
  }
  return parts.join(' · ')
}

export function VendeursAContacter() {
  const [rows, setRows] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/market/properties?limit=100')
      const data = await res.json()
      const all: PropertyRow[] = data.properties ?? []
      const hot = all
        .filter((p) => p.mandate_score && CONTACT_PHASES.includes(p.mandate_score.phase))
        .sort((a, b) => (b.mandate_score?.score ?? 0) - (a.mandate_score?.score ?? 0))
        .slice(0, MAX_ROWS)
      setRows(hot)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Vendeurs à contacter
          </CardTitle>
          <CardDescription>
            Biens dont le vendeur est en fenêtre d&apos;or (phase chaud / fenêtre d&apos;or) — à prospecter en priorité.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/properties">Voir le marché</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 px-4 text-center">
            <p className="text-sm font-medium">Aucun vendeur en fenêtre d&apos;or pour l&apos;instant.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les signaux (ancienneté, baisses de prix, republication) émergent avec la sync récurrente.
              En attendant, le triage par score reste disponible sur le marché.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/app/properties/${p.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-accent/50 transition-colors -mx-2 px-2 rounded-md"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{p.title || 'Bien sans titre'}</p>
                    <SellerTypeBadge type={p.seller_type} />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{p.city}{p.zipcode ? ` (${p.zipcode})` : ''}</span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {p.mandate_score ? reasonLine(p.mandate_score) : ''}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium tabular-nums hidden sm:inline">{formatPrice(p.price)}</span>
                  {(p.mandate_score?.price_drops_count ?? 0) > 0 && (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{p.mandate_score?.score}</span>
                    {p.mandate_score && <SellerPhaseBadge phase={p.mandate_score.phase} />}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

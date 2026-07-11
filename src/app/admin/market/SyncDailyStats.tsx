'use client'

import { useEffect, useState } from 'react'
import { DownloadCloud, RefreshCw, Coins } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface DayRow {
  date: string
  downloaded: number
  updated: number
  items: number
  cost: number
}

interface SyncDailyResponse {
  today: DayRow
  daily: DayRow[]
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function SyncDailyStats() {
  const [data, setData] = useState<SyncDailyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/market/sync-daily-stats?days=14')
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const today = data?.today
  const rows = [...(data?.daily ?? [])].reverse() // plus récent en haut

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DownloadCloud className="h-5 w-5 text-primary" />
            Synchronisation Stream Estate
          </CardTitle>
          <CardDescription>Leads téléchargés et mis à jour, par jour.</CardDescription>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aujourd'hui */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Téléchargés aujourd&apos;hui</p>
            <p className="text-2xl font-semibold tabular-nums">{today ? today.downloaded : '—'}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Mis à jour aujourd&apos;hui</p>
            <p className="text-2xl font-semibold tabular-nums">{today ? today.updated : '—'}</p>
          </div>
        </div>

        {/* Historique par jour */}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {loading ? 'Chargement…' : 'Aucune synchronisation sur la période. La sync nocturne remplira ce tableau.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left font-medium py-2">Jour</th>
                  <th className="text-right font-medium py-2">Téléchargés</th>
                  <th className="text-right font-medium py-2">Mis à jour</th>
                  <th className="text-right font-medium py-2">Items</th>
                  <th className="text-right font-medium py-2">Coût</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date} className="border-b last:border-0">
                    <td className="py-2 capitalize">{formatDay(r.date)}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{r.downloaded}</td>
                    <td className="py-2 text-right tabular-nums">{r.updated}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{r.items}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        {r.cost.toFixed(2)} €
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

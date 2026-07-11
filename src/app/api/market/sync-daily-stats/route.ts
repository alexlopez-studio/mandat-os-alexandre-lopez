import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/market/sync-daily-stats?days=14
 * Agrège l'activité de synchronisation Stream Estate par jour :
 * leads téléchargés (créés), leads mis à jour, items facturés, coût estimé.
 */
export async function GET(req: NextRequest) {
  try {
    const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 14))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: runs, error } = await supabaseAdmin
      .from('sync_runs')
      .select('started_at, created_count, updated_count, fetched_count, external_item_count, estimated_cost_eur')
      .gte('started_at', since)
      .order('started_at', { ascending: true })

    if (error) {
      console.error('[API /market/sync-daily-stats]', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Clé de jour en heure de Paris (fr-CA donne YYYY-MM-DD).
    const dayKey = (iso: string) =>
      new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso))

    const byDay = new Map<string, { downloaded: number; updated: number; items: number; cost: number }>()
    for (const r of runs ?? []) {
      const key = dayKey(r.started_at)
      const acc = byDay.get(key) ?? { downloaded: 0, updated: 0, items: 0, cost: 0 }
      acc.downloaded += Number(r.created_count) || 0
      acc.updated += Number(r.updated_count) || 0
      acc.items += Number(r.external_item_count) || 0
      acc.cost += Number(r.estimated_cost_eur) || 0
      byDay.set(key, acc)
    }

    const daily = [...byDay.entries()]
      .map(([date, v]) => ({ date, ...v, cost: Math.round(v.cost * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const todayKey = dayKey(new Date().toISOString())
    const today = byDay.get(todayKey) ?? { downloaded: 0, updated: 0, items: 0, cost: 0 }

    return NextResponse.json({
      days,
      today: { date: todayKey, ...today, cost: Math.round(today.cost * 100) / 100 },
      daily,
    })
  } catch (e) {
    console.error('[API /market/sync-daily-stats]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

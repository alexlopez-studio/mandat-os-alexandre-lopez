import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { DVF_DATASET_API_URL, DVF_DATASET_URL } from '@/lib/dvf'

type Db = { from: (table: string) => any }
const db = supabaseAdmin as unknown as Db

type DvfStatsRow = {
  value: number | null
  price_per_m2: number | null
  built_surface: number | null
  land_surface: number | null
  local_type: string | null
  mutation_year: number | null
}

function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
}

function round(value: number | null, digits = 0): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const inseeCode = searchParams.get('insee_code')?.trim()
    const localType = searchParams.get('local_type')?.trim()
    const year = Number.parseInt(searchParams.get('year') ?? '', 10)

    let query = db
      .from('dvf_transactions')
      .select('value, price_per_m2, built_surface, land_surface, local_type, mutation_year')
      .limit(20000)

    if (inseeCode) query = query.eq('insee_code', inseeCode)
    if (localType && localType !== 'all') query = query.eq('local_type', localType)
    if (Number.isFinite(year)) query = query.eq('mutation_year', year)

    const { data, error } = await query
    if (error) {
      console.error('[API /market/dvf/stats] GET', error)
      return NextResponse.json({ error: 'Erreur lecture stats DVF' }, { status: 500 })
    }

    const rows = (data ?? []) as DvfStatsRow[]
    const values = rows.map((row) => Number(row.value)).filter((value) => Number.isFinite(value) && value > 0)
    const pricesM2 = rows.map((row) => Number(row.price_per_m2)).filter((value) => Number.isFinite(value) && value > 0)
    const builtSurfaces = rows.map((row) => Number(row.built_surface)).filter((value) => Number.isFinite(value) && value > 0)
    const landSurfaces = rows.map((row) => Number(row.land_surface)).filter((value) => Number.isFinite(value) && value > 0)

    const byType = new Map<string, { count: number; pricesM2: number[]; values: number[] }>()
    const byYear = new Map<number, { count: number; pricesM2: number[]; values: number[] }>()

    for (const row of rows) {
      const type = row.local_type ?? 'Non renseigné'
      const typeBucket = byType.get(type) ?? { count: 0, pricesM2: [], values: [] }
      typeBucket.count += 1
      if (row.price_per_m2 && row.price_per_m2 > 0) typeBucket.pricesM2.push(Number(row.price_per_m2))
      if (row.value && row.value > 0) typeBucket.values.push(Number(row.value))
      byType.set(type, typeBucket)

      if (row.mutation_year) {
        const yearBucket = byYear.get(row.mutation_year) ?? { count: 0, pricesM2: [], values: [] }
        yearBucket.count += 1
        if (row.price_per_m2 && row.price_per_m2 > 0) yearBucket.pricesM2.push(Number(row.price_per_m2))
        if (row.value && row.value > 0) yearBucket.values.push(Number(row.value))
        byYear.set(row.mutation_year, yearBucket)
      }
    }

    return NextResponse.json({
      source: {
        dataset_url: DVF_DATASET_URL,
        dataset_api_url: DVF_DATASET_API_URL,
      },
      filters: { insee_code: inseeCode ?? null, local_type: localType ?? null, year: Number.isFinite(year) ? year : null },
      totals: {
        transactions: rows.length,
        median_value: median(values),
        median_price_per_m2: median(pricesM2),
        avg_price_per_m2: pricesM2.length ? round(pricesM2.reduce((sum, value) => sum + value, 0) / pricesM2.length, 2) : null,
        median_built_surface: median(builtSurfaces),
        median_land_surface: median(landSurfaces),
      },
      by_type: Array.from(byType.entries())
        .map(([type, bucket]) => ({
          type,
          count: bucket.count,
          median_value: median(bucket.values),
          median_price_per_m2: median(bucket.pricesM2),
        }))
        .sort((a, b) => b.count - a.count),
      by_year: Array.from(byYear.entries())
        .map(([mutationYear, bucket]) => ({
          year: mutationYear,
          count: bucket.count,
          median_value: median(bucket.values),
          median_price_per_m2: median(bucket.pricesM2),
        }))
        .sort((a, b) => a.year - b.year),
    })
  } catch (error) {
    console.error('[API /market/dvf/stats] GET', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

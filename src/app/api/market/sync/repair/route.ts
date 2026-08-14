import { NextRequest, NextResponse } from 'next/server'
import { getStreamEstateQualityOptions } from '@/lib/settings'
import { repairStreamEstateListings } from '@/lib/market/repair-stream-estate'

/**
 * POST /api/market/sync/repair
 * Recalcule les biens Stream Estate déjà importés depuis leur `raw_json`.
 * Gratuit : aucun appel à l'API Stream Estate, donc aucun item facturé.
 *
 * Body : { dry_run?: boolean }  — `dry_run` renvoie le diff sans rien écrire.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dry_run === true || body?.dryRun === true
    const quality = await getStreamEstateQualityOptions()

    const result = await repairStreamEstateListings({ dryRun, quality })

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      max_crawl_age_days: quality.maxCrawlAgeDays,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[API /market/sync/repair]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

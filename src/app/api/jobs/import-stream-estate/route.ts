// ═══════════════════════════════════════════════════════════════
// Cron : Import Stream Estate
// Déclenché quotidiennement par Vercel Cron
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { importAllListings } from '@/lib/mandat/import-service'
import { isMandatFinderPipelineEnabled } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // limite plan Hobby Vercel

/**
 * GET /api/jobs/import-stream-estate
 * Déclenché par le cron Vercel configuré dans vercel.json
 */
export async function GET() {
    console.log('[Cron] Démarrage import Stream Estate...')

    if (!(await isMandatFinderPipelineEnabled())) {
        console.log('[Cron] Pipeline MandatFinder désactivé (app_settings.mandatfinder_pipeline_enabled = false), arrêt.')
        return NextResponse.json({ success: true, skipped: true, reason: 'pipeline_disabled' })
    }

    try {
        const result = await importAllListings()

        console.log(`[Cron] Import terminé : ${result.listings_new} nouveaux, ${result.listings_updated} mis à jour`)

        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        console.error('[Cron] Erreur import:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Erreur inconnue',
            },
            { status: 500 },
        )
    }
}
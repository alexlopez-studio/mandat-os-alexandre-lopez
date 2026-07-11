// ═══════════════════════════════════════════════════════════════
// Cron : Analyse quotidienne des listings
// Déclenché quotidiennement par Vercel Cron
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { runDailyAnalysis } from '@/lib/mandat/analysis-service'
import { isMandatFinderPipelineEnabled } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // limite plan Hobby Vercel

/**
 * GET /api/jobs/analyze-listings
 * Exécute le pipeline complet : import → snapshot → événements → scores
 */
export async function GET() {
    console.log('[Cron] Démarrage analyse quotidienne...')

    if (!(await isMandatFinderPipelineEnabled())) {
        console.log('[Cron] Pipeline MandatFinder désactivé (app_settings.mandatfinder_pipeline_enabled = false), arrêt.')
        return NextResponse.json({ success: true, skipped: true, reason: 'pipeline_disabled' })
    }

    try {
        const result = await runDailyAnalysis()

        console.log(`[Cron] Analyse terminée : ${result.listings_processed} traités, ${result.events_detected} événements`)

        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        console.error('[Cron] Erreur analyse:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Erreur inconnue',
            },
            { status: 500 },
        )
    }
}
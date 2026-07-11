// ═══════════════════════════════════════════════════════════════
// MandatFinder — Analysis Service
// Rôle : Orchestrateur du batch quotidien
//        1. Importer → 2. Snapshoter → 3. Événementiser → 4. Scorer
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import { importAllListings } from './import-service'
import { detectEvents, insertEvents, countPriceDrops, getTotalDropPercent, isRelisted } from './event-service'
import { calculateScore } from './scoring-service'
import { sendGoldenAlertIfNeeded } from './alert-service'
import type { BatchResult, ListingEvent, ListingSnapshot } from './types'

// ── Type helper pour tables non encore typées ──────────────
const db = {
    listings: () => supabaseAdmin.from('listings' as unknown as any) as any,
    listing_snapshots: () => supabaseAdmin.from('listing_snapshots' as unknown as any) as any,
    listing_events: () => supabaseAdmin.from('listing_events' as unknown as any) as any,
    seller_scores: () => supabaseAdmin.from('seller_scores' as unknown as any) as any,
}

// ── Pipeline ────────────────────────────────────────────────

/**
 * Exécute le pipeline complet d'analyse quotidienne :
 * 1. Import des annonces depuis Stream Estate
 * 2. Snapshots des listings actifs
 * 3. Détection d'événements par comparaison
 * 4. Recalcul des scores
 */
export async function runDailyAnalysis(): Promise<BatchResult> {
    const startedAt = new Date().toISOString()
    const errors: string[] = []

    // ── Étape 1 : Import ─────────────────────────────────
    console.log('[MandatFinder] Étape 1/4 : Import des annonces...')
    const importResult = await importAllListings()
    errors.push(...importResult.errors)

    if (importResult.listings_new === 0 && importResult.listings_updated === 0) {
        console.log('[MandatFinder] Aucune annonce importée, arrêt du pipeline.')
        return { ...importResult, finished_at: new Date().toISOString() }
    }

    // ── Étape 2 : Snapshots ──────────────────────────────
    console.log('[MandatFinder] Étape 2/4 : Création des snapshots...')
    let snapshotsCreated = 0
    try {
        snapshotsCreated = await snapshotActiveListings()
    } catch (err) {
        errors.push(`Erreur snapshot: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── Étape 3 : Événements ─────────────────────────────
    console.log('[MandatFinder] Étape 3/4 : Détection des événements...')
    let eventsDetected = 0
    try {
        eventsDetected = await detectAndInsertEventsForAll()
    } catch (err) {
        errors.push(`Erreur événements: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── Étape 4 : Scores ─────────────────────────────────
    console.log('[MandatFinder] Étape 4/4 : Recalcul des scores...')
    let scoresRecalculated = 0
    try {
        scoresRecalculated = await recalculateAllScores()
    } catch (err) {
        errors.push(`Erreur scores: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── Étape 5 : Alerting "fenêtre d'or" ───────────────
    console.log('[MandatFinder] Étape 5/5 : Alerting golden...')
    try {
        const alertResult = await sendGoldenAlertIfNeeded()
        if (!alertResult.skipped) {
            console.log(`[MandatFinder] ${alertResult.new_golden_count} nouveau(x) golden détecté(s), email envoyé: ${alertResult.email_sent}`)
        }
    } catch (err) {
        errors.push(`Erreur alerting: ${err instanceof Error ? err.message : String(err)}`)
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    console.log(`[MandatFinder] Pipeline terminé en ${durationMs}ms`)

    return {
        job: 'analyze-listings',
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        listings_processed: importResult.listings_processed,
        listings_new: importResult.listings_new,
        listings_updated: importResult.listings_updated,
        snapshots_created: snapshotsCreated,
        events_detected: eventsDetected,
        scores_recalculated: scoresRecalculated,
        errors,
    }
}

// ── Étape 2 : Snapshots ───────────────────────────────────

/**
 * Crée un snapshot quotidien pour chaque listing actif.
 * Utilise la contrainte UNIQUE (listing_id, date) pour éviter les doublons.
 */
async function snapshotActiveListings(): Promise<number> {
    const { data: listings, error } = await db.listings()
        .select('id, price, status, surface, raw')
        .in('status', ['active', 'relisted'])

    if (error) throw error
    if (!listings || listings.length === 0) return 0

    const today = new Date().toISOString().split('T')[0]

    let created = 0
    for (const listing of listings) {
        // Vérifier si un snapshot existe déjà aujourd'hui
        const { data: existing } = await db.listing_snapshots()
            .select('id')
            .eq('listing_id', listing.id)
            .gte('snapshotted_at', `${today}T00:00:00Z`)
            .lt('snapshotted_at', `${today}T23:59:59Z`)
            .maybeSingle()

        if (existing) continue // Déjà snapshoté aujourd'hui

        const { error: insertError } = await db.listing_snapshots()
            .insert({
                listing_id: listing.id,
                price: listing.price,
                status: listing.status,
                surface: listing.surface,
                raw: listing.raw ?? {},
                snapshotted_at: new Date().toISOString(),
            })

        if (insertError) {
            console.error(`Erreur snapshot listing ${listing.id}:`, insertError)
        } else {
            created++
        }
    }

    return created
}

// ── Étape 3 : Événements ──────────────────────────────────

/**
 * Pour tous les listings, compare les 2 derniers snapshots
 * et insère les événements détectés.
 */
async function detectAndInsertEventsForAll(): Promise<number> {
    // Récupérer les listings qui ont au moins 1 snapshot
    const { data: listings, error } = await db.listings()
        .select('id')

    if (error) throw error
    if (!listings) return 0

    let totalEvents = 0

    for (const listing of listings) {
        try {
            const events = await detectEventsForListing(listing.id)
            if (events.length > 0) {
                const inserted = await insertEvents(events)
                totalEvents += inserted
            }
        } catch (err) {
            console.error(`Erreur détection événements listing ${listing.id}:`, err)
        }
    }

    return totalEvents
}

/**
 * Récupère les 2 derniers snapshots d'un listing et détecte les événements.
 */
async function detectEventsForListing(
    listingId: string,
): Promise<Array<Omit<ListingEvent, 'id' | 'detected_at'>>> {
    const { data: snapshots, error } = await db.listing_snapshots()
        .select('*')
        .eq('listing_id', listingId)
        .order('snapshotted_at', { ascending: false })
        .limit(2)

    if (error) throw error
    if (!snapshots || snapshots.length === 0) return []

    const current = snapshots[0] as ListingSnapshot
    const previous = snapshots[1] as ListingSnapshot | undefined

    return detectEvents({ current, previous: previous ?? null })
}

// ── Étape 4 : Scores ──────────────────────────────────────

/**
 * Recalcule le score pour tous les listings actifs.
 */
async function recalculateAllScores(): Promise<number> {
    const { data: listings, error } = await db.listings()
        .select('*')
        .in('status', ['active', 'relisted'])

    if (error) throw error
    if (!listings) return 0

    let recalculated = 0

    for (const listing of listings) {
        try {
            const [priceDropsCount, totalDropPercent, relisted] = await Promise.all([
                countPriceDrops(listing.id),
                getTotalDropPercent(listing.id),
                isRelisted(listing.id),
            ])

            const daysOnline = Math.floor(
                (new Date().getTime() - new Date(listing.first_seen_at).getTime()) /
                (1000 * 60 * 60 * 24),
            )

            const score = calculateScore({
                listingId: listing.id,
                daysOnline,
                priceDropsCount,
                totalDropPercent,
                isRelisted: relisted,
                isRelistedWithNewPrice: relisted && totalDropPercent > 0,
            })

            // Upsert du score (1 par jour)
            const today = new Date().toISOString().split('T')[0]

            const { error: upsertError } = await db.seller_scores().upsert(
                {
                    listing_id: listing.id,
                    score: score.score,
                    time_score: score.time_score,
                    frustration_score: score.frustration_score,
                    drop_intensity_score: score.drop_intensity_score,
                    behavior_score: score.behavior_score,
                    phase: score.phase,
                    breakdown: score.breakdown,
                    calculated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'listing_id,calculated_at::date',
                    ignoreDuplicates: false,
                },
            )

            if (upsertError) throw upsertError
            recalculated++
        } catch (err) {
            console.error(`Erreur score listing ${listing.id}:`, err)
        }
    }

    return recalculated
}
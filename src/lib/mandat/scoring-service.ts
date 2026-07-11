// ═══════════════════════════════════════════════════════════════
// MandatFinder — Scoring Service
// Rôle : Calculer le MandateProbabilityScore (0-100)
// ═══════════════════════════════════════════════════════════════

import type { SellerScore, ScoreBreakdown, SellerPhase } from './types'

// ── Scoring Rules ──────────────────────────────────────────

/**
 * Axe 1 : Temps (40 points max)
 * Plus l'annonce est ancienne, plus le propriétaire est susceptible
 * d'accepter une aide extérieure (fenêtre d'or).
 */
function computeTimeScore(daysOnline: number): number {
    if (daysOnline <= 30) return 5
    if (daysOnline <= 60) return 15
    if (daysOnline <= 90) return 30
    if (daysOnline <= 120) return 35
    return 40
}

/**
 * Axe 2 : Frustration (30 points max)
 * Le nombre de baisses de prix est le signal le plus fort.
 * Un vendeur qui baisse son prix admet que sa stratégie ne fonctionne pas.
 */
function computeFrustrationScore(priceDropsCount: number): number {
    if (priceDropsCount === 0) return 0
    if (priceDropsCount === 1) return 10
    if (priceDropsCount === 2) return 20
    return 30 // 3+ baisses
}

/**
 * Axe 3 : Intensité de la baisse (15 points max)
 * Le pourcentage de baisse est plus significatif que le montant absolu.
 */
function computeDropIntensityScore(totalDropPercent: number): number {
    if (totalDropPercent < 3) return 0
    if (totalDropPercent < 5) return 5
    if (totalDropPercent < 10) return 10
    return 15
}

/**
 * Axe 4 : Comportement de publication (15 points max)
 * Une republication = annonce supprimée puis remise en ligne.
 * Avec un nouveau prix = signal encore plus fort.
 */
function computeBehaviorScore(isRelisted: boolean, isRelistedWithNewPrice: boolean): number {
    if (isRelistedWithNewPrice) return 15
    if (isRelisted) return 10
    return 0
}

// ── Phase ──────────────────────────────────────────────────

/**
 * Détermine la phase du vendeur en fonction du score total.
 *
 * Phases :
 *   cold   (0-30)  : Annonce récente, peu de signaux
 *   warm   (31-55) : Commence à montrer des signes
 *   hot    (56-70) : Bonne fenêtre, à contacter
 *   golden (71-100): Fenêtre d'or, opportunité maximale
 */
function determinePhase(score: number): SellerPhase {
    if (score <= 30) return 'cold'
    if (score <= 55) return 'warm'
    if (score <= 70) return 'hot'
    return 'golden'
}

// ── Public API ─────────────────────────────────────────────

export interface ScoringInput {
    listingId: string
    daysOnline: number
    priceDropsCount: number
    totalDropPercent: number
    isRelisted: boolean
    isRelistedWithNewPrice: boolean
}

/**
 * Calcule le MandateProbabilityScore complet pour un listing.
 *
 * @returns Le score complet avec breakdown et phase
 */
export function calculateScore(input: ScoringInput): SellerScore {
    const timeScore = computeTimeScore(input.daysOnline)
    const frustrationScore = computeFrustrationScore(input.priceDropsCount)
    const dropIntensityScore = computeDropIntensityScore(input.totalDropPercent)
    const behaviorScore = computeBehaviorScore(input.isRelisted, input.isRelistedWithNewPrice)

    const total = timeScore + frustrationScore + dropIntensityScore + behaviorScore
    const score = Math.min(100, Math.max(0, total))
    const phase = determinePhase(score)

    const breakdown: ScoreBreakdown = {
        time: { days_online: input.daysOnline, raw_points: timeScore },
        frustration: { drops_count: input.priceDropsCount, raw_points: frustrationScore },
        drop_intensity: { total_drop_percent: input.totalDropPercent, raw_points: dropIntensityScore },
        behavior: {
            is_relisted: input.isRelisted,
            is_relisted_with_new_price: input.isRelistedWithNewPrice,
            raw_points: behaviorScore,
        },
    }

    return {
        id: '', // Sera généré par Supabase
        listing_id: input.listingId,
        score,
        time_score: timeScore,
        frustration_score: frustrationScore,
        drop_intensity_score: dropIntensityScore,
        behavior_score: behaviorScore,
        phase,
        breakdown,
        calculated_at: new Date().toISOString(),
    }
}

/**
 * Version simplifiée pour le scoring rapide d'un listing.
 * Utile pour les affichages dans le radar.
 */
export function calculateQuickScore(daysOnline: number, priceDropsCount: number): {
    score: number
    phase: SellerPhase
} {
    const timeScore = computeTimeScore(daysOnline)
    const frustrationScore = computeFrustrationScore(priceDropsCount)
    const total = timeScore + frustrationScore
    const score = Math.min(100, Math.max(0, total))
    return { score, phase: determinePhase(score) }
}
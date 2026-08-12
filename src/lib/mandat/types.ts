// ═══════════════════════════════════════════════════════════════
// MandatFinder — Types du domaine
// ═══════════════════════════════════════════════════════════════

import type { Json } from '@/types/supabase'

// ── Enums ──────────────────────────────────────────────────

export type ListingStatus = 'active' | 'removed' | 'expired' | 'relisted'

export type ListingEventType =
    | 'price_drop'
    | 'price_increase'
    | 'listing_removed'
    | 'listing_relisted'
    | 'stagnation_90'
    | 'overpriced'
    | 'first_seen'

export type SellerPhase = 'cold' | 'warm' | 'hot' | 'golden'

// ── Listing (annonce) ─────────────────────────────────────

export interface Listing {
    id: string
    external_id: string
    source: string
    title: string | null
    description: string | null
    city: string | null
    zipcode: string | null
    insee_code: string | null
    lat: number | null
    lon: number | null
    property_type: string | null
    price: number | null
    surface: number | null
    land_surface: number | null
    rooms: number | null
    bedrooms: number | null
    dpe: string | null
    ges: string | null
    url: string | null
    images: string[]
    status: ListingStatus
    first_seen_at: string
    last_seen_at: string
    raw: Record<string, unknown>
    created_at: string
    updated_at: string
}

// ── Listing Snapshot ─────────────────────────────────────

export interface ListingSnapshot {
    id: string
    listing_id: string
    price: number | null
    status: ListingStatus | null
    surface: number | null
    raw: Record<string, unknown>
    snapshotted_at: string
}

// ── Listing Event ────────────────────────────────────────

export interface ListingEvent {
    id: string
    listing_id: string
    event_type: ListingEventType
    previous_price: number | null
    new_price: number | null
    drop_percent: number | null
    snapshot_id: string | null
    metadata: Record<string, unknown>
    detected_at: string
}

// ── Seller Score ─────────────────────────────────────────

export interface SellerScore {
    id: string
    listing_id: string
    score: number
    time_score: number
    frustration_score: number
    drop_intensity_score: number
    behavior_score: number
    phase: SellerPhase
    breakdown: ScoreBreakdown
    calculated_at: string
}

export interface ScoreBreakdown {
    /** Détail du calcul temps */
    time: { days_online: number; raw_points: number }
    /** Détail du calcul frustration (baisses) */
    frustration: { drops_count: number; raw_points: number }
    /** Détail du calcul intensité de baisse */
    drop_intensity: { total_drop_percent: number; raw_points: number }
    /** Détail du calcul comportement */
    behavior: { is_relisted: boolean; is_relisted_with_new_price: boolean; raw_points: number }
}

// ── MandateProbability (résultat scoring complet) ────────

export interface MandateProbability {
    listing_id: string
    score: number
    breakdown: ScoreBreakdown
    phase: SellerPhase
    calculated_at: string
}

// ── Batch Result ─────────────────────────────────────────

export interface BatchResult {
    job: string
    started_at: string
    finished_at: string
    duration_ms: number
    listings_processed: number
    listings_new: number
    listings_updated: number
    snapshots_created: number
    events_detected: number
    scores_recalculated: number
    errors: string[]
}
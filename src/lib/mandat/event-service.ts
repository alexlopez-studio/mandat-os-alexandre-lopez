// ═══════════════════════════════════════════════════════════════
// MandatFinder — Event Service
// Rôle : Détecter les événements immobiliers par comparaison
//        des snapshots quotidiens
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import type { ListingEvent, ListingEventType, ListingSnapshot } from './types'

// ── Type helper pour tables non encore typées ──────────────
const db = {
    listing_events: () => supabaseAdmin.from('listing_events' as unknown as any) as any,
}

// ── Détection d'événements ─────────────────────────────────

interface SnapshotPair {
    current: ListingSnapshot
    previous: ListingSnapshot | null
}

/**
 * Analyse une paire de snapshots et détecte les événements.
 * Retourne les événements à insérer.
 */
export function detectEvents(pair: SnapshotPair): Array<Omit<ListingEvent, 'id' | 'detected_at'>> {
    const events: Array<Omit<ListingEvent, 'id' | 'detected_at'>> = []
    const { current, previous } = pair

    if (!previous) {
        // Premier snapshot jamais vu
        events.push({
            listing_id: current.listing_id,
            event_type: 'first_seen',
            previous_price: null,
            new_price: current.price,
            drop_percent: null,
            snapshot_id: current.id,
            metadata: {},
        })
        return events
    }

    const oldPrice = previous.price
    const newPrice = current.price

    // ── Détection baisse de prix ─────────────────────────
    if (oldPrice !== null && newPrice !== null && newPrice < oldPrice) {
        const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100

        events.push({
            listing_id: current.listing_id,
            event_type: 'price_drop',
            previous_price: oldPrice,
            new_price: newPrice,
            drop_percent: Math.round(dropPercent * 100) / 100,
            snapshot_id: current.id,
            metadata: { previous_snapshot_id: previous.id },
        })
    }

    // ── Détection hausse de prix (rare) ──────────────────
    if (oldPrice !== null && newPrice !== null && newPrice > oldPrice) {
        events.push({
            listing_id: current.listing_id,
            event_type: 'price_increase',
            previous_price: oldPrice,
            new_price: newPrice,
            drop_percent: null,
            snapshot_id: current.id,
            metadata: { previous_snapshot_id: previous.id },
        })
    }

    // ── Détection changement de statut ───────────────────
    if (previous.status !== null && current.status !== previous.status) {
        if (current.status === 'removed' || current.status === 'expired') {
            events.push({
                listing_id: current.listing_id,
                event_type: 'listing_removed',
                previous_price: oldPrice,
                new_price: null,
                drop_percent: null,
                snapshot_id: current.id,
                metadata: {
                    previous_status: previous.status,
                    new_status: current.status,
                    previous_snapshot_id: previous.id,
                },
            })
        }

        if (current.status === 'relisted') {
            events.push({
                listing_id: current.listing_id,
                event_type: 'listing_relisted',
                previous_price: oldPrice,
                new_price: newPrice,
                drop_percent: null,
                snapshot_id: current.id,
                metadata: {
                    previous_status: previous.status,
                    new_status: current.status,
                    previous_snapshot_id: previous.id,
                },
            })
        }
    }

    return events
}

// ── Insertion ──────────────────────────────────────────────

/**
 * Insère les événements détectés dans la table listing_events.
 */
export async function insertEvents(
    events: Array<Omit<ListingEvent, 'id' | 'detected_at'>>,
): Promise<number> {
    if (events.length === 0) return 0

    const { error } = await db.listing_events().insert(
        events.map((e) => ({
            ...e,
            detected_at: new Date().toISOString(),
        })),
    )

    if (error) throw error
    return events.length
}

// ── Aggrégation des événements ─────────────────────────────

/**
 * Compte le nombre de baisses de prix pour un listing.
 */
export async function countPriceDrops(listingId: string): Promise<number> {
    const { count, error } = await db.listing_events()
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('event_type', 'price_drop')

    if (error) throw error
    return count ?? 0
}

/**
 * Récupère le pourcentage total de baisse pour un listing.
 * Somme de tous les drop_percent des événements price_drop.
 */
export async function getTotalDropPercent(listingId: string): Promise<number> {
    const { data, error } = await db.listing_events()
        .select('drop_percent')
        .eq('listing_id', listingId)
        .eq('event_type', 'price_drop')

    if (error) throw error

    return data.reduce((sum: number, e: { drop_percent: number | null }) => sum + (e.drop_percent ?? 0), 0)
}

/**
 * Vérifie si un listing a été republié.
 */
export async function isRelisted(listingId: string): Promise<boolean> {
    const { count, error } = await db.listing_events()
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('event_type', 'listing_relisted')

    if (error) throw error
    return (count ?? 0) > 0
}

/**
 * Récupère le dernier événement d'un listing.
 */
export async function getLastEvent(
    listingId: string,
): Promise<{ event_type: ListingEventType; detected_at: string } | null> {
    const { data, error } = await db.listing_events()
        .select('event_type, detected_at')
        .eq('listing_id', listingId)
        .order('detected_at', { ascending: false })
        .limit(1)
        .single()

    if (error) return null
    return data
}
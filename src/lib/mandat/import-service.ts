// ═══════════════════════════════════════════════════════════════
// MandatFinder — Import Service
// Rôle : Importer les annonces depuis Stream Estate vers Supabase
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import { fetchListings, StreamEstateRequestLimitError } from '@/lib/stream-estate'
import {
    canSpendStreamEstateItems,
    getAvailableStreamEstateItems,
    getStreamEstateBudgetSnapshot,
    recordStreamEstateUsageEvent,
} from '@/lib/stream-estate-budget'
import type { Listing, BatchResult } from './types'

// ── Type helper pour tables non encore typées ──────────────
const db = {
    listings: () => supabaseAdmin.from('listings' as unknown as any) as any,
}

const SOURCE = 'stream_estate'

// ── Configuration ──────────────────────────────────────────

// Seuls les codes postaux explicitement définis dans MANDAT_CP sont traités.
// Ex: MANDAT_CP=83600 ou MANDAT_CP=83600,83190
// Aucun CP par défaut : tu ne paies que pour ceux que tu as choisis.
const MANDAT_CP = typeof process !== 'undefined' ? process.env.MANDAT_CP : undefined
const ZIPCODES = MANDAT_CP
    ? MANDAT_CP.split(',').map((z: string) => z.trim())
    : [] // ← vide intentionnellement : défini MANDAT_CP dans .env.local

// Codes Stream Estate : Appartement 0, Maison 1. On ne récupère que le résidentiel.
const PROPERTY_TYPES = [0, 1]

// ── Service ────────────────────────────────────────────────

/**
 * Importe les annonces depuis Stream Estate pour tous les CP configurés.
 * Upsert dans la table `listings`.
 */
export async function importAllListings(): Promise<BatchResult> {
    const startedAt = new Date().toISOString()
    let listingsNew = 0
    let listingsUpdated = 0
    const errors: string[] = []

    for (const zipcode of ZIPCODES) {
        try {
            const result = await importZipcode(zipcode)
            listingsNew += result.listingsNew
            listingsUpdated += result.listingsUpdated
        } catch (err) {
            errors.push(`Erreur CP ${zipcode}: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    return {
        job: 'import-stream-estate',
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        listings_processed: listingsNew + listingsUpdated,
        listings_new: listingsNew,
        listings_updated: listingsUpdated,
        snapshots_created: 0,
        events_detected: 0,
        scores_recalculated: 0,
        errors,
    }
}

/**
 * Importe les annonces pour un code postal donné.
 */
async function importZipcode(
    zipcode: string,
): Promise<{ listingsNew: number; listingsUpdated: number }> {
    let listingsNew = 0
    let listingsUpdated = 0
    const budget = await getStreamEstateBudgetSnapshot()

    if (!budget.syncEnabled) {
        throw new Error('stream_estate_sync_disabled')
    }

    const maxItems = Math.min(
        budget.maxItemsPerSync,
        getAvailableStreamEstateItems(budget),
    )

    if (maxItems < 1) {
        throw new Error('stream_estate_budget_insufficient')
    }

    const result = await fetchListings({
        zipcode,
        propertyTypes: PROPERTY_TYPES,
        maxItems,
        beforeRequest: async () => {
            const allowed = await canSpendStreamEstateItems()
            if (!allowed.ok) {
                throw new StreamEstateRequestLimitError(allowed.reason, allowed.reason)
            }
        },
        onRequest: async (event) => {
            await recordStreamEstateUsageEvent({
                syncRunId: null,
                zipcode,
                endpoint: event.endpoint,
                page: event.page,
                requestStatus: event.requestStatus,
                itemCount: event.itemCount,
                estimatedCostEur: event.itemCount * budget.costPerItemEur,
                startedAt: event.startedAt,
                finishedAt: event.finishedAt,
                errorMessage: event.errorMessage ?? null,
            })
        },
    })

    for (const raw of result.listings) {
        try {
            const upserted = await upsertListing(raw as unknown as Record<string, unknown>)
            if (upserted === 'created') listingsNew++
            else if (upserted === 'updated') listingsUpdated++
        } catch (err) {
            console.error(`Erreur upsert listing ${raw.externalId ?? raw.id}:`, err)
        }
    }

    return { listingsNew, listingsUpdated }
}

// ── Upsert ─────────────────────────────────────────────────

type UpsertResult = 'created' | 'updated' | 'unchanged'

/**
 * Insère ou met à jour une annonce dans la table `listings`.
 * Utilise external_id + source comme clé unique.
 */
async function upsertListing(raw: Record<string, unknown>): Promise<UpsertResult> {
    const externalId = String(raw.externalId ?? raw.id ?? '')

    // Vérifier si le listing existe déjà
    const { data: existing } = await db.listings()
        .select('id, price, status, last_seen_at')
        .eq('external_id', externalId)
        .eq('source', SOURCE)
        .single()

    if (existing) {
        // Mise à jour
        const { error } = await db.listings()
            .update({
                price: Number(raw.price ?? 0) || null,
                title: String(raw.title ?? ''),
                description: String(raw.description ?? ''),
                city: String(raw.city ?? ''),
                zipcode: String(raw.zipcode ?? ''),
                insee_code: String(raw.inseeCode ?? ''),
                lat: Number(raw.lat ?? 0) || null,
                lon: Number(raw.lon ?? 0) || null,
                property_type: String(raw.propertyType ?? ''),
                surface: Number(raw.surface ?? 0) || null,
                land_surface: Number(raw.landSurface ?? 0) || null,
                rooms: Number(raw.rooms ?? 0) || null,
                bedrooms: Number(raw.bedrooms ?? 0) || null,
                dpe: String(raw.dpe ?? ''),
                ges: String(raw.ges ?? ''),
                url: String(raw.url ?? ''),
                images: Array.isArray(raw.images) ? raw.images : [],
                status: mapStatus(String(raw.status ?? 'active')),
                last_seen_at: new Date().toISOString(),
                raw: raw,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)

        if (error) throw error

        // Vérifier si le prix a changé → on devra créer un snapshot + event plus tard
        const priceChanged = Number(raw.price ?? 0) !== Number(existing.price ?? 0)
        return priceChanged ? 'updated' : 'unchanged'
    }

    // Création
    const { error } = await db.listings().insert({
        external_id: externalId,
        source: SOURCE,
        title: String(raw.title ?? ''),
        description: String(raw.description ?? ''),
        city: String(raw.city ?? ''),
        zipcode: String(raw.zipcode ?? ''),
        insee_code: String(raw.inseeCode ?? ''),
        lat: Number(raw.lat ?? 0) || null,
        lon: Number(raw.lon ?? 0) || null,
        property_type: String(raw.propertyType ?? ''),
        price: Number(raw.price ?? 0) || null,
        surface: Number(raw.surface ?? 0) || null,
        land_surface: Number(raw.landSurface ?? 0) || null,
        rooms: Number(raw.rooms ?? 0) || null,
        bedrooms: Number(raw.bedrooms ?? 0) || null,
        dpe: String(raw.dpe ?? ''),
        ges: String(raw.ges ?? ''),
        url: String(raw.url ?? ''),
        images: Array.isArray(raw.images) ? raw.images : [],
        status: mapStatus(String(raw.status ?? 'active')),
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        raw: raw,
    })

    if (error) throw error
    return 'created'
}

// ── Helpers ────────────────────────────────────────────────

function mapStatus(status: string): Listing['status'] {
    const lower = status.toLowerCase()
    if (lower === 'removed' || lower === 'inactive') return 'removed'
    if (lower === 'expired') return 'expired'
    if (lower === 'relisted') return 'relisted'
    return 'active'
}

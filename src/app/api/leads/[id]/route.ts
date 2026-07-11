/**
 * GET    /api/leads/[id]       — Détail d'un lead avec prospect + events
 * PATCH  /api/leads/[id]       — Mise à jour statut / ajout note
 * POST   /api/leads/[id]/resend — Renvoi du magic link (dans route séparée)
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { asNumber, asText, buildSellerPropertyPayload, cleanJson } from '@/lib/leads-crm'

type RouteContext = { params: Promise<{ id: string }> }

// ─── helpers ────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

async function getEnrichedLead(id: string) {
    const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .select(
            `
        *,
        prospect:prospects!leads_prospect_id_fkey (*),
        events:lead_events (*)
      `,
        )
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()

    if (error) throw error
    if (!lead) return null

    const [{ data: sellerProperties }, { data: opportunities }] = await Promise.all([
        supabaseAdmin
            .from('seller_properties')
            .select('*')
            .eq('lead_id', id)
            .order('created_at', { ascending: false })
            .limit(1),
        supabaseAdmin
            .from('opportunities')
            .select('*')
            .eq('lead_id', id)
            .order('created_at', { ascending: false })
            .limit(1),
    ])

    return {
        ...lead,
        seller_property: sellerProperties?.[0] ?? null,
        opportunity: opportunities?.[0] ?? null,
    }
}

// ─── GET /api/leads/[id] ────────────────────────────────────

export async function GET(
    _req: NextRequest,
    context: RouteContext,
): Promise<NextResponse> {
    const { id } = await context.params

    let lead = null
    try {
        lead = await getEnrichedLead(id)
    } catch (error) {
        console.error('[API GET /leads/[id]]', error)
        return NextResponse.json(
            { success: false, error: 'Erreur base de données' },
            { status: 500 },
        )
    }

    if (!lead) {
        return NextResponse.json(
            { success: false, error: 'Lead introuvable' },
            { status: 404 },
        )
    }

    return NextResponse.json({ success: true, data: lead })
}

// ─── PATCH /api/leads/[id] ──────────────────────────────────

export async function PATCH(
    req: NextRequest,
    context: RouteContext,
): Promise<NextResponse> {
    const { id } = await context.params

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { success: false, error: 'JSON invalide' },
            { status: 400 },
        )
    }

    const payload = asRecord(body)
    const { status: newStatus, note, created_by: createdBy } = payload
    const crmUpdate: Record<string, unknown> = {}
    const sellerUpdate: Record<string, unknown> = {}
    const prospectUpdate: Record<string, unknown> = {}

    for (const field of ['source_channel', 'priority', 'next_action', 'due_date', 'follow_up_at', 'commune']) {
        if (field in payload) crmUpdate[field] = asText(payload[field])
    }

    if ('first_name' in payload) prospectUpdate.first_name = asText(payload.first_name) ?? ''
    if ('last_name' in payload) prospectUpdate.last_name = asText(payload.last_name) ?? ''
    if ('email' in payload) prospectUpdate.email = asText(payload.email)
    if ('phone' in payload) prospectUpdate.phone = asText(payload.phone)

    for (const [key, value] of Object.entries(buildSellerPropertyPayload(payload))) {
        if (key in payload || `property_${key}` in payload || key === 'adresse') {
            sellerUpdate[key] = value
        }
    }
    if ('surface' in payload) sellerUpdate.surface = asNumber(payload.surface)
    if ('surface_terrain' in payload) sellerUpdate.surface_terrain = asNumber(payload.surface_terrain)
    if ('nb_pieces' in payload) sellerUpdate.nb_pieces = asNumber(payload.nb_pieces)
    if ('prix_estime' in payload) sellerUpdate.prix_estime = asNumber(payload.prix_estime)

    if (Object.keys(crmUpdate).length > 0 || Object.keys(prospectUpdate).length > 0 || Object.keys(sellerUpdate).length > 0) {
        const { data: existing, error: existingError } = await supabaseAdmin
            .from('leads')
            .select('id, prospect_id, form_data')
            .eq('id', id)
            .single()

        if (existingError || !existing) {
            return NextResponse.json(
                { success: false, error: 'Lead introuvable' },
                { status: 404 },
            )
        }

        if (Object.keys(crmUpdate).length > 0) {
            const { error } = await supabaseAdmin
                .from('leads')
                .update({ ...crmUpdate, updated_at: new Date().toISOString() } as never)
                .eq('id', id)
            if (error) {
                console.error('[API PATCH /leads/[id]] crm:', error)
                return NextResponse.json({ success: false, error: 'Erreur mise à jour lead' }, { status: 500 })
            }
        }

        if (Object.keys(prospectUpdate).length > 0) {
            const { error } = await supabaseAdmin
                .from('prospects')
                .update(prospectUpdate as never)
                .eq('id', existing.prospect_id)
            if (error) {
                console.error('[API PATCH /leads/[id]] prospect:', error)
                return NextResponse.json({ success: false, error: 'Erreur mise à jour contact' }, { status: 500 })
            }
        }

        if (Object.keys(sellerUpdate).length > 0) {
            const { data: sellers } = await supabaseAdmin
                .from('seller_properties')
                .select('id')
                .eq('lead_id', id)
                .order('created_at', { ascending: false })
                .limit(1)

            const sellerPayload = {
                lead_id: id,
                prospect_id: existing.prospect_id,
                ...sellerUpdate,
                actif: true,
            }

            const response = sellers?.[0]
                ? await supabaseAdmin.from('seller_properties').update(sellerPayload as never).eq('id', sellers[0].id)
                : await supabaseAdmin.from('seller_properties').insert(sellerPayload as never)
            if (response.error) {
                console.error('[API PATCH /leads/[id]] seller:', response.error)
                return NextResponse.json({ success: false, error: 'Erreur mise à jour bien vendeur' }, { status: 500 })
            }
        }

        await supabaseAdmin.from('lead_events').insert({
            lead_id: id,
            kind: 'system',
            payload: cleanJson({ text: 'Fiche lead mise à jour' }),
            created_by: typeof createdBy === 'string' ? createdBy : null,
        } as never)

        return NextResponse.json({ success: true, data: await getEnrichedLead(id) })
    }

    // ── Si mise à jour de statut ─────────────────────────────
    if (typeof newStatus === 'string') {
        const VALID_STATUSES = [
            'nouveau', 'contacte', 'r1', 'mandat',
            'sous_compromis', 'vendu', 'perdu',
        ]
        if (!VALID_STATUSES.includes(newStatus)) {
            return NextResponse.json(
                { success: false, error: 'Statut invalide' },
                { status: 400 },
            )
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('leads')
            .update({ status: newStatus as never, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single()

        if (updateError) {
            console.error('[API PATCH /leads/[id]] update status:', updateError)
            return NextResponse.json(
                { success: false, error: 'Erreur mise à jour statut' },
                { status: 500 },
            )
        }

        // Log l'événement de changement de statut
        const { error: eventError } = await supabaseAdmin
            .from('lead_events')
            .insert({
                lead_id: id,
                kind: 'status_change',
                payload: { status: newStatus },
                created_by: typeof createdBy === 'string' ? createdBy : null,
            })

        if (eventError) {
            console.error('[API PATCH /leads/[id]] append event:', eventError)
        }

        return NextResponse.json({ success: true, data: updated })
    }

    // ── Si ajout de note seulement ───────────────────────────
    if (typeof note === 'string' && note.trim().length > 0) {
        const { error: noteError } = await supabaseAdmin
            .from('lead_events')
            .insert({
                lead_id: id,
                kind: 'note',
                payload: { text: note.trim() },
                created_by: typeof createdBy === 'string' ? createdBy : null,
            })

        if (noteError) {
            console.error('[API PATCH /leads/[id]] add note:', noteError)
            return NextResponse.json(
                { success: false, error: 'Erreur ajout note' },
                { status: 500 },
            )
        }

        // Retourner le lead mis à jour
        return NextResponse.json({ success: true, data: await getEnrichedLead(id) })
    }

    return NextResponse.json(
        { success: false, error: 'Rien à mettre à jour. Envoyez status ou note.' },
        { status: 400 },
    )
}

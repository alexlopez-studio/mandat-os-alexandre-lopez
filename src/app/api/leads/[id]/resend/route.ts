/**
 * POST /api/leads/[id]/resend — Renvoie le magic link email au prospect
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { markMagicLinkSent } from '@/lib/leads-repo'
import { sendMagicLinkEmail } from '@/lib/resend'

type RouteContext = { params: Promise<{ id: string }> }

function resolveSiteUrl(): string {
    const env = process.env.NEXT_PUBLIC_SITE_URL
    if (env && env.length > 0) return env.replace(/\/+$/, '')
    return 'https://app.alexandrelopez.fr'
}

export async function POST(
    _req: NextRequest,
    context: RouteContext,
): Promise<NextResponse> {
    const { id } = await context.params

    // Récupérer le lead avec le prospect
    const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .select(
            `
        *,
        prospect:prospects!leads_prospect_id_fkey (*)
      `,
        )
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()

    if (error) {
        console.error('[API POST /leads/[id]/resend] query:', error)
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

    const siteUrl = resolveSiteUrl()
    const magicLinkUrl = `${siteUrl}/resultats/${id}`
    const email = lead.prospect?.email

    if (!email) {
        return NextResponse.json(
            { success: false, error: 'Aucun email renseigné pour ce lead' },
            { status: 400 },
        )
    }

    // Envoyer l'email
    const emailSent = await sendMagicLinkEmail({
        to: email,
        prenom: lead.prospect.first_name ?? null,
        token: id,
        type: lead.tool,
        siteUrl,
    })

    if (!emailSent) {
        console.error('[API POST /leads/[id]/resend] échec envoi email')
        return NextResponse.json(
            { success: false, error: "Échec de l'envoi de l'email" },
            { status: 500 },
        )
    }

    // Marquer l'envoi dans la base
    try {
        await markMagicLinkSent(id)
    } catch (err) {
        console.error('[API POST /leads/[id]/resend] markMagicLinkSent:', err)
    }

    // Logger l'événement de renvoi
    await supabaseAdmin
        .from('lead_events')
        .insert({
            lead_id: id,
            kind: 'magic_link_resent',
            payload: { magicLinkUrl },
        })

    return NextResponse.json({
        success: true,
        magicLinkUrl,
        emailSent: true,
    })
}

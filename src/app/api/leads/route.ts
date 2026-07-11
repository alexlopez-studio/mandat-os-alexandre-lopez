/**
 * POST /api/leads — mode estimation autonome.
 *
 * Priorité actuelle : l'outil d'estimation ne doit plus dépendre de Supabase.
 * La route calcule donc les résultats, renvoie un token utilisable côté front,
 * envoie le magic link en best-effort, sauvegarde une copie Notion si les
 * variables Notion sont configurées et synchronise Attio si le CRM est configuré.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendMagicLinkEmail } from '@/lib/resend'
import {
  computeLeadResults,
  type LeadType,
} from '@/lib/leads/compute-results'
import { saveEstimationToNotion } from '@/lib/notion-estimations'
import { syncLeadToAttio } from '@/lib/attio'
import { logServerConversionEvent } from '@/lib/server-analytics'
import { supabaseAdmin } from '@/lib/supabase'
import { runMatchingForBuyer } from '@/lib/market/matching-engine'
import { createLead, markMagicLinkSent, upsertProspect } from '@/lib/leads-repo'
import { ensureSellerOpportunityForLead } from '@/lib/market/seller-opportunity'
import {
  asNumber,
  asStringArray,
  resolveCommune,
  upsertSellerPropertyForLead,
} from '@/lib/leads-crm'

function isLeadType(value: unknown): value is LeadType {
  return value === 'vendre' || value === 'acheter' || value === 'audit'
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function resolveSiteUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env && env.length > 0) return env.replace(/\/+$/, '')
  try {
    return new URL(req.url).origin
  } catch {
    return 'https://app.alexandrelopez.fr'
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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
  const email = asNonEmptyString(payload.email)
  const rawType = payload.type ?? 'vendre'
  const prenom = asNonEmptyString(payload.prenom)
  const nom = asNonEmptyString(payload.nom)
  const telephone = asNonEmptyString(payload.telephone)
  const optIn = Boolean(payload.opt_in)
  const dryRun = Boolean(payload.dry_run)
  const formData = asRecord(payload.form_data ?? payload)

  if (!email) {
    return NextResponse.json(
      { success: false, error: 'email requis' },
      { status: 400 },
    )
  }

  if (!isLeadType(rawType)) {
    return NextResponse.json(
      { success: false, error: 'type invalide' },
      { status: 400 },
    )
  }

  if (!optIn) {
    return NextResponse.json(
      { success: false, error: 'opt-in RGPD requis' },
      { status: 400 },
    )
  }

  const tool: LeadType = rawType
  const token = asNonEmptyString(payload.token) ?? crypto.randomUUID()
  const siteUrl = resolveSiteUrl(req)

  let results: Record<string, unknown> = {}
  try {
    const computed = await computeLeadResults({ type: tool, formData })
    if (computed && typeof computed === 'object') {
      results = computed as Record<string, unknown>
    }
  } catch (err) {
    console.error('[API /leads] computeLeadResults a échoué :', err)
    logServerConversionEvent('lead_submit_error', {
      lead_type: tool,
      error_step: 'compute_results',
    })
    return NextResponse.json(
      { success: false, error: 'calcul estimation échoué' },
      { status: 500 },
    )
  }

  let magicLinkUrl = `${siteUrl}/resultats/${token}`

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      token,
      leadId: token,
      magicLinkUrl,
      emailSent: false,
      notionBackup: { ok: false, skipped: true, reason: 'dry_run' },
      attioSync: { ok: false, skipped: true, reason: 'dry_run' },
      results,
    })
  }

  let leadId = token
  let prospectId: string | null = null
  try {
    const prospect = await upsertProspect({
      email,
      firstName: prenom,
      lastName: nom,
      phone: telephone ?? null,
    })
    prospectId = prospect.id

    const lead = await createLead({
      id: token,
      prospectId: prospect.id,
      tool,
      formData,
      results,
      commune: resolveCommune(formData),
      sourceChannel: 'estimation_site',
      priority: 'medium',
      nextAction: tool === 'vendre' ? 'Qualifier la demande d’estimation' : null,
    })
    leadId = lead.id
    magicLinkUrl = `${siteUrl}/resultats/${leadId}`
  } catch (err) {
    console.error('[API /leads] sauvegarde Supabase échouée :', err)
    return NextResponse.json(
      { success: false, error: 'sauvegarde lead échouée' },
      { status: 500 },
    )
  }

  // ── Matching : stocker les critères acheteur/vendeur ────────
  if (tool === 'acheter') {
    const buyerData = {
      lead_id: leadId,
      prospect_id: prospectId,
      type_bien: typeof formData.type_bien === 'string' ? formData.type_bien : null,
      communes: asStringArray(formData.communes),
      budget_max: asNumber(formData.budget_max),
      surface_min: asNumber(formData.surface_min),
      pieces_min: asNumber(formData.nb_pieces_min),
      criteres: asStringArray(formData.criteres),
    }

    const { error: bcError } = await supabaseAdmin
      .from('buyer_criteria')
      .upsert(buyerData, { onConflict: 'lead_id', ignoreDuplicates: false })

    if (bcError) {
      console.error('[API /leads] Erreur sauvegarde buyer_criteria:', bcError)
    } else {
      // Lancer le matching en arrière-plan (non bloquant)
      runMatchingForBuyer(buyerData).catch((err) =>
        console.error('[API /leads] Erreur matching acheteur:', err)
      )
    }
  }

  if (tool === 'vendre') {
    try {
      await upsertSellerPropertyForLead({ leadId, prospectId, data: formData })
      await ensureSellerOpportunityForLead(leadId)
    } catch (err) {
      console.error('[API /leads] Erreur opportunité vendeur:', err)
    }
  }

  const [emailSent, notionBackup, attioSync] = await Promise.all([
    sendMagicLinkEmail({
      to: email,
      prenom: prenom ?? null,
      token: leadId,
      type: tool,
      siteUrl,
    }),
    saveEstimationToNotion({
      token: leadId,
      type: tool,
      email,
      prenom,
      nom,
      telephone,
      formData,
      results,
      magicLinkUrl,
    }),
    syncLeadToAttio({
      token: leadId,
      type: tool,
      email,
      prenom,
      nom,
      telephone,
      formData,
      results,
      magicLinkUrl,
    }),
  ])

  if (!notionBackup.ok && !notionBackup.skipped) {
    console.error('[API /leads] sauvegarde Notion échouée :', notionBackup.error)
  }

  if (!attioSync.ok && !attioSync.skipped) {
    console.error('[API /leads] synchronisation Attio échouée :', attioSync.error)
  }

  if (emailSent) {
    try {
      await markMagicLinkSent(leadId)
    } catch (err) {
      console.error('[API /leads] markMagicLinkSent échoué :', err)
    }
  }

  logServerConversionEvent('lead_submit', {
    lead_type: tool,
    email_sent: Boolean(emailSent),
    notion_backup_ok: Boolean(notionBackup.ok),
    notion_backup_skipped: Boolean(notionBackup.skipped),
    attio_sync_ok: Boolean(attioSync.ok),
    attio_sync_skipped: Boolean(attioSync.skipped),
  })

  return NextResponse.json({
    success: true,
    token: leadId,
    leadId,
    magicLinkUrl,
    emailSent,
    notionBackup,
    attioSync,
    results,
  })
}

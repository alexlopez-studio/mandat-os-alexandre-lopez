import { NextRequest, NextResponse } from 'next/server'
import { loadAdminClientDossier, rejectIfNoAdmin } from '@/lib/market/client-admin'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const data = await loadAdminClientDossier(id)
    if (!data) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/market/clients/[id]]', err)
    return NextResponse.json({ success: false, error: 'Erreur lecture dossier client' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const body = asRecord(await req.json())
    const current = await loadAdminClientDossier(id)
    if (!current) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })

    const profilePayload: Record<string, unknown> = {}
    const profile = asRecord(body.profile)
    for (const key of ['first_name', 'last_name', 'email', 'phone', 'is_active']) {
      if (key in profile) profilePayload[key] = normalizeValue(profile[key])
    }

    if (Object.keys(profilePayload).length > 0) {
      const { error } = await supabaseAdmin
        .from('client_profiles')
        .update(profilePayload as never)
        .eq('id', current.dossier.client_profile_id)
      if (error) return NextResponse.json({ success: false, error: 'Erreur mise à jour client' }, { status: 500 })
    }

    const dossierPayload: Record<string, unknown> = {}
    const dossier = asRecord(body.dossier)
    for (const key of ['title', 'status', 'advisor_note']) {
      if (key in dossier) dossierPayload[key] = normalizeValue(dossier[key])
    }
    // Personnalisation espace client (issue du R1) : objet JSON curé + statut draft/published.
    if ('personalization' in dossier) {
      dossierPayload.personalization = asRecord(dossier.personalization) as Json
    }

    const propertySnapshotPatch = 'property_snapshot' in body ? asRecord(body.property_snapshot) : null
    const professionalOpinionPatch = 'professional_opinion' in dossier ? asRecord(dossier.professional_opinion) : null

    if ((propertySnapshotPatch || professionalOpinionPatch) && current.dossier.opportunity_id && current.opportunity) {
      const opportunityPayload: Record<string, unknown> = {}
      if (propertySnapshotPatch) {
        opportunityPayload.property_snapshot = {
          ...asRecord(current.opportunity.property_snapshot),
          ...propertySnapshotPatch,
        } as Json
      }
      if (professionalOpinionPatch) {
        opportunityPayload.professional_opinion = {
          ...asRecord(current.opportunity.professional_opinion),
          ...professionalOpinionPatch,
        } as Json
      }

      const { error } = await supabaseAdmin
        .from('opportunities')
        .update(opportunityPayload as never)
        .eq('id', current.dossier.opportunity_id)
      if (error) {
        console.error('[PATCH /api/market/clients/[id]] opportunity projection:', error)
        return NextResponse.json({ success: false, error: 'Erreur mise à jour affaire' }, { status: 500 })
      }
    } else if (professionalOpinionPatch) {
      dossierPayload.professional_opinion = professionalOpinionPatch
    }

    if (propertySnapshotPatch && (!current.dossier.opportunity_id || !current.opportunity)) {
      dossierPayload.property_snapshot = {
        ...asRecord(current.dossier.property_snapshot),
        ...propertySnapshotPatch,
      } as Json
    }

    if (Object.keys(dossierPayload).length > 0) {
      const { error } = await supabaseAdmin
        .from('client_dossiers')
        .update(dossierPayload as never)
        .eq('id', id)
      if (error) {
        console.error('[PATCH /api/market/clients/[id]] dossier:', error)
        return NextResponse.json({ success: false, error: 'Erreur mise à jour dossier' }, { status: 500 })
      }
    }

    const updated = await loadAdminClientDossier(id)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('[PATCH /api/market/clients/[id]]', err)
    return NextResponse.json({ success: false, error: 'Erreur mise à jour dossier client' }, { status: 500 })
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeValue(value: unknown) {
  if (typeof value === 'string') return value.trim() || null
  return value
}

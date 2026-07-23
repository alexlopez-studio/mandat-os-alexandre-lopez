import { NextResponse } from 'next/server'
import { signClientPortalPreviewToken } from '@/lib/client-portal-preview-token'
import { buildClientPortalPreviewUrl } from '@/lib/client-portal-url'
import { rejectIfNoAdmin } from '@/lib/market/client-admin'
import { DEMO_SCENARIO_LABELS, ensureDemoClientDossier, scenarioFromState } from '@/lib/market/demo-dossier'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

export async function GET() {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  try {
    const { dossierId, opportunityId } = await ensureDemoClientDossier()

    const [{ data: dossier, error: dossierError }, { data: opportunity, error: opportunityError }] = await Promise.all([
      supabaseAdmin.from('client_dossiers').select('title, professional_opinion').eq('id', dossierId).single(),
      supabaseAdmin.from('opportunities').select('stage').eq('id', opportunityId).single(),
    ])

    if (dossierError) throw dossierError
    if (opportunityError) throw opportunityError

    const scenario = scenarioFromState(opportunity.stage, asRecord(dossier.professional_opinion))
    const previewToken = signClientPortalPreviewToken(dossierId)

    return NextResponse.json({
      success: true,
      data: {
        dossierId,
        dossierTitle: dossier.title,
        scenario,
        scenarioLabel: DEMO_SCENARIO_LABELS[scenario],
        previewUrl: buildClientPortalPreviewUrl(previewToken),
      },
    })
  } catch (err) {
    console.error('[GET /api/market/demo/status]', err)
    return NextResponse.json({ success: false, error: 'Impossible de charger le compte de démo' }, { status: 500 })
  }
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json | undefined>) : {}
}

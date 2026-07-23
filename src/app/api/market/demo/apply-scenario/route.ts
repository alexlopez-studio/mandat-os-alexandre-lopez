import { NextRequest, NextResponse } from 'next/server'
import { signClientPortalPreviewToken } from '@/lib/client-portal-preview-token'
import { buildClientPortalPreviewUrl } from '@/lib/client-portal-url'
import { rejectIfNoAdmin } from '@/lib/market/client-admin'
import { applyDemoScenario, DEMO_SCENARIO_LABELS, DEMO_SCENARIOS, type DemoScenario } from '@/lib/market/demo-dossier'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  try {
    const body = (await req.json().catch(() => ({}))) as { scenario?: string }
    const scenario = body.scenario

    if (!scenario || !DEMO_SCENARIOS.includes(scenario as DemoScenario)) {
      return NextResponse.json({ success: false, error: 'Scénario invalide' }, { status: 400 })
    }

    const { dossierId } = await applyDemoScenario(scenario as DemoScenario)
    const previewToken = signClientPortalPreviewToken(dossierId)
    const { data: dossier } = await supabaseAdmin.from('client_dossiers').select('title').eq('id', dossierId).single()

    return NextResponse.json({
      success: true,
      data: {
        dossierId,
        dossierTitle: dossier?.title ?? null,
        scenario,
        scenarioLabel: DEMO_SCENARIO_LABELS[scenario as DemoScenario],
        previewUrl: buildClientPortalPreviewUrl(previewToken),
      },
    })
  } catch (err) {
    console.error('[POST /api/market/demo/apply-scenario]', err)
    return NextResponse.json({ success: false, error: 'Application du scénario impossible' }, { status: 500 })
  }
}

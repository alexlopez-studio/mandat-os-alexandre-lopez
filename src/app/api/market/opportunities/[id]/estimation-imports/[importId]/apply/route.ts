import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { mergeIadReportFromImport } from '@/lib/market/estimation-import'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

type RouteContext = { params: Promise<{ id: string; importId: string }> }

/**
 * POST /api/market/opportunities/[id]/estimation-imports/[importId]/apply
 * Fusionne le payload d'un import d'estimation en attente dans professional_opinion.iad_report
 * de l'opportunité, puis répercute sur le dossier client rattaché (comme PATCH .../opportunities/[id]).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  if (process.env.NODE_ENV === 'production') {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 401 })
  }

  try {
    const { id, importId } = await context.params
    const body = (await req.json().catch(() => ({}))) as { overwrite_editorial?: boolean }

    const { data: importRow, error: importError } = await supabaseAdmin
      .from('estimation_imports')
      .select('id, status, opportunity_id, payload')
      .eq('id', importId)
      .maybeSingle()

    if (importError) throw importError
    if (!importRow) return NextResponse.json({ success: false, error: 'Import introuvable' }, { status: 404 })
    if (importRow.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Import déjà traité' }, { status: 409 })
    }
    if (importRow.opportunity_id && importRow.opportunity_id !== id) {
      return NextResponse.json({ success: false, error: 'Import rattaché à une autre opportunité' }, { status: 409 })
    }

    const { data: opportunity, error: opportunityError } = await supabaseAdmin
      .from('opportunities')
      .select('id, professional_opinion')
      .eq('id', id)
      .maybeSingle()

    if (opportunityError) throw opportunityError
    if (!opportunity) return NextResponse.json({ success: false, error: 'Opportunité introuvable' }, { status: 404 })

    const existingOpinion = asRecord(opportunity.professional_opinion)
    const existingReport = asRecord(existingOpinion.iad_report)
    const payload = asRecord(importRow.payload)

    const nextReport = mergeIadReportFromImport(existingReport, payload, {
      overwriteEditorial: body.overwrite_editorial === true,
    })
    const nextOpinion = { ...existingOpinion, iad_report: nextReport } as Json

    const { error: updateError } = await supabaseAdmin
      .from('opportunities')
      .update({ professional_opinion: nextOpinion } as never)
      .eq('id', id)

    if (updateError) throw updateError

    await syncDossierFromOpportunity(id, nextOpinion)

    const { error: markError } = await supabaseAdmin
      .from('estimation_imports')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        opportunity_id: id,
      } as never)
      .eq('id', importId)

    if (markError) throw markError

    return NextResponse.json({ success: true, data: { professional_opinion: nextOpinion } })
  } catch (err) {
    console.error('[POST .../estimation-imports/[importId]/apply]', err)
    return NextResponse.json({ success: false, error: 'Application impossible' }, { status: 500 })
  }
}

// Miroir de syncDossierFromOpportunity (src/app/api/market/opportunities/[id]/route.ts) :
// répercute property_snapshot/professional_opinion sur le dossier client rattaché.
async function syncDossierFromOpportunity(opportunityId: string, professionalOpinion: Json) {
  const byOpportunity = await supabaseAdmin
    .from('client_dossiers')
    .select('id, property_snapshot, professional_opinion')
    .eq('opportunity_id', opportunityId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (byOpportunity.error && byOpportunity.error.code !== 'PGRST116') throw byOpportunity.error

  const dossier = byOpportunity.data
  if (!dossier) return

  const mergedOpinion = { ...asRecord(dossier.professional_opinion), ...asRecord(professionalOpinion) }

  const { error } = await supabaseAdmin
    .from('client_dossiers')
    .update({ professional_opinion: mergedOpinion as Json } as never)
    .eq('id', dossier.id)
  if (error) console.error('[POST .../estimation-imports/[importId]/apply] sync dossier:', error)
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json | undefined>) : {}
}

import { NextResponse } from 'next/server'
import { loadAdminClientDossier, rejectIfNoAdmin } from '@/lib/market/client-admin'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const current = await loadAdminClientDossier(id)
    if (!current) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })

    const opinion = asRecord(current.dossier.professional_opinion)
    if (!hasPublishableEstimation(opinion)) {
      return NextResponse.json({ success: false, error: 'Complète l’avis de valeur avant publication' }, { status: 409 })
    }

    const publishedOpinion = {
      ...opinion,
      client_portal_published: true,
      client_portal_published_at: new Date().toISOString(),
    } as Json

    const { error: dossierError } = await supabaseAdmin
      .from('client_dossiers')
      .update({ professional_opinion: publishedOpinion } as never)
      .eq('id', id)
    if (dossierError) throw dossierError

    if (current.dossier.opportunity_id) {
      const opportunityOpinion = {
        ...asRecord(current.opportunity?.professional_opinion),
        ...publishedOpinion as Record<string, Json | undefined>,
      } as Json
      const { error: opportunityError } = await supabaseAdmin
        .from('opportunities')
        .update({ professional_opinion: opportunityOpinion } as never)
        .eq('id', current.dossier.opportunity_id)
      if (opportunityError) throw opportunityError
    }

    const updated = await loadAdminClientDossier(id)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/publish-estimation]', err)
    return NextResponse.json({ success: false, error: 'Publication impossible' }, { status: 500 })
  }
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json | undefined> : {}
}

function hasPublishableEstimation(opinion: Record<string, Json | undefined>) {
  return Boolean(
    opinion.price ||
    opinion.price_low ||
    opinion.price_high ||
    opinion.price_suggested ||
    opinion.iad_report ||
    opinion.report
  )
}

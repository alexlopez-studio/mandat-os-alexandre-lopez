import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

type RouteContext = { params: Promise<{ importId: string }> }

/**
 * PATCH /api/estimation-imports/[importId] — rattache un import non lié à une opportunité.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  if (process.env.NODE_ENV === 'production') {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 401 })
  }

  try {
    const { importId } = await context.params
    const body = (await req.json().catch(() => ({}))) as { opportunity_id?: string }
    const opportunityId = body.opportunity_id?.trim()

    if (!opportunityId) {
      return NextResponse.json({ success: false, error: 'opportunity_id requis' }, { status: 400 })
    }

    const { data: importRow, error: importError } = await supabaseAdmin
      .from('estimation_imports')
      .select('id, status')
      .eq('id', importId)
      .maybeSingle()

    if (importError) throw importError
    if (!importRow) return NextResponse.json({ success: false, error: 'Import introuvable' }, { status: 404 })
    if (importRow.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Import déjà traité' }, { status: 409 })
    }

    const { data: opportunity, error: opportunityError } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('id', opportunityId)
      .maybeSingle()

    if (opportunityError) throw opportunityError
    if (!opportunity) return NextResponse.json({ success: false, error: 'Opportunité introuvable' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('estimation_imports')
      .update({ opportunity_id: opportunityId } as never)
      .eq('id', importId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/estimation-imports/[importId]]', err)
    return NextResponse.json({ success: false, error: 'Liaison impossible' }, { status: 500 })
  }
}

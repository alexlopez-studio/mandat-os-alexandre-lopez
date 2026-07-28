import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

type RouteContext = { params: Promise<{ importId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  if (process.env.NODE_ENV === 'production') {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 401 })
  }

  try {
    const { importId } = await context.params
    const body = (await req.json().catch(() => ({}))) as { reviewed_note?: string }

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

    const { error } = await supabaseAdmin
      .from('estimation_imports')
      .update({ status: 'rejected', reviewed_note: body.reviewed_note?.trim() || null } as never)
      .eq('id', importId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/estimation-imports/[importId]/reject]', err)
    return NextResponse.json({ success: false, error: 'Rejet impossible' }, { status: 500 })
  }
}

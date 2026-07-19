import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { mandate_signed_at } = body

    const { error } = await supabaseAdmin
      .from('client_dossiers')
      .update({ mandate_signed_at } as any)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/market/clients/[id]/mandate-signed-at]', error)
    return NextResponse.json(
      { success: false, error: 'Erreur mise à jour date signature' },
      { status: 500 }
    )
  }
}

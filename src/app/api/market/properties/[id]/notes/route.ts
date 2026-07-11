import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/market/properties/:id/notes
 * Ajoute une note libre rattachée à un bien.
 * Body : { note: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const note = typeof body?.note === 'string' ? body.note.trim() : ''

    if (!note) {
      return NextResponse.json({ error: 'note requise (string non vide)' }, { status: 400 })
    }

    // Vérifier que le bien existe
    const { data: property, error: propError } = await supabaseAdmin
      .from('market_properties')
      .select('id')
      .eq('id', id)
      .single()

    if (propError || !property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })
    }

    const { data: created, error } = await supabaseAdmin
      .from('property_notes')
      .insert({ market_property_id: id, note })
      .select()
      .single()

    if (error) {
      console.error('[API /market/properties/:id/notes] POST error:', error)
      return NextResponse.json({ error: 'Erreur création note' }, { status: 500 })
    }

    return NextResponse.json({ note: created }, { status: 201 })
  } catch (e) {
    console.error('[API /market/properties/:id/notes] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

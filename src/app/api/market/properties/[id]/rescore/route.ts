import { NextRequest, NextResponse } from 'next/server'
import { rescoreAndPersist } from '@/lib/market/mandate-score-persist'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/market/properties/:id/rescore
 * Recalcule et persiste le MandateProbabilityScore d'un bien (et émet une
 * alerte si passage hot/golden). Utile pour backfiller les biens existants
 * sans attendre la prochaine sync, ou re-scorer après correction de données.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await rescoreAndPersist(id)

  const { data, error } = await supabaseAdmin
    .from('market_properties')
    .select('id, mandate_score, mandate_phase, scored_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Bien introuvable après rescore' }, { status: 404 })
  }

  return NextResponse.json({ success: true, ...data })
}

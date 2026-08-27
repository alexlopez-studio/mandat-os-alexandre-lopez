import { NextRequest, NextResponse } from 'next/server'
import { getBonDeVisiteById } from '@/lib/bon-de-visite/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bon = await getBonDeVisiteById(id)
    if (!bon) {
      return NextResponse.json({ error: 'Bon de visite introuvable' }, { status: 404 })
    }
    return NextResponse.json({ bon })
  } catch (error) {
    console.error('[API /market/bons-de-visite/[id]] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

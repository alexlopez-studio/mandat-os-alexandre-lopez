import { NextRequest, NextResponse } from 'next/server'
import { getBonDeVisiteByToken } from '@/lib/bon-de-visite/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const bon = await getBonDeVisiteByToken(token)
    if (!bon) {
      return NextResponse.json({ error: 'Bon de visite introuvable' }, { status: 404 })
    }
    return NextResponse.json({ bon })
  } catch (error) {
    console.error('[API /bons-de-visite/public/[token]] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

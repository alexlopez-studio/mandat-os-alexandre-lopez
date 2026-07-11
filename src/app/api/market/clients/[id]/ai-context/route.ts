import { NextResponse } from 'next/server'
import { loadAiDossierContext } from '@/lib/ai/dossier-context'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const data = await loadAiDossierContext(id)
    if (!data) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/market/clients/[id]/ai-context]', err)
    return NextResponse.json({ success: false, error: 'Erreur contexte IA' }, { status: 500 })
  }
}

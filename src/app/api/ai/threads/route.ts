import { NextRequest, NextResponse } from 'next/server'
import { adminDb, isMissingAiSchemaError } from '@/lib/ai/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { data: threads, error } = await adminDb()
      .from('ai_threads')
      .select('id, title, dossier_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      if (isMissingAiSchemaError(error)) return NextResponse.json({ success: true, data: [] })
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true, data: threads ?? [] })
  } catch (err) {
    console.error('[GET /api/ai/threads]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur chargement' }, { status: 500 })
  }
}

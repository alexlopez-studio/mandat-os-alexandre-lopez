import { NextResponse } from 'next/server'
import { getCurrentClientDossier } from '@/lib/client-portal'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const data = await getCurrentClientDossier(supabase)

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Dossier client introuvable' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/client/dossier]', err)
    return NextResponse.json(
      { success: false, error: 'Erreur lecture dossier client' },
      { status: 500 },
    )
  }
}

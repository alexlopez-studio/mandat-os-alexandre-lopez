import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { setSetting } from '@/lib/settings'
import type { Json } from '@/types/supabase'

/**
 * GET /api/market/settings
 * Retourne tous les paramètres sous forme d'objet { [key]: value }.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, updated_at')

    if (error) {
      console.error('[API /market/settings] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]))

    return NextResponse.json({ settings })
  } catch (e) {
    console.error('[API /market/settings] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/market/settings
 * Met à jour un ou plusieurs paramètres : { "mandatfinder_pipeline_enabled": false }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corps invalide : objet { clé: valeur } attendu' }, { status: 400 })
    }

    const entries = Object.entries(body)
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Aucun paramètre fourni' }, { status: 400 })
    }

    for (const [key, value] of entries) {
      await setSetting(key, value as Json)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /market/settings] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

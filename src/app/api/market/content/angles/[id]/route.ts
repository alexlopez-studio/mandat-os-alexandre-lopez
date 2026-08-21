import { NextRequest, NextResponse } from 'next/server'

import { isMachineOrAdmin } from '@/lib/api-machine-auth'
import { ANGLE_WITH_POSTS_SELECT, parseAngleFields } from '@/lib/content-api'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const params = await props.params
    const body = await req.json().catch(() => null)
    const parsed = parseAngleFields(body, 'angle')
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    if (Object.keys(parsed.value).length === 0) {
      return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('content_angles')
      .update(parsed.value)
      .eq('id', params.id)
      .select(ANGLE_WITH_POSTS_SELECT)
      .single()

    if (error || !data) {
      console.error('[API /market/content/angles/[id]] PATCH', error)
      return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (error) {
    console.error('[API /market/content/angles/[id]] PATCH', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

/** Supprime l'angle et, par cascade SQL, toutes ses declinaisons. */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const params = await props.params
    const { error } = await supabaseAdmin.from('content_angles').delete().eq('id', params.id)

    if (error) {
      console.error('[API /market/content/angles/[id]] DELETE', error)
      return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API /market/content/angles/[id]] DELETE', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

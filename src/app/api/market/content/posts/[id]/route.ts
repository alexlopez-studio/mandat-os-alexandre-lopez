import { NextRequest, NextResponse } from 'next/server'

import { isMachineOrAdmin } from '@/lib/api-machine-auth'
import { POST_WITH_ANGLE_SELECT, parsePostFields, type PostUpdate } from '@/lib/content-api'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const params = await props.params
    const body = await req.json().catch(() => null)
    const parsed = parsePostFields(body, 'post')
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const patch: PostUpdate = { ...parsed.value }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
    }

    // `published_at` n'est jamais pilote par le client : c'est le passage du
    // statut a `published` qui l'horodate, et un retour en arriere l'efface.
    if (patch.status === 'published') patch.published_at = new Date().toISOString()
    else if (patch.status) patch.published_at = null

    const { data, error } = await supabaseAdmin
      .from('content_posts')
      .update(patch)
      .eq('id', params.id)
      .select(POST_WITH_ANGLE_SELECT)
      .single()

    if (error || !data) {
      console.error('[API /market/content/posts/[id]] PATCH', error)
      return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (error) {
    console.error('[API /market/content/posts/[id]] PATCH', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const params = await props.params
    const { error } = await supabaseAdmin.from('content_posts').delete().eq('id', params.id)

    if (error) {
      console.error('[API /market/content/posts/[id]] DELETE', error)
      return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API /market/content/posts/[id]] DELETE', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

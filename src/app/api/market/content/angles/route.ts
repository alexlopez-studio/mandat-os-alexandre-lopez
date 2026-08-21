import { NextRequest, NextResponse } from 'next/server'

import { isMachineOrAdmin } from '@/lib/api-machine-auth'
import {
  ANGLE_WITH_POSTS_SELECT,
  MAX_POSTS_PER_ANGLE,
  VALID_ANGLE_STATUSES,
  parseAngleFields,
  parsePostFields,
  text,
  type AngleInsert,
  type PostInsert,
} from '@/lib/content-api'
import { supabaseAdmin } from '@/lib/supabase'
import type { ContentAngleStatus } from '@/types/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/market/content/angles — les angles editoriaux, declinaisons imbriquees.
 *
 * C'est la vue « tout part de la veille » : chaque angle porte l'article dont il
 * decoule et les posts qu'il a produits.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const status = searchParams.get('status')?.trim() ?? ''
    const newsItemId = searchParams.get('news_item_id')?.trim() ?? ''
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('content_angles')
      .select(ANGLE_WITH_POSTS_SELECT, { count: 'exact' })

    if (q) {
      const escaped = q.replace(/[%_]/g, (m) => `\\${m}`)
      query = query.ilike('title', `%${escaped}%`)
    }
    if (status && status !== 'all') {
      if (!VALID_ANGLE_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      query = query.eq('status', status as ContentAngleStatus)
    }
    if (newsItemId) query = query.eq('news_item_id', newsItemId)

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[API /market/content/angles] GET', error)
      return NextResponse.json({ error: 'Erreur lecture angles' }, { status: 500 })
    }

    return NextResponse.json({ items: data ?? [], total: count ?? 0, page, limit })
  } catch (error) {
    console.error('[API /market/content/angles] GET', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/content/angles — cree un angle et ses declinaisons en un appel.
 *
 * Point d'entree de la skill `calendrier-editorial` : Claude lit la veille puis
 * pose ici un sujet avec son planning par canal.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Corps JSON requis' }, { status: 400 })

    const title = text(body.title)
    if (!title) return NextResponse.json({ error: 'title requis' }, { status: 400 })

    const parsedAngle = parseAngleFields(body, 'angle')
    if ('error' in parsedAngle) {
      return NextResponse.json({ error: parsedAngle.error }, { status: 400 })
    }

    const rawPosts = Array.isArray(body.posts) ? body.posts : []
    if (rawPosts.length > MAX_POSTS_PER_ANGLE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_POSTS_PER_ANGLE} déclinaisons par angle` },
        { status: 400 },
      )
    }

    // Les posts sont valides AVANT d'inserer l'angle : sans transaction cote
    // PostgREST, un post invalide laisserait sinon un angle orphelin derriere lui.
    const postFields = []
    for (const [index, raw] of rawPosts.entries()) {
      const parsed = parsePostFields(raw, `posts[${index}]`)
      if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 })
      }
      if (!parsed.value.channel) {
        return NextResponse.json({ error: `posts[${index}].channel requis` }, { status: 400 })
      }
      postFields.push(parsed.value)
    }

    const { data: angle, error: angleError } = await supabaseAdmin
      .from('content_angles')
      .insert(parsedAngle.value as AngleInsert)
      .select('*')
      .single()

    if (angleError || !angle) {
      console.error('[API /market/content/angles] POST', angleError)
      return NextResponse.json({ error: 'Création impossible' }, { status: 500 })
    }

    if (postFields.length > 0) {
      // Les colonnes `not null` a valeur par defaut sont posees explicitement sur
      // CHAQUE ligne : dans une insertion groupee, PostgREST unifie les colonnes
      // du lot et ecrit un NULL explicite la ou une ligne ne fournit rien — le
      // DEFAULT ne s'applique alors pas, et la contrainte saute.
      const rows = postFields.map((fields) => ({
        ...fields,
        angle_id: angle.id,
        channel: fields.channel,
        status: fields.status ?? 'draft',
        created_by: fields.created_by ?? 'claude',
        hashtags: fields.hashtags ?? [],
      })) as PostInsert[]

      const { error: postsError } = await supabaseAdmin.from('content_posts').insert(rows)
      if (postsError) {
        // L'angle seul n'a pas de valeur : on le retire pour ne pas laisser de dechet.
        await supabaseAdmin.from('content_angles').delete().eq('id', angle.id)
        console.error('[API /market/content/angles] POST posts', postsError)
        return NextResponse.json({ error: 'Création des déclinaisons impossible' }, { status: 500 })
      }
    }

    const { data: full } = await supabaseAdmin
      .from('content_angles')
      .select(ANGLE_WITH_POSTS_SELECT)
      .eq('id', angle.id)
      .single()

    return NextResponse.json({ item: full ?? angle }, { status: 201 })
  } catch (error) {
    console.error('[API /market/content/angles] POST', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

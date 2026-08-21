import { NextRequest, NextResponse } from 'next/server'

import { isMachineOrAdmin } from '@/lib/api-machine-auth'
import {
  POST_WITH_ANGLE_SELECT,
  VALID_CHANNELS,
  VALID_POST_STATUSES,
  isoDate,
  parsePostFields,
  text,
  type PostInsert,
} from '@/lib/content-api'
import { supabaseAdmin } from '@/lib/supabase'
import type { ContentChannel, ContentPostStatus } from '@/types/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/market/content/posts — le calendrier.
 *
 * `from` / `to` bornent `scheduled_for` (le mois affiche) ; `unscheduled=1`
 * renvoie a l'inverse ce qui n'est pas encore date, c'est-a-dire la pile
 * « a produire ».
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channel = searchParams.get('channel')?.trim() ?? ''
    const status = searchParams.get('status')?.trim() ?? ''
    const angleId = searchParams.get('angle_id')?.trim() ?? ''
    const unscheduled = searchParams.get('unscheduled') === '1'
    const q = searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 200))
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const offset = (page - 1) * limit

    const from = isoDate(searchParams.get('from'))
    const to = isoDate(searchParams.get('to'))
    if (from === undefined || to === undefined) {
      return NextResponse.json({ error: 'from / to doivent être des dates ISO' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('content_posts')
      .select(POST_WITH_ANGLE_SELECT, { count: 'exact' })

    if (unscheduled) query = query.is('scheduled_for', null)
    if (from) query = query.gte('scheduled_for', from)
    if (to) query = query.lte('scheduled_for', to)

    if (channel && channel !== 'all') {
      if (!VALID_CHANNELS.has(channel)) {
        return NextResponse.json({ error: 'Canal invalide' }, { status: 400 })
      }
      query = query.eq('channel', channel as ContentChannel)
    }
    if (status && status !== 'all') {
      if (!VALID_POST_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      query = query.eq('status', status as ContentPostStatus)
    }
    if (angleId) query = query.eq('angle_id', angleId)
    if (q) {
      const escaped = q.replace(/[%_]/g, (m) => `\\${m}`)
      query = query.ilike('title', `%${escaped}%`)
    }

    const { data, count, error } = await query
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[API /market/content/posts] GET', error)
      return NextResponse.json({ error: 'Erreur lecture calendrier' }, { status: 500 })
    }

    return NextResponse.json({ items: data ?? [], total: count ?? 0, page, limit })
  } catch (error) {
    console.error('[API /market/content/posts] GET', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** POST /api/market/content/posts — ajoute une declinaison a un angle existant. */
export async function POST(req: NextRequest) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Corps JSON requis' }, { status: 400 })

    const angleId = text(body.angle_id)
    if (!angleId) return NextResponse.json({ error: 'angle_id requis' }, { status: 400 })

    const parsed = parsePostFields(body, 'post')
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    if (!parsed.value.channel) {
      return NextResponse.json({ error: 'channel requis' }, { status: 400 })
    }

    const row = { ...parsed.value, angle_id: angleId, channel: parsed.value.channel } as PostInsert

    const { data, error } = await supabaseAdmin
      .from('content_posts')
      .insert(row)
      .select(POST_WITH_ANGLE_SELECT)
      .single()

    if (error || !data) {
      console.error('[API /market/content/posts] POST', error)
      return NextResponse.json({ error: 'Création impossible' }, { status: 500 })
    }

    return NextResponse.json({ item: data }, { status: 201 })
  } catch (error) {
    console.error('[API /market/content/posts] POST', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

type NotificationsUpdate = Database['public']['Tables']['notifications']['Update']

/**
 * GET /api/market/notifications
 * Liste les notifications, triées par date de création décroissante.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const type = searchParams.get('type')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filtres
    if (status) query = query.eq('status', status)
    else query = query.neq('status', 'archived') // par défaut, on masque les archivées
    if (priority) query = query.eq('priority', priority)
    if (type) query = query.eq('type', type)

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: notifications, count, error } = await query

    if (error) {
      console.error('[API /market/notifications] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({
      notifications,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (e) {
    console.error('[API /market/notifications] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/market/notifications
 * Mise à jour groupée de notifications (utile pour marquer plusieurs en "read").
 * Body : { ids: string[], status: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const status = body.status

    if (!status) {
      return NextResponse.json({ error: 'status requis' }, { status: 400 })
    }
    // Deux modes : ids explicites, ou `all:true` (tout marquer, ex. « tout lu »),
    // optionnellement restreint à un `type` (ex. les non-lues uniquement).
    if (body.all !== true && (!Array.isArray(body.ids) || body.ids.length === 0)) {
      return NextResponse.json({ error: 'ids requis (array non vide) ou all:true' }, { status: 400 })
    }

    const updateData: NotificationsUpdate = { status }
    if (status === 'read') {
      updateData.read_at = new Date().toISOString()
    }

    let query = supabaseAdmin.from('notifications').update(updateData)
    if (body.all === true) {
      // Marquer toutes les non-lues (optionnellement filtrées par type).
      query = query.eq('status', 'unread')
      if (body.type) query = query.eq('type', body.type)
    } else {
      query = query.in('id', body.ids)
    }

    const { data, error } = await query.select()

    if (error) {
      console.error('[API /market/notifications] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ notifications: data, updated: data?.length ?? 0 })
  } catch (e) {
    console.error('[API /market/notifications] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
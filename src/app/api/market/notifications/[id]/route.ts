import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

type NotificationsUpdate = Database['public']['Tables']['notifications']['Update']

/**
 * PATCH /api/market/notifications/[id]
 * Met à jour le status d'une notification individuelle.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Vérifier que la notification existe
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Notification introuvable' }, { status: 404 })
    }

    const updateData: NotificationsUpdate = {}

    if (body.status !== undefined) {
      updateData.status = body.status
      if (body.status === 'read') {
        updateData.read_at = new Date().toISOString()
      }
      if (body.status === 'archived') {
        updateData.resolved_at = new Date().toISOString()
      }
    }

    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /market/notifications/[id]] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ notification })
  } catch (e) {
    console.error('[API /market/notifications/[id]] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, OpportunityEventType } from '@/types/supabase'

type OpportunityEventUpdate = Database['public']['Tables']['opportunity_events']['Update']

const VALID_TYPES: OpportunityEventType[] = [
  'note',
  'task',
  'call',
  'meeting',
  'email',
  'stage_change',
  'estimation',
  'system',
]

function asText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asDateTime(value: unknown) {
  if (value === null) return null
  if (typeof value !== 'string' || !value.trim()) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/**
 * PATCH /api/market/opportunities/[id]/events/[eventId]
 * Modifie une activité ou marque une tâche comme terminée.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const { id, eventId } = await params
    const body = await req.json()

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('opportunity_events')
      .select('id, opportunity_id')
      .eq('id', eventId)
      .eq('opportunity_id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
    }

    const update: OpportunityEventUpdate = {}
    const type = asText(body.type) as OpportunityEventType | null
    if (type && VALID_TYPES.includes(type)) update.type = type
    if (body.title !== undefined) update.title = asText(body.title)
    if (body.content !== undefined) update.content = asText(body.content)
    if (body.due_at !== undefined) update.due_at = asDateTime(body.due_at) ?? null
    if (body.occurred_at !== undefined) update.occurred_at = asDateTime(body.occurred_at) ?? undefined
    if (body.completed_at !== undefined) update.completed_at = asDateTime(body.completed_at) ?? null
    if (body.complete === true) update.completed_at = new Date().toISOString()
    if (body.complete === false) update.completed_at = null
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      update.metadata = body.metadata as never
    }

    const { data: event, error } = await supabaseAdmin
      .from('opportunity_events')
      .update(update)
      .eq('id', eventId)
      .eq('opportunity_id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /market/opportunities/[id]/events/[eventId]] PATCH:', error)
      return NextResponse.json({ error: 'Erreur mise à jour activité' }, { status: 500 })
    }

    return NextResponse.json({ event })
  } catch (e) {
    console.error('[API /market/opportunities/[id]/events/[eventId]] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/market/opportunities/[id]/events/[eventId]
 * Supprime une activité de la timeline.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const { id, eventId } = await params

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('opportunity_events')
      .select('id')
      .eq('id', eventId)
      .eq('opportunity_id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('opportunity_events')
      .delete()
      .eq('id', eventId)
      .eq('opportunity_id', id)

    if (error) {
      console.error('[API /market/opportunities/[id]/events/[eventId]] DELETE:', error)
      return NextResponse.json({ error: 'Erreur suppression activité' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API /market/opportunities/[id]/events/[eventId]] DELETE', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

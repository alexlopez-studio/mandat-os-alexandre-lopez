import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, OpportunityEventType } from '@/types/supabase'

type OpportunityEventInsert = Database['public']['Tables']['opportunity_events']['Insert']
type OpportunityUpdate = Database['public']['Tables']['opportunities']['Update']

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
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function asMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * POST /api/market/opportunities/[id]/events
 * Ajoute une activité CRM sur une opportunité.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    const { data: opportunity, error: opportunityError } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('id', id)
      .single()

    if (opportunityError || !opportunity) {
      return NextResponse.json({ error: 'Opportunité introuvable' }, { status: 404 })
    }

    const requestedType = asText(body.type) as OpportunityEventType | null
    const type = requestedType && VALID_TYPES.includes(requestedType) ? requestedType : 'note'
    const title = asText(body.title)
    const content = asText(body.content)
    const dueAt = asDateTime(body.due_at)
    const occurredAt = asDateTime(body.occurred_at)

    if (type === 'task' && !title) {
      return NextResponse.json({ error: 'Titre requis pour une tâche' }, { status: 400 })
    }

    if (type !== 'task' && !title && !content) {
      return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })
    }

    const payload: OpportunityEventInsert = {
      opportunity_id: id,
      type,
      title,
      content,
      due_at: dueAt,
      occurred_at: occurredAt ?? new Date().toISOString(),
      metadata: asMetadata(body.metadata) as never,
      created_by: asText(body.created_by) ?? 'admin',
    }

    const { data: event, error } = await supabaseAdmin
      .from('opportunity_events')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('[API /market/opportunities/[id]/events] POST:', error)
      return NextResponse.json({ error: 'Erreur création activité' }, { status: 500 })
    }

    if (type === 'estimation') {
      const metadata = asMetadata(body.metadata) as { milestone?: unknown }
      const milestone = typeof metadata.milestone === 'string' ? metadata.milestone : null
      const activityDate = occurredAt ?? new Date().toISOString()
      const activityDay = activityDate.slice(0, 10)
      const update: OpportunityUpdate = {}

      if (milestone === 'pre_estimation' || milestone === 'estimation_done') update.pre_estimation_done_at = activityDay
      if (milestone === 'visit') update.visit_at = activityDate
      if (milestone === 'report') update.report_delivered_at = activityDay
      if (milestone === 'follow_up') update.follow_up_at = activityDay

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('opportunities')
          .update(update)
          .eq('id', id)
        if (updateError) {
          console.error('[API /market/opportunities/[id]/events] estimation milestone:', updateError)
        }
      }
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (e) {
    console.error('[API /market/opportunities/[id]/events] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

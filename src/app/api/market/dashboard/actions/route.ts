import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const SOURCES = new Set(['opportunity', 'buyer', 'opportunity_event', 'client_event', 'lead', 'warm_contact'])
const OPERATIONS = new Set(['complete', 'postpone'])

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const actionId = parseText(body.action_id)
    const source = parseText(body.source)
    const operation = parseText(body.operation)
    const dueDate = parseDate(body.due_date)

    if (!actionId || !source || !operation || !SOURCES.has(source) || !OPERATIONS.has(operation)) {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
    }
    if (operation === 'postpone' && !dueDate) {
      return NextResponse.json({ error: 'Date de report requise' }, { status: 400 })
    }

    const response = await updateAction({ actionId, source, operation, dueDate })
    if (response.error) {
      console.error('[PATCH /api/market/dashboard/actions]', response.error)
      return NextResponse.json({ error: 'Erreur mise à jour action' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[PATCH /api/market/dashboard/actions]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function updateAction(input: {
  actionId: string
  source: string
  operation: string
  dueDate: string | null
}) {
  if (input.source === 'opportunity_event') {
    return supabaseAdmin
      .from('opportunity_events')
      .update(
        input.operation === 'complete'
          ? { completed_at: new Date().toISOString() }
          : { due_at: input.dueDate },
      )
      .eq('id', input.actionId)
  }

  if (input.source === 'client_event') {
    return supabaseAdmin
      .from('client_dossier_events')
      .update(
        input.operation === 'complete'
          ? { status: 'done' }
          : { event_date: input.dueDate },
      )
      .eq('id', input.actionId)
  }

  if (input.operation === 'complete' && input.source === 'warm_contact') {
    return supabaseAdmin
      .from('warm_contacts')
      .update({ status: 'contacte', last_contacted_at: new Date().toISOString() })
      .eq('id', input.actionId)
  }

  if (input.operation === 'complete') {
    return { error: new Error('Completion non supportée') }
  }

  if (input.source === 'opportunity') {
    return supabaseAdmin.from('opportunities').update({ due_date: input.dueDate }).eq('id', input.actionId)
  }
  if (input.source === 'buyer') {
    return supabaseAdmin.from('buyer_criteria').update({ due_date: input.dueDate }).eq('lead_id', input.actionId)
  }
  if (input.source === 'lead') {
    return supabaseAdmin.from('leads').update({ due_date: input.dueDate }).eq('id', input.actionId)
  }
  if (input.source === 'warm_contact') {
    return supabaseAdmin.from('warm_contacts').update({ follow_up_date: input.dueDate }).eq('id', input.actionId)
  }

  return { error: new Error('Source non supportée') }
}

function parseText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseDate(value: unknown) {
  if (value === null) return null
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

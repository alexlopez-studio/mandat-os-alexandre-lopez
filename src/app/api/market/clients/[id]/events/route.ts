import { NextRequest, NextResponse } from 'next/server'
import { assertDossierExists, loadAdminClientDossier, rejectIfNoAdmin } from '@/lib/market/client-admin'
import { supabaseAdmin } from '@/lib/supabase'
import type { ClientDossierEventType } from '@/types/supabase'

type RouteContext = { params: Promise<{ id: string }> }
const VALID_TYPES = new Set(['milestone', 'visit', 'offer', 'note', 'document', 'system'])

const VALID_DB_STATUSES = new Set(['todo', 'done', 'blocked', 'info'])

function sanitizeDbStatus(status: string | null): 'todo' | 'done' | 'blocked' | 'info' {
  if (!status) return 'todo'
  if (VALID_DB_STATUSES.has(status)) return status as 'todo' | 'done' | 'blocked' | 'info'
  if (['done', 'accepted', 'completed'].includes(status)) return 'done'
  if (['cancelled', 'declined', 'expired', 'withdrawn', 'blocked'].includes(status)) return 'blocked'
  if (['info', 'postponed', 'counter'].includes(status)) return 'info'
  return 'todo'
}

export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    if (!(await assertDossierExists(id))) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    const body = asRecord(await req.json())
    const title = asText(body.title)
    if (!title) return NextResponse.json({ success: false, error: 'Titre requis' }, { status: 400 })

    const rawStatus = asText(body.status) ?? 'todo'
    const status = sanitizeDbStatus(rawStatus)
    const payload = asRecord(body.payload)
    if (rawStatus !== status && !payload.status_detail) {
      payload.status_detail = rawStatus
    }

    const { error } = await supabaseAdmin
      .from('client_dossier_events')
      .insert({
        dossier_id: id,
        type: parseType(body.type) ?? 'milestone',
        title,
        description: asText(body.description),
        status,
        event_date: asText(body.event_date),
        payload,
        visible_to_client: typeof body.visible_to_client === 'boolean' ? body.visible_to_client : true,
        created_by: 'admin',
      } as never)

    if (error) {
      console.error('[POST /api/market/clients/[id]/events] Supabase insert error:', error)
      return NextResponse.json({ success: false, error: `Erreur ajout jalon: ${error.message}` }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: (await loadAdminClientDossier(id))?.events ?? [] })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/events]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur jalon' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const body = asRecord(await req.json())
    const eventId = asText(body.id)
    if (!eventId) return NextResponse.json({ success: false, error: 'Jalon requis' }, { status: 400 })

    const payload: Record<string, unknown> = {}
    for (const field of ['title', 'description', 'event_date']) {
      if (field in body) payload[field] = asText(body[field])
    }
    if ('status' in body) {
      payload.status = sanitizeDbStatus(asText(body.status))
    }
    if ('type' in body) payload.type = parseType(body.type)
    if ('payload' in body) payload.payload = asRecord(body.payload)
    if ('visible_to_client' in body) payload.visible_to_client = Boolean(body.visible_to_client)

    const { error } = await supabaseAdmin
      .from('client_dossier_events')
      .update(payload as never)
      .eq('id', eventId)
      .eq('dossier_id', id)

    if (error) {
      console.error('[PATCH /api/market/clients/[id]/events] Supabase error:', error)
      return NextResponse.json({ success: false, error: `Erreur mise à jour jalon: ${error.message}` }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: (await loadAdminClientDossier(id))?.events ?? [] })
  } catch (err) {
    console.error('[PATCH /api/market/clients/[id]/events]', err)
    return NextResponse.json({ success: false, error: 'Erreur jalon' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const eventId = new URL(req.url).searchParams.get('id')
    if (!eventId) return NextResponse.json({ success: false, error: 'Jalon requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('client_dossier_events')
      .delete()
      .eq('id', eventId)
      .eq('dossier_id', id)

    if (error) return NextResponse.json({ success: false, error: 'Erreur suppression jalon' }, { status: 500 })
    return NextResponse.json({ success: true, data: (await loadAdminClientDossier(id))?.events ?? [] })
  } catch (err) {
    console.error('[DELETE /api/market/clients/[id]/events]', err)
    return NextResponse.json({ success: false, error: 'Erreur suppression jalon' }, { status: 500 })
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseType(value: unknown): ClientDossierEventType | null {
  if (typeof value !== 'string' || !VALID_TYPES.has(value)) return null
  return value as ClientDossierEventType
}

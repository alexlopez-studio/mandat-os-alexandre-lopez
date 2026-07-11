import { NextRequest, NextResponse } from 'next/server'
import { assertDossierExists, loadDocuments, rejectIfNoAdmin } from '@/lib/market/client-admin'
import { supabaseAdmin } from '@/lib/supabase'
import type { ClientDocumentStatus } from '@/types/supabase'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_STATUSES = new Set(['missing', 'requested', 'uploaded', 'validated', 'rejected'])

export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    if (!(await assertDossierExists(id))) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    const body = asRecord(await req.json())
    const label = asText(body.label)
    if (!label) return NextResponse.json({ success: false, error: 'Libellé requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('client_documents')
      .insert({
        dossier_id: id,
        label,
        category: asText(body.category) ?? 'general',
        status: parseStatus(body.status) ?? 'requested',
        notes: asText(body.notes),
      } as never)

    if (error) return NextResponse.json({ success: false, error: 'Erreur ajout document' }, { status: 500 })
    return NextResponse.json({ success: true, data: await loadDocuments(id) })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/documents]', err)
    return NextResponse.json({ success: false, error: 'Erreur documents' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const body = asRecord(await req.json())
    const documentId = asText(body.id)
    if (!documentId) return NextResponse.json({ success: false, error: 'Document requis' }, { status: 400 })

    const payload: Record<string, unknown> = {}
    if ('label' in body) payload.label = asText(body.label)
    if ('category' in body) payload.category = asText(body.category) ?? 'general'
    if ('notes' in body) payload.notes = asText(body.notes)
    if ('status' in body) {
      const status = parseStatus(body.status)
      if (!status) return NextResponse.json({ success: false, error: 'Statut invalide' }, { status: 400 })
      payload.status = status
      if (status === 'validated') {
        payload.validated_at = new Date().toISOString()
        payload.validated_by = 'admin'
      }
      if (status === 'rejected') {
        payload.validated_at = null
        payload.validated_by = null
      }
    }

    const { error } = await supabaseAdmin
      .from('client_documents')
      .update(payload as never)
      .eq('id', documentId)
      .eq('dossier_id', id)

    if (error) return NextResponse.json({ success: false, error: 'Erreur mise à jour document' }, { status: 500 })
    return NextResponse.json({ success: true, data: await loadDocuments(id) })
  } catch (err) {
    console.error('[PATCH /api/market/clients/[id]/documents]', err)
    return NextResponse.json({ success: false, error: 'Erreur document' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const documentId = new URL(req.url).searchParams.get('id')
    if (!documentId) return NextResponse.json({ success: false, error: 'Document requis' }, { status: 400 })

    const { data: document } = await supabaseAdmin
      .from('client_documents')
      .select('storage_path')
      .eq('id', documentId)
      .eq('dossier_id', id)
      .maybeSingle()

    const { error } = await supabaseAdmin
      .from('client_documents')
      .delete()
      .eq('id', documentId)
      .eq('dossier_id', id)

    if (error) return NextResponse.json({ success: false, error: 'Erreur suppression document' }, { status: 500 })
    if (document?.storage_path) {
      await supabaseAdmin.storage.from('client-documents').remove([document.storage_path])
    }

    return NextResponse.json({ success: true, data: await loadDocuments(id) })
  } catch (err) {
    console.error('[DELETE /api/market/clients/[id]/documents]', err)
    return NextResponse.json({ success: false, error: 'Erreur suppression document' }, { status: 500 })
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseStatus(value: unknown): ClientDocumentStatus | null {
  if (typeof value !== 'string' || !VALID_STATUSES.has(value)) return null
  return value as ClientDocumentStatus
}

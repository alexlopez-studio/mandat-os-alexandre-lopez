import { NextRequest, NextResponse } from 'next/server'
import { assertDossierExists, loadDocuments, rejectIfNoAdmin } from '@/lib/market/client-admin'
import { supabaseAdmin } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    if (!(await assertDossierExists(id))) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })

    const form = await req.formData()
    const file = form.get('file')
    const documentId = asText(form.get('document_id'))
    const label = asText(form.get('label')) ?? 'Document'
    const category = asText(form.get('category')) ?? 'general'

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Fichier requis' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'Fichier trop volumineux' }, { status: 413 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
    const storagePath = `admin/${id}/${crypto.randomUUID()}-${safeName}`
    const upload = await supabaseAdmin
      .storage
      .from('client-documents')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (upload.error) {
      console.error('[POST /api/market/clients/[id]/documents/upload] storage:', upload.error)
      return NextResponse.json({ success: false, error: 'Upload impossible' }, { status: 500 })
    }

    const payload = {
      dossier_id: id,
      label,
      category,
      status: 'uploaded',
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
      uploaded_by_user_id: null,
    }

    const response = documentId
      ? await supabaseAdmin
          .from('client_documents')
          .update(payload as never)
          .eq('id', documentId)
          .eq('dossier_id', id)
      : await supabaseAdmin
          .from('client_documents')
          .insert(payload as never)

    if (response.error) {
      console.error('[POST /api/market/clients/[id]/documents/upload] db:', response.error)
      return NextResponse.json({ success: false, error: 'Document envoyé mais non enregistré' }, { status: 500 })
    }

    await supabaseAdmin.from('client_dossier_events').insert({
      dossier_id: id,
      type: 'document',
      title: `${label} ajouté`,
      description: file.name,
      status: 'done',
      visible_to_client: true,
      created_by: 'admin',
    } as never)

    return NextResponse.json({ success: true, data: await loadDocuments(id) })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/documents/upload]', err)
    return NextResponse.json({ success: false, error: 'Erreur upload admin' }, { status: 500 })
  }
}

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

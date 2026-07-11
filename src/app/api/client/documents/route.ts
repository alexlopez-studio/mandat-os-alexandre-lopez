import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Connexion client requise' },
        { status: 401 },
      )
    }

    const form = await req.formData()
    const dossierId = asText(form.get('dossier_id'))
    const documentId = asText(form.get('document_id'))
    const label = asText(form.get('label')) ?? 'Document'
    const file = form.get('file')

    if (!dossierId || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Document manquant' },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Fichier trop volumineux' },
        { status: 413 },
      )
    }

    if (documentId) {
      const currentDocument = await supabase
        .from('client_documents')
        .select('id, status')
        .eq('id', documentId)
        .eq('dossier_id', dossierId)
        .maybeSingle()

      if (currentDocument.error || !currentDocument.data) {
        return NextResponse.json(
          { success: false, error: 'Document introuvable' },
          { status: 404 },
        )
      }

      if (!['missing', 'requested', 'rejected'].includes(currentDocument.data.status)) {
        return NextResponse.json(
          { success: false, error: 'Ce document est déjà en validation' },
          { status: 409 },
        )
      }
    }

    const dossier = await supabase
      .from('client_dossiers')
      .select('id')
      .eq('id', dossierId)
      .maybeSingle()

    if (dossier.error || !dossier.data) {
      return NextResponse.json(
        { success: false, error: 'Dossier client introuvable' },
        { status: 404 },
      )
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
    const storagePath = `${user.id}/${dossierId}/${crypto.randomUUID()}-${safeName}`

    const upload = await supabase
      .storage
      .from('client-documents')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (upload.error) {
      console.error('[POST /api/client/documents] storage:', upload.error)
      return NextResponse.json(
        { success: false, error: 'Upload impossible' },
        { status: 500 },
      )
    }

    const payload = {
      dossier_id: dossierId,
      label,
      status: 'uploaded',
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by_user_id: user.id,
      uploaded_at: new Date().toISOString(),
    }

    const write = documentId
      ? await supabase
          .from('client_documents')
          .update(payload as never)
          .eq('id', documentId)
          .eq('dossier_id', dossierId)
          .select('*')
          .single()
      : await supabase
          .from('client_documents')
          .insert(payload as never)
          .select('*')
          .single()

    if (write.error) {
      console.error('[POST /api/client/documents] db:', write.error)
      return NextResponse.json(
        { success: false, error: 'Document envoyé mais non enregistré' },
        { status: 500 },
      )
    }

    await supabase
      .from('client_dossier_events')
      .insert({
        dossier_id: dossierId,
        type: 'document',
        title: `${label} déposé`,
        description: file.name,
        status: 'done',
        visible_to_client: true,
        created_by: 'client',
      } as never)

    return NextResponse.json({ success: true, data: write.data })
  } catch (err) {
    console.error('[POST /api/client/documents]', err)
    return NextResponse.json(
      { success: false, error: 'Erreur upload document' },
      { status: 500 },
    )
  }
}

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

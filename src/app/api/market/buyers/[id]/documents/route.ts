import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_FILE_SIZE = 10 * 1024 * 1024

async function getOrCreateDossierId(projectId: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  let findQuery = supabaseAdmin.from('client_dossiers').select('id')

  if (isUuid) {
    findQuery = findQuery.or(`buyer_lead_id.eq.${projectId},opportunity_id.eq.${projectId}`)
  } else {
    findQuery = findQuery.eq('buyer_lead_id', projectId)
  }

  const { data: existing } = await findQuery.order('updated_at', { ascending: false }).maybeSingle()
  if (existing?.id) return existing.id

  // 1. Fetch buyer project details
  let buyerQuery = supabaseAdmin.from('buyer_criteria').select('id, lead_id, prospect_id, type_bien')
  if (isUuid) {
    buyerQuery = buyerQuery.or(`id.eq.${projectId},lead_id.eq.${projectId}`)
  } else {
    buyerQuery = buyerQuery.eq('lead_id', projectId)
  }
  const { data: buyer } = await buyerQuery.maybeSingle()

  // 2. Extract prospect or fallback client info
  let email = 'buyer@mandatos.app'
  let firstName = 'Acquéreur'
  let lastName = 'Projet'

  if (buyer?.prospect_id) {
    const { data: prospect } = await supabaseAdmin
      .from('prospects')
      .select('email, first_name, last_name')
      .eq('id', buyer.prospect_id)
      .maybeSingle()
    if (prospect?.email) {
      email = prospect.email.trim().toLowerCase()
      firstName = prospect.first_name || firstName
      lastName = prospect.last_name || lastName
    }
  }

  // 3. Find or create client_profile (required by client_dossiers)
  let profileId: string | null = null
  const { data: existingProfile } = await supabaseAdmin
    .from('client_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile?.id) {
    profileId = existingProfile.id
  } else {
    const { data: newProfile } = await supabaseAdmin
      .from('client_profiles')
      .upsert({
        email,
        first_name: firstName,
        last_name: lastName,
        is_active: true,
      } as never, { onConflict: 'email' })
      .select('id')
      .single()
    profileId = newProfile?.id || null
  }

  if (!profileId) {
    const { data: fallbackProfile } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .limit(1)
      .maybeSingle()
    profileId = fallbackProfile?.id || null
  }

  if (!profileId) {
    throw new Error('Impossible de trouver ou créer un profil client')
  }

  // 4. Create client_dossier with mandatory client_profile_id
  const { data: created, error } = await supabaseAdmin
    .from('client_dossiers')
    .insert({
      client_profile_id: profileId,
      buyer_lead_id: buyer?.lead_id || (isUuid ? projectId : null),
      opportunity_id: isUuid ? projectId : null,
      title: buyer ? `Dossier Acquéreur - ${buyer.type_bien || 'Achat'}` : 'Dossier Acquéreur',
      status: 'active',
    } as never)
    .select('id')
    .single()

  if (error || !created) {
    console.error('[API /market/buyers/[id]/documents] Failed to create dossier:', error)
    throw new Error('Erreur création dossier client')
  }

  return created.id
}

async function loadDocumentsByDossierId(dossierId: string) {
  const { data, error } = await supabaseAdmin
    .from('client_documents')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const dossierId = await getOrCreateDossierId(id)
    const documents = await loadDocumentsByDossierId(dossierId)

    return NextResponse.json({ success: true, dossier_id: dossierId, documents })
  } catch (e) {
    console.error('[API /market/buyers/[id]/documents] GET exception:', e)
    const msg = e instanceof Error ? e.message : 'Erreur lors du chargement des documents'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const dossierId = await getOrCreateDossierId(id)

    const contentType = req.headers.get('content-type') || ''
    let label = ''
    let category = 'Financement'
    let status = 'requested'
    let file: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      label = (formData.get('label') as string || '').trim()
      category = (formData.get('category') as string || 'Financement').trim()
      status = (formData.get('status') as string || '').trim()
      const rawFile = formData.get('file')
      if (rawFile instanceof File && rawFile.size > 0) {
        file = rawFile
      }
    } else {
      const body = await req.json()
      label = (body.label || '').trim()
      category = (body.category || 'Financement').trim()
      status = (body.status || '').trim()
    }

    if (!label) {
      return NextResponse.json({ error: 'Le libellé du justificatif est requis' }, { status: 400 })
    }

    let storagePath: string | null = null
    let fileName: string | null = null
    let mimeType: string | null = null
    let fileSize: number | null = null

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Fichier trop volumineux (10 Mo max)' }, { status: 413 })
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
      storagePath = `buyer/${dossierId}/${crypto.randomUUID()}-${safeName}`
      const uploadResult = await supabaseAdmin.storage
        .from('client-documents')
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (uploadResult.error) {
        console.error('[API /market/buyers/[id]/documents] Storage upload error:', uploadResult.error)
        return NextResponse.json({ error: 'Erreur lors du téléversement du fichier' }, { status: 500 })
      }

      fileName = file.name
      mimeType = file.type || null
      fileSize = file.size
      if (!status) status = 'uploaded'
    }

    if (!status) status = 'requested'

    const { error: insertError } = await supabaseAdmin
      .from('client_documents')
      .insert({
        dossier_id: dossierId,
        label,
        category,
        status,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: mimeType,
        file_size: fileSize,
        uploaded_at: file ? new Date().toISOString() : null,
      } as never)

    if (insertError) {
      console.error('[API /market/buyers/[id]/documents] POST insert error:', insertError)
      return NextResponse.json({ error: 'Erreur lors de l’enregistrement de la pièce' }, { status: 500 })
    }

    const documents = await loadDocumentsByDossierId(dossierId)
    return NextResponse.json({ success: true, dossier_id: dossierId, documents })
  } catch (e) {
    console.error('[API /market/buyers/[id]/documents] POST exception:', e)
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const dossierId = await getOrCreateDossierId(id)

    const contentType = req.headers.get('content-type') || ''
    let documentId = ''
    let status = ''
    let file: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      documentId = (formData.get('document_id') as string || '').trim()
      status = (formData.get('status') as string || '').trim()
      const rawFile = formData.get('file')
      if (rawFile instanceof File && rawFile.size > 0) {
        file = rawFile
      }
    } else {
      const body = await req.json()
      documentId = (body.document_id || '').trim()
      status = (body.status || '').trim()
    }

    if (!documentId) {
      return NextResponse.json({ error: 'ID du document requis' }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {}

    if (status) {
      updatePayload.status = status
      if (status === 'validated') updatePayload.validated_at = new Date().toISOString()
    }

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Fichier trop volumineux (10 Mo max)' }, { status: 413 })
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
      const storagePath = `buyer/${dossierId}/${crypto.randomUUID()}-${safeName}`
      const uploadResult = await supabaseAdmin.storage
        .from('client-documents')
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (uploadResult.error) {
        console.error('[API /market/buyers/[id]/documents] Storage upload error:', uploadResult.error)
        return NextResponse.json({ error: 'Erreur lors du téléversement du fichier' }, { status: 500 })
      }

      updatePayload.storage_path = storagePath
      updatePayload.file_name = file.name
      updatePayload.mime_type = file.type || null
      updatePayload.file_size = file.size
      updatePayload.uploaded_at = new Date().toISOString()
      if (!status) updatePayload.status = 'uploaded'
    }

    const { error: updateError } = await supabaseAdmin
      .from('client_documents')
      .update(updatePayload as never)
      .eq('id', documentId)
      .eq('dossier_id', dossierId)

    if (updateError) {
      console.error('[API /market/buyers/[id]/documents] PATCH error:', updateError)
      return NextResponse.json({ error: 'Erreur mise à jour document' }, { status: 500 })
    }

    const documents = await loadDocumentsByDossierId(dossierId)
    return NextResponse.json({ success: true, dossier_id: dossierId, documents })
  } catch (e) {
    console.error('[API /market/buyers/[id]/documents] PATCH exception:', e)
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const documentId = searchParams.get('document_id')

    if (!documentId) {
      return NextResponse.json({ error: 'ID du document requis' }, { status: 400 })
    }

    const dossierId = await getOrCreateDossierId(id)

    const { error: deleteError } = await supabaseAdmin
      .from('client_documents')
      .delete()
      .eq('id', documentId)
      .eq('dossier_id', dossierId)

    if (deleteError) {
      console.error('[API /market/buyers/[id]/documents] DELETE error:', deleteError)
      return NextResponse.json({ error: 'Erreur suppression document' }, { status: 500 })
    }

    const documents = await loadDocumentsByDossierId(dossierId)
    return NextResponse.json({ success: true, dossier_id: dossierId, documents })
  } catch (e) {
    console.error('[API /market/buyers/[id]/documents] DELETE exception:', e)
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

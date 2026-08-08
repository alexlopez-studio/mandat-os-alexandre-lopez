import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/auth'
import { upsertCrmProspect } from '@/lib/leads-crm'

/**
 * File de validation des acquéreurs détectés dans la boîte mail.
 *
 *  - GET   : la file, filtrable par statut.
 *  - PATCH : valider (crée le projet d'achat) ou rejeter un candidat.
 *
 * La création du projet vit ici, et non dans le scanner : c'est la validation
 * humaine qui fait entrer une donnée dans le CRM, pas la détection.
 */

export const dynamic = 'force-dynamic'

type CandidateStatus = 'pending' | 'approved' | 'rejected'
const VALID_STATUSES: CandidateStatus[] = ['pending', 'approved', 'rejected']

function isCandidateStatus(value: string): value is CandidateStatus {
  return (VALID_STATUSES as string[]).includes(value)
}

export async function GET(req: NextRequest) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const status = new URL(req.url).searchParams.get('status') ?? 'pending'
  if (status !== 'all' && !isCandidateStatus(status)) {
    return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('buyer_lead_candidates')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(100)

  if (isCandidateStatus(status)) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[API /market/buyer-lead-candidates] GET error:', error)
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 })
  }

  return NextResponse.json({ success: true, candidates: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  const action = body?.action

  if (!id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Requête invalide (id, action)' }, { status: 400 })
  }

  const { data: candidate, error: readError } = await supabaseAdmin
    .from('buyer_lead_candidates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (readError || !candidate) {
    return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })
  }

  const row = candidate as Record<string, any>

  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('buyer_lead_candidates')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        review_note: typeof body.note === 'string' ? body.note : row.review_note,
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Rejet impossible' }, { status: 500 })
    return NextResponse.json({ success: true, status: 'rejected' })
  }

  // Rejouer une validation ne doit pas créer un second projet.
  if (row.created_project_id) {
    return NextResponse.json({ success: true, status: 'approved', projectId: row.created_project_id, already: true })
  }

  try {
    const projectId = await createBuyerProjectFromCandidate(row)

    const { error } = await supabaseAdmin
      .from('buyer_lead_candidates')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        created_project_id: projectId,
      })
      .eq('id', id)

    if (error) {
      // Le projet existe déjà en base : signaler plutôt que de laisser croire
      // à un échec complet, sinon un second clic le dupliquerait.
      console.error('[API /market/buyer-lead-candidates] update after approve:', error)
      return NextResponse.json(
        { error: 'Projet créé mais candidat non mis à jour', projectId },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, status: 'approved', projectId })
  } catch (e) {
    console.error('[API /market/buyer-lead-candidates] approve error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Validation impossible' },
      { status: 500 },
    )
  }
}

/**
 * Reprend la chaîne que le scanner exécutait autrefois lui-même :
 * contact → prospect → projet d'achat → rattachement.
 */
async function createBuyerProjectFromCandidate(row: Record<string, any>): Promise<string> {
  const firstName = row.first_name || 'Acquéreur'
  const lastName = row.last_name || row.portal || ''

  let contactId: string | null = null

  if (row.email) {
    const { data } = await supabaseAdmin.from('contacts').select('id').eq('email', row.email).maybeSingle()
    if (data?.id) contactId = data.id
  }
  if (!contactId && row.phone) {
    const { data } = await supabaseAdmin.from('contacts').select('id').eq('phone', row.phone).maybeSingle()
    if (data?.id) contactId = data.id
  }

  if (!contactId) {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: row.email,
        phone: row.phone,
        source: row.portal,
        types: ['acquereur'],
      })
      .select('id')
      .single()

    if (error) throw new Error(`Création du contact impossible: ${error.message}`)
    contactId = data.id
  }

  const prospect = await upsertCrmProspect({
    email: row.email,
    firstName,
    lastName,
    phone: row.phone,
  }).catch(() => null)

  const criteres = [row.portal, row.subject ? `Email: ${row.subject}` : null].filter(Boolean)

  const { data: project, error: projectError } = await supabaseAdmin
    .from('buyer_criteria')
    .insert({
      prospect_id: prospect?.id || contactId || null,
      type_bien: row.property_type,
      budget_max: row.budget_max,
      communes: row.communes,
      criteres,
      active: true,
      stage: 'Nouveau contact',
      next_action: `Qualifier la demande reçue via ${row.portal ?? 'e-mail'}`,
    })
    .select('id')
    .single()

  if (projectError || !project) {
    throw new Error(`Création du projet d'achat impossible: ${projectError?.message ?? 'erreur inconnue'}`)
  }

  if (contactId) {
    await supabaseAdmin.from('project_contacts').insert({
      contact_id: contactId,
      buyer_criteria_id: project.id,
      role: 'Acquéreur principal',
    })
  }

  return project.id as string
}

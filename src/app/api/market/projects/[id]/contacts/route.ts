import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Contacts rattachés à un projet (co-vendeurs, indivisaires, co-acquéreurs).
 */
async function resolveProjectKind(projectId: string): Promise<'vente' | 'achat'> {
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, kind')
    .eq('id', projectId)
    .maybeSingle()

  if (project?.kind === 'achat' || project?.kind === 'vente') {
    return project.kind
  }

  // Fallback vers les tables opportunités / critères d'achat
  const { data: opp } = await supabaseAdmin
    .from('opportunities')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()

  if (opp) return 'vente'

  const { data: buyer } = await supabaseAdmin
    .from('buyer_criteria')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()

  if (buyer) return 'achat'

  return 'vente'
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params

    // Ordre explicite : il fixe l'ordre des titulaires dans le titre du projet.
    const { data: links, error } = await supabaseAdmin
      .from('project_contacts')
      .select('id, contact_id, role, is_titulaire')
      .or(`opportunity_id.eq.${id},buyer_criteria_id.eq.${id}`)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      console.error('[API /market/projects/[id]/contacts] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    const contactIds = Array.from(new Set((links ?? []).map((link) => link.contact_id)))
    if (contactIds.length === 0) return NextResponse.json({ contacts: [] }, { status: 200 })

    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .in('id', contactIds)

    const contactById = new Map((contacts ?? []).map((contact) => [contact.id, contact]))

    return NextResponse.json(
      {
        contacts: (links ?? [])
          .map((link) => ({
            link_id: link.id,
            role: link.role,
            is_titulaire: link.is_titulaire === true,
            contact: contactById.get(link.contact_id) ?? null,
          }))
          .filter((entry) => entry.contact !== null),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[API /market/projects/[id]/contacts] GET error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const body = await req.json()
    const contactId = typeof body.contact_id === 'string' ? body.contact_id : null
    const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'Contact'

    if (!contactId) {
      return NextResponse.json({ error: 'contact_id est requis' }, { status: 400 })
    }

    const kind = await resolveProjectKind(id)

    const { data: siblings } = await supabaseAdmin
      .from('project_contacts')
      .select('id, contact_id')
      .or(`opportunity_id.eq.${id},buyer_criteria_id.eq.${id}`)

    if ((siblings ?? []).some((link) => link.contact_id === contactId)) {
      return NextResponse.json({ error: 'Ce contact est déjà rattaché au projet' }, { status: 409 })
    }

    // Titulaire = figure sur le titre de propriete (vente) ou signera l'acte
    // (achat). Seuls les titulaires composent le titre affiche du projet, d'ou
    // le defaut : le premier contact rattache l'est, les suivants demandent un
    // geste explicite pour que le notaire ou le mandataire n'y entre pas seul.
    const isTitulaire =
      typeof body.is_titulaire === 'boolean' ? body.is_titulaire : (siblings ?? []).length === 0

    const link = kind === 'achat' ? { buyer_criteria_id: id } : { opportunity_id: id }

    const { data: created, error } = await supabaseAdmin
      .from('project_contacts')
      .insert({ contact_id: contactId, role, is_titulaire: isTitulaire, ...link })
      .select('id, contact_id, role, is_titulaire')
      .single()

    if (error || !created) {
      console.error('[API /market/projects/[id]/contacts] POST error:', error)
      return NextResponse.json({ error: 'Erreur lors du rattachement' }, { status: 500 })
    }

    return NextResponse.json({ link: created }, { status: 201 })
  } catch (error) {
    console.error('[API /market/projects/[id]/contacts] POST error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

/**
 * PATCH : designer ou retirer un titulaire apres coup, sans avoir a detacher
 * puis rattacher le contact. Le titre du projet suit a la lecture suivante.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const body = await req.json()
    const contactId = typeof body.contact_id === 'string' ? body.contact_id : null
    const isTitulaire = typeof body.is_titulaire === 'boolean' ? body.is_titulaire : null

    if (!contactId || isTitulaire === null) {
      return NextResponse.json(
        { error: 'contact_id et is_titulaire sont requis' },
        { status: 400 }
      )
    }

    const { data: updated, error } = await supabaseAdmin
      .from('project_contacts')
      .update({ is_titulaire: isTitulaire })
      .eq('contact_id', contactId)
      .or(`opportunity_id.eq.${id},buyer_criteria_id.eq.${id}`)
      .select('id, contact_id, role, is_titulaire')
      .maybeSingle()

    if (error) {
      console.error('[API /market/projects/[id]/contacts] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Contact non rattaché à ce projet' }, { status: 404 })
    }

    return NextResponse.json({ link: updated }, { status: 200 })
  } catch (error) {
    console.error('[API /market/projects/[id]/contacts] PATCH error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const { searchParams } = new URL(req.url)
    const contactId = searchParams.get('contact_id')

    if (!contactId) {
      return NextResponse.json({ error: 'contact_id est requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('project_contacts')
      .delete()
      .eq('contact_id', contactId)
      .or(`opportunity_id.eq.${id},buyer_criteria_id.eq.${id}`)

    if (error) {
      console.error('[API /market/projects/[id]/contacts] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur lors du détachement' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('[API /market/projects/[id]/contacts] DELETE error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

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

    const { data: links, error } = await supabaseAdmin
      .from('project_contacts')
      .select('id, contact_id, role')
      .or(`opportunity_id.eq.${id},buyer_criteria_id.eq.${id}`)

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

    const { data: existing } = await supabaseAdmin
      .from('project_contacts')
      .select('id')
      .eq('contact_id', contactId)
      .or(`opportunity_id.eq.${id},buyer_criteria_id.eq.${id}`)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Ce contact est déjà rattaché au projet' }, { status: 409 })
    }

    const link = kind === 'achat' ? { buyer_criteria_id: id } : { opportunity_id: id }

    const { data: created, error } = await supabaseAdmin
      .from('project_contacts')
      .insert({ contact_id: contactId, role, ...link })
      .select('id, contact_id, role')
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

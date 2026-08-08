import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildProjectTitle,
  isProjectActive,
  isProjectKind,
  type ProjectKind,
} from '@/lib/project-stages'

export const dynamic = 'force-dynamic'

const PROJECT_FIELDS =
  'id, kind, title, stage, priority, next_action, due_date, property_city, property_type, type_bien, budget_max, estimated_price_min, estimated_price_max, seller_name, communes, lead_id, active, created_at, updated_at'

type ProjectContact = {
  id: string
  name: string
  last_name: string | null
  email: string | null
  phone: string | null
  role: string | null
}

/**
 * Le lien projet <-> contact passe encore par les colonnes historiques
 * `opportunity_id` / `buyer_criteria_id`, dont les ids sont ceux de `projects`
 * (voir migrations 034 et 036).
 */
async function loadContactsByProject(projectIds: string[]): Promise<Map<string, ProjectContact[]>> {
  const byProject = new Map<string, ProjectContact[]>()
  if (projectIds.length === 0) return byProject

  const { data: links, error: linksError } = await supabaseAdmin
    .from('project_contacts')
    .select('contact_id, opportunity_id, buyer_criteria_id, role')

  if (linksError) {
    console.error('[API /market/projects] project_contacts error:', linksError)
    return byProject
  }

  const wanted = new Set(projectIds)
  const relevant = (links ?? [])
    .map((link) => ({
      projectId: link.opportunity_id ?? link.buyer_criteria_id,
      contactId: link.contact_id,
      role: link.role,
    }))
    .filter((link): link is { projectId: string; contactId: string; role: string } =>
      Boolean(link.projectId) && wanted.has(link.projectId as string)
    )

  const contactIds = Array.from(new Set(relevant.map((link) => link.contactId)))
  if (contactIds.length === 0) return byProject

  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from('contacts')
    .select('id, first_name, last_name, email, phone')
    .in('id', contactIds)

  if (contactsError) {
    console.error('[API /market/projects] contacts error:', contactsError)
    return byProject
  }

  const contactById = new Map((contacts ?? []).map((contact) => [contact.id, contact]))

  for (const link of relevant) {
    const contact = contactById.get(link.contactId)
    if (!contact) continue
    const name =
      [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact sans nom'
    const list = byProject.get(link.projectId) ?? []
    list.push({
      id: contact.id,
      name,
      last_name: contact.last_name || null,
      email: contact.email,
      phone: contact.phone,
      role: link.role,
    })
    byProject.set(link.projectId, list)
  }

  return byProject
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()
    const kind = searchParams.get('kind') ?? 'all'
    const activeFilter = searchParams.get('active') ?? 'all'
    const includeTest = searchParams.get('includeTest') === 'true'

    let query = supabaseAdmin
      .from('projects')
      .select(PROJECT_FIELDS)
      .order('created_at', { ascending: false })
      .limit(500)

    if (!includeTest) query = query.eq('is_test', false)
    if (isProjectKind(kind)) query = query.eq('kind', kind)

    const { data: projects, error } = await query

    if (error) {
      console.error('[API /market/projects] error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    const rows = projects ?? []
    const contactsByProject = await loadContactsByProject(rows.map((row) => row.id))

    const enriched = rows.map((row) => {
      const contacts = contactsByProject.get(row.id) ?? []
      const kind = row.kind as ProjectKind
      // `seller_name` reste le repli pour les projets non encore relies a un contact.
      const contactName = contacts[0]?.name ?? row.seller_name ?? null

      const displayTitle = buildProjectTitle({
        contactLastNames: contacts.map((contact) => contact.last_name),
        contactName,
        propertyType: kind === 'vente' ? row.property_type : row.type_bien,
      })

      return {
        ...row,
        kind,
        contacts,
        contact_name: contactName,
        contact_id: contacts[0]?.id ?? null,
        // Nomenclature imposee (docs/DESIGN.md n'en parle pas : c'est une regle metier).
        display_title: displayTitle,
      }
    })

    const filtered = enriched.filter((row) => {
      const active = isProjectActive(row.stage, row.kind, row.active)
      if (activeFilter === 'active' && !active) return false
      if (activeFilter === 'paused' && active) return false

      if (!search) return true
      const haystack = [
        row.title,
        row.display_title,
        row.stage,
        row.property_city,
        row.property_type,
        row.next_action,
        row.contact_name,
        ...(row.communes ?? []),
        ...row.contacts.flatMap((contact) => [contact.name, contact.email, contact.phone]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })

    return NextResponse.json({ projects: filtered, total: filtered.length }, { status: 200 })
  } catch (error) {
    console.error('[API /market/projects] error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

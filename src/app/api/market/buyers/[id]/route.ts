/**
 * GET /api/market/buyers/[id] — Détail d'un acheteur
 * PUT /api/market/buyers/[id] — Modifier un acheteur
 * DELETE /api/market/buyers/[id] — Soft-delete (désactiver) un acheteur
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureClientDossierForBuyer } from '@/lib/client-portal'
import { buildProjectTitle } from '@/lib/project-stages'

const BUYER_STAGES = [
  'Nouveau contact',
  'Recherche qualifiée',
  'Matching à faire',
  'Biens proposés',
  'Visites',
  'Offre en cours',
  'Mandat de recherche signé',
  'Achat conclu',
  'Pause / Perdu',
] as const

const SIGNED_BUYER_MANDATE_STAGE = 'Mandat de recherche signé'

function parseStage(value: unknown): string | undefined {
  return typeof value === 'string' && BUYER_STAGES.includes(value as typeof BUYER_STAGES[number])
    ? value
    : undefined
}

function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let query = supabaseAdmin.from('buyer_criteria').select('*')
    if (isUuid) {
      query = query.or(`id.eq.${id},lead_id.eq.${id}`)
    } else {
      query = query.eq('lead_id', id)
    }

    const { data: buyer, error } = await query.maybeSingle()

    if (error) {
      console.error('[API /market/buyers/[id]] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    if (!buyer) {
      return NextResponse.json({ error: 'Acheteur non trouvé' }, { status: 404 })
    }

    const projectId = buyer.id

    // `buyer_criteria` est une vue sur `projects` qui n'expose pas
    // `market_property_id` : on va le chercher sur la table source, dont l'id
    // est le même que celui du projet acquéreur.
    const { data: projectRow } = await supabaseAdmin
      .from('projects')
      .select('market_property_id')
      .eq('id', projectId)
      .maybeSingle()

    const marketPropertyId = projectRow?.market_property_id ?? null

    const [linksRes, eventsRes, clientDossier, propertyRes] = await Promise.all([
      supabaseAdmin
        .from('project_contacts')
        // Ordre explicite : il fixe l'ordre des titulaires dans le titre.
        .select('contact_id, role, is_titulaire')
        .or(`buyer_criteria_id.eq.${projectId},opportunity_id.eq.${projectId}`)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      supabaseAdmin
        .from('activities')
        .select('*')
        .eq('opportunity_id', projectId)
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false }),
      loadBuyerClientDossierLink(buyer.lead_id || projectId),
      marketPropertyId
        ? supabaseAdmin
            .from('market_properties')
            .select('id, title, city, zipcode, price, surface, rooms, property_type, url')
            .eq('id', marketPropertyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const links = linksRes.data ?? []
    const contactIds = Array.from(new Set(links.map((l) => l.contact_id)))

    let contacts: any[] = []
    if (contactIds.length > 0) {
      const { data: contactRows } = await supabaseAdmin
        .from('contacts')
        .select('id, first_name, last_name, email, phone')
        .in('id', contactIds)

      const contactById = new Map((contactRows ?? []).map((c) => [c.id, c]))
      contacts = links.map((l) => {
        const c = contactById.get(l.contact_id)
        return {
          id: l.contact_id,
          name: [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || 'Contact sans nom',
          last_name: c?.last_name || null,
          email: c?.email || null,
          phone: c?.phone || null,
          role: l.role,
          is_titulaire: l.is_titulaire === true,
        }
      })
    }

    const events = eventsRes.data ?? []

    const displayTitle = buildProjectTitle({
      titulaireLastNames: contacts.filter((c) => c.is_titulaire).map((c) => c.last_name),
      city: (buyer.communes ?? [])[0] ?? null,
    })

    return NextResponse.json({
      buyer: {
        ...buyer,
        project_contacts: contacts,
        display_title: displayTitle,
      },
      contacts,
      events,
      property: propertyRes.data ?? null,
      client_dossier: clientDossier,
    })
  } catch (e) {
    console.error('[API /market/buyers/[id]] GET exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function loadBuyerClientDossierLink(buyerKey: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerKey)
  let query = supabaseAdmin
    .from('client_dossiers')
    .select('id, status')
  if (isUuid) {
    query = query.or(`buyer_lead_id.eq.${buyerKey},opportunity_id.eq.${buyerKey}`)
  } else {
    query = query.eq('buyer_lead_id', buyerKey)
  }

  const { data: dossier, error } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') throw error
  if (!dossier) return null

  const { data: docs, error: docsError } = await supabaseAdmin
    .from('client_documents')
    .select('status')
    .eq('dossier_id', dossier.id)
  if (docsError && docsError.code !== 'PGRST205' && docsError.code !== '42P01') throw docsError

  const rows = (docs ?? []) as { status: string }[]
  return {
    id: dossier.id,
    status: dossier.status,
    documents_total: rows.length,
    documents_validated: rows.filter((doc) => doc.status === 'validated').length,
    documents_missing: rows.filter((doc) => ['missing', 'requested', 'rejected'].includes(doc.status)).length,
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { type_bien, communes, budget_max, surface_min, pieces_min, criteres, active } = body

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let findQuery = supabaseAdmin.from('buyer_criteria').select('id, lead_id')
    if (isUuid) {
      findQuery = findQuery.or(`id.eq.${id},lead_id.eq.${id}`)
    } else {
      findQuery = findQuery.eq('lead_id', id)
    }
    const { data: targetBuyer, error: findError } = await findQuery.maybeSingle()

    if (findError || !targetBuyer) {
      return NextResponse.json({ error: 'Acheteur non trouvé' }, { status: 404 })
    }

    const updateData: {
      type_bien?: string | null
      communes?: string[] | null
      budget_max?: number | null
      surface_min?: number | null
      pieces_min?: number | null
      criteres?: string[] | null
      active?: boolean
      stage?: string
      next_action?: string | null
      due_date?: string | null
    } = {}

    if (type_bien !== undefined) updateData.type_bien = type_bien
    if (communes !== undefined) updateData.communes = communes
    if (budget_max !== undefined) updateData.budget_max = budget_max
    if (surface_min !== undefined) updateData.surface_min = surface_min
    if (pieces_min !== undefined) updateData.pieces_min = pieces_min
    if (criteres !== undefined) updateData.criteres = criteres
    if (active !== undefined) updateData.active = active
    if (body.stage !== undefined) {
      const stage = parseStage(body.stage)
      if (!stage) {
        return NextResponse.json({ error: 'Statut acquéreur invalide' }, { status: 400 })
      }
      if (stage === SIGNED_BUYER_MANDATE_STAGE) {
        const canCreate = await buyerHasClientEmail(targetBuyer.lead_id || targetBuyer.id)
        if (!canCreate) {
          return NextResponse.json(
            { error: 'Email acquéreur requis avant création du dossier client.' },
            { status: 409 }
          )
        }
      }
      updateData.stage = stage
    }
    if (body.next_action !== undefined) updateData.next_action = parseText(body.next_action)
    if (body.due_date !== undefined) updateData.due_date = parseText(body.due_date)

    if (body.market_property_id !== undefined) {
      await supabaseAdmin
        .from('projects')
        .update({ market_property_id: body.market_property_id || null })
        .eq('id', targetBuyer.id)
    }

    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('buyer_criteria')
        .update(updateData)
        .eq('id', targetBuyer.id)
        .select()
        .single()

      if (error) {
        console.error('[API /market/buyers/[id]] PUT error:', error)
        return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
      }

      let clientDossier = null
      if (data.stage === SIGNED_BUYER_MANDATE_STAGE) {
        const result = await ensureClientDossierForBuyer(targetBuyer.lead_id || targetBuyer.id)
        clientDossier = result.dossier
      }

      return NextResponse.json({ buyer: data, client_dossier: clientDossier, success: true })
    }

    const { data: currentBuyer } = await supabaseAdmin
      .from('buyer_criteria')
      .select('*')
      .eq('id', targetBuyer.id)
      .single()

    return NextResponse.json({ buyer: currentBuyer, success: true })
  } catch (e) {
    console.error('[API /market/buyers/[id]] PUT exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function buyerHasClientEmail(buyerKey: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerKey)
  let query = supabaseAdmin.from('buyer_criteria').select('id, lead_id, prospect_id')
  if (isUuid) {
    query = query.or(`id.eq.${buyerKey},lead_id.eq.${buyerKey}`)
  } else {
    query = query.eq('lead_id', buyerKey)
  }

  const { data: buyer, error } = await query.maybeSingle()

  if (error || !buyer) return false

  if (buyer.prospect_id) {
    const { data: prospect } = await supabaseAdmin
      .from('prospects')
      .select('email')
      .eq('id', buyer.prospect_id)
      .maybeSingle()
    if (prospect?.email) return true
  }

  if (buyer.lead_id) {
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('prospect:prospects!leads_prospect_id_fkey(email)')
      .eq('id', buyer.lead_id)
      .maybeSingle()

    const record = lead as { prospect?: { email?: string | null } | null } | null
    if (record?.prospect?.email) return true
  }

  const { data: pc } = await supabaseAdmin
    .from('project_contacts')
    .select('contact:contacts(email)')
    .eq('buyer_criteria_id', buyer.id)
    .maybeSingle()
  const contactRecord = pc as { contact?: { email?: string | null } | null } | null
  return Boolean(contactRecord?.contact?.email)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let findQuery = supabaseAdmin.from('buyer_criteria').select('id, lead_id')
    if (isUuid) {
      findQuery = findQuery.or(`id.eq.${id},lead_id.eq.${id}`)
    } else {
      findQuery = findQuery.eq('lead_id', id)
    }
    const { data: targetBuyer, error: findError } = await findQuery.maybeSingle()

    if (findError || !targetBuyer) {
      return NextResponse.json({ error: 'Acheteur non trouvé' }, { status: 404 })
    }

    // Suppression définitive du projet d'achat
    const { error: deleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', targetBuyer.id)

    if (deleteError) {
      console.error('[API /market/buyers/[id]] DELETE error:', deleteError)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API /market/buyers/[id]] DELETE exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * GET /api/market/buyers — Liste tous les acheteurs (buyer_criteria)
 * POST /api/market/buyers — Crée un nouvel acheteur
 *
 * Query params (GET) :
 *   search   — Filtre par type_bien, lead_id ou commune
 *   active   — Filtre par statut actif (true | false | all)
 *   limit    — Nombre max de résultats (défaut: 100)
 *   offset   — Pagination (défaut: 0)
 *
 * Body (POST) :
 *   type_bien   — Type de bien recherché
 *   communes    — Tableau de communes
 *   budget_max  — Budget maximum
 *   surface_min — Surface minimum
 *   pieces_min  — Nombre de pièces minimum
 *   criteres    — Critères additionnels (tableau de strings)
 *   active      — Statut actif (défaut: true)
 *   stage       — Statut Kanban acquéreur (défaut: Nouveau contact)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { runMatchingForBuyer } from '@/lib/market/matching-engine'
import { upsertCrmProspect } from '@/lib/leads-crm'
import crypto from 'crypto'

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

function parseStage(value: unknown): string {
  return typeof value === 'string' && BUYER_STAGES.includes(value as typeof BUYER_STAGES[number])
    ? value
    : 'Nouveau contact'
}

function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim()
    const activeFilter = searchParams.get('active') ?? 'true'
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 100))
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

    let query = supabaseAdmin
      .from('buyer_criteria')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filtre par statut actif
    if (activeFilter === 'true') {
      query = query.eq('active', true)
    } else if (activeFilter === 'false') {
      query = query.eq('active', false)
    }

    // Recherche textuelle
    if (search) {
      query = query.or(
        `type_bien.ilike.%${search}%,lead_id.ilike.%${search}%,communes.cs.{${search}}`
      )
    }

    const { data: buyers, error, count } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[API /market/buyers] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({
      buyers: buyers ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (e) {
    console.error('[API /market/buyers] GET exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type_bien, communes, budget_max, surface_min, pieces_min, criteres, active } = body
    const email = parseText(body.email)?.toLowerCase() ?? null
    const firstName = parseText(body.first_name)
    const lastName = parseText(body.last_name)
    const phone = parseText(body.phone)
    const existingLeadId = parseText(body.lead_id)
    let prospectId = parseText(body.prospect_id)

    // Validation basique
    if (!type_bien && !communes?.length && !budget_max && !email && !phone && !firstName && !lastName && !existingLeadId && !prospectId) {
      return NextResponse.json(
        { error: 'Au moins un contact ou un critère est requis' },
        { status: 400 }
      )
    }

    const lead_id = existingLeadId ?? `admin_${crypto.randomUUID()}`

    const { data: existingBuyer, error: existingBuyerError } = await supabaseAdmin
      .from('buyer_criteria')
      .select('*')
      .eq('lead_id', lead_id)
      .maybeSingle()

    if (existingBuyerError) {
      console.error('[API /market/buyers] existing lookup error:', existingBuyerError)
      return NextResponse.json({ error: 'Erreur vérification acquéreur existant' }, { status: 500 })
    }

    if (existingBuyer) {
      return NextResponse.json({ buyer: existingBuyer, success: true, existing: true })
    }

    if (existingLeadId && !prospectId) {
      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('prospect_id')
        .eq('id', existingLeadId)
        .is('deleted_at', null)
        .maybeSingle()

      if (leadError) {
        console.error('[API /market/buyers] lead lookup error:', leadError)
        return NextResponse.json({ error: 'Erreur lecture contact existant' }, { status: 500 })
      }
      prospectId = lead?.prospect_id ?? null
    }

    const prospect = !prospectId && (email || phone || firstName || lastName)
      ? await upsertCrmProspect({
          email,
          firstName,
          lastName,
          phone,
        })
      : null

    const buyerData = {
      lead_id,
      prospect_id: prospectId ?? prospect?.id ?? null,
      type_bien: typeof type_bien === 'string' ? type_bien : null,
      communes: Array.isArray(communes) ? communes : null,
      budget_max: typeof budget_max === 'number' ? budget_max : null,
      surface_min: typeof surface_min === 'number' ? surface_min : null,
      pieces_min: typeof pieces_min === 'number' ? pieces_min : null,
      criteres: Array.isArray(criteres) ? criteres : null,
      active: active !== false, // défaut: true
      stage: parseStage(body.stage),
      next_action: parseText(body.next_action),
      due_date: parseText(body.due_date),
    }

    const { data, error } = await supabaseAdmin
      .from('buyer_criteria')
      .insert(buyerData)
      .select()
      .single()

    if (error) {
      console.error('[API /market/buyers] POST error:', error)
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
    }

    // Lancer le matching en arrière-plan (non bloquant)
    runMatchingForBuyer(buyerData).catch((err) =>
      console.error('[API /market/buyers] Erreur matching:', err)
    )

    return NextResponse.json({ buyer: data, success: true }, { status: 201 })
  } catch (e) {
    console.error('[API /market/buyers] POST exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

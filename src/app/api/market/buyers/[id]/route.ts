/**
 * GET /api/market/buyers/[id] — Détail d'un acheteur
 * PUT /api/market/buyers/[id] — Modifier un acheteur
 * DELETE /api/market/buyers/[id] — Soft-delete (désactiver) un acheteur
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureClientDossierForBuyer } from '@/lib/client-portal'

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

    const { data: buyer, error } = await supabaseAdmin
      .from('buyer_criteria')
      .select('*')
      .eq('lead_id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Acheteur non trouvé' }, { status: 404 })
      }
      console.error('[API /market/buyers/[id]] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    const clientDossier = await loadBuyerClientDossierLink(id)

    return NextResponse.json({ buyer, client_dossier: clientDossier })
  } catch (e) {
    console.error('[API /market/buyers/[id]] GET exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function loadBuyerClientDossierLink(buyerLeadId: string) {
  const { data: dossier, error } = await supabaseAdmin
    .from('client_dossiers')
    .select('id, status')
    .eq('buyer_lead_id', buyerLeadId)
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
        const canCreate = await buyerHasClientEmail(id)
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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('buyer_criteria')
      .update(updateData)
      .eq('lead_id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Acheteur non trouvé' }, { status: 404 })
      }
      console.error('[API /market/buyers/[id]] PUT error:', error)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    let clientDossier = null
    if (data.stage === SIGNED_BUYER_MANDATE_STAGE) {
      const result = await ensureClientDossierForBuyer(id)
      clientDossier = result.dossier
    }

    return NextResponse.json({ buyer: data, client_dossier: clientDossier, success: true })
  } catch (e) {
    console.error('[API /market/buyers/[id]] PUT exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function buyerHasClientEmail(buyerLeadId: string) {
  const { data: buyer, error } = await supabaseAdmin
    .from('buyer_criteria')
    .select('lead_id, prospect_id')
    .eq('lead_id', buyerLeadId)
    .maybeSingle()

  if (error || !buyer) return false

  if (buyer.prospect_id) {
    const { data: prospect } = await supabaseAdmin
      .from('prospects')
      .select('email')
      .eq('id', buyer.prospect_id)
      .maybeSingle()
    if (prospect?.email) return true
  }

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('prospect:prospects!leads_prospect_id_fkey(email)')
    .eq('id', buyerLeadId)
    .maybeSingle()

  const record = lead as { prospect?: { email?: string | null } | null } | null
  return Boolean(record?.prospect?.email)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Soft-delete : on désactive l'acheteur
    const { data, error } = await supabaseAdmin
      .from('buyer_criteria')
      .update({ active: false })
      .eq('lead_id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Acheteur non trouvé' }, { status: 404 })
      }
      console.error('[API /market/buyers/[id]] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true, buyer: data })
  } catch (e) {
    console.error('[API /market/buyers/[id]] DELETE exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

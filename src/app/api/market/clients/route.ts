import { NextRequest, NextResponse } from 'next/server'
import { ensureClientDossierForBuyer, ensureClientDossierForLead } from '@/lib/client-portal'
import { rejectIfNoAdmin, type AdminClientDossier } from '@/lib/market/client-admin'
import { isPortalEligibleStage } from '@/lib/market/seller-stages'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, Json } from '@/types/supabase'

type ClientDocument = Database['public']['Tables']['client_documents']['Row']
type ClientDossierEvent = Database['public']['Tables']['client_dossier_events']['Row']

export async function GET(req: NextRequest) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('page_size') ?? '20') || 20))
    const status = searchParams.get('status')?.trim()
    const clientType = searchParams.get('client_type')?.trim() || 'seller'
    const q = searchParams.get('q')?.trim().toLowerCase()

    let query = supabaseAdmin
      .from('client_dossiers')
      .select('*, client_profile:client_profiles(*)', { count: 'exact' })
      .order('updated_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['active', 'archived'])
    }

    if (clientType === 'seller' || clientType === 'buyer') {
      query = query.eq('client_type', clientType)
    }

    const rangeStart = q ? 0 : (page - 1) * pageSize
    const rangeEnd = q ? 249 : rangeStart + pageSize - 1
    const { data, error, count } = await query.range(rangeStart, rangeEnd)

    if (error) {
      console.error('[GET /api/market/clients]', error)
      return NextResponse.json({ success: false, error: 'Erreur lecture clients' }, { status: 500 })
    }

    let rows = ((data ?? []) as AdminClientDossier[])
    if (q) {
      rows = rows.filter((row) => dossierMatches(row, q))
    }

    const total = q ? rows.length : (count ?? rows.length)
    const paginated = q ? rows.slice((page - 1) * pageSize, page * pageSize) : rows
    const dossierIds = paginated.map((row) => row.id)
    const stats = await loadStats(dossierIds)

    return NextResponse.json({
      success: true,
      data: paginated.map((row) => ({
        ...row,
        stats: stats.get(row.id) ?? emptyStats(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (err) {
    console.error('[GET /api/market/clients]', err)
    return NextResponse.json({ success: false, error: 'Erreur clients' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  try {
    const body = asRecord(await req.json())
    const clientType = text(body.client_type) === 'buyer' ? 'buyer' : 'seller'
    const opportunityId = text(body.opportunity_id)
    const buyerLeadId = text(body.buyer_lead_id)

    if (clientType === 'seller') {
      if (!opportunityId) {
        return NextResponse.json({ success: false, error: 'Opportunité vendeur signée requise' }, { status: 400 })
      }

      const { data: opportunity, error } = await supabaseAdmin
        .from('opportunities')
        .select('id, lead_id, stage')
        .eq('id', opportunityId)
        .maybeSingle()

      if (error) {
        console.error('[POST /api/market/clients] opportunity:', error)
        return NextResponse.json({ success: false, error: 'Erreur lecture opportunité' }, { status: 500 })
      }
      if (!opportunity) {
        return NextResponse.json({ success: false, error: 'Opportunité introuvable' }, { status: 404 })
      }
      if (!isPortalEligibleStage(opportunity.stage)) {
        return NextResponse.json({ success: false, error: 'Le suivi client se crée à partir de la remise de l’estimation' }, { status: 409 })
      }
      if (!opportunity.lead_id) {
        return NextResponse.json({ success: false, error: 'Cette opportunité n’a pas de contact vendeur rattaché' }, { status: 409 })
      }

      const { dossier } = await ensureClientDossierForLead(opportunity.lead_id, opportunityId)
      return NextResponse.json({ success: true, data: { id: dossier.id } })
    }

    if (!buyerLeadId) {
      return NextResponse.json({ success: false, error: 'Opportunité acquéreur signée requise' }, { status: 400 })
    }

    const { data: buyer, error } = await supabaseAdmin
      .from('buyer_criteria')
      .select('lead_id, stage')
      .eq('lead_id', buyerLeadId)
      .maybeSingle()

    if (error) {
      console.error('[POST /api/market/clients] buyer:', error)
      return NextResponse.json({ success: false, error: 'Erreur lecture acquéreur' }, { status: 500 })
    }
    if (!buyer) {
      return NextResponse.json({ success: false, error: 'Opportunité acquéreur introuvable' }, { status: 404 })
    }
    if (buyer.stage !== 'Mandat de recherche signé') {
      return NextResponse.json({ success: false, error: 'Le mandat de recherche doit être signé avant création du client' }, { status: 409 })
    }

    const { dossier } = await ensureClientDossierForBuyer(buyerLeadId)
    return NextResponse.json({ success: true, data: { id: dossier.id } })
  } catch (err) {
    console.error('[POST /api/market/clients]', err)
    if (err instanceof Error && err.message.toLowerCase().includes('email')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: 'Erreur création client' }, { status: 500 })
  }
}

function dossierMatches(row: AdminClientDossier, q: string) {
  const snapshot = asRecord(row.property_snapshot)
  const haystack = [
    row.title,
    row.status,
    row.client_type,
    row.client_profile.email,
    row.client_profile.first_name,
    row.client_profile.last_name,
    row.client_profile.phone,
    text(snapshot.adresse),
    text(snapshot.commune),
    text(snapshot.type_bien),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}

async function loadStats(dossierIds: string[]) {
  const map = new Map<string, ReturnType<typeof emptyStats>>()
  for (const id of dossierIds) map.set(id, emptyStats())
  if (dossierIds.length === 0) return map

  const [{ data: documents }, { data: events }] = await Promise.all([
    supabaseAdmin
      .from('client_documents')
      .select('dossier_id, status, updated_at')
      .in('dossier_id', dossierIds),
    supabaseAdmin
      .from('client_dossier_events')
      .select('dossier_id, created_at')
      .in('dossier_id', dossierIds)
      .order('created_at', { ascending: false }),
  ])

  for (const document of (documents ?? []) as Pick<ClientDocument, 'dossier_id' | 'status' | 'updated_at'>[]) {
    const stats = map.get(document.dossier_id)
    if (!stats) continue
    stats.documents_total += 1
    if (document.status === 'validated') stats.documents_validated += 1
    if (['missing', 'requested', 'rejected'].includes(document.status)) stats.documents_missing += 1
    if (!stats.last_activity_at || document.updated_at > stats.last_activity_at) stats.last_activity_at = document.updated_at
  }

  for (const event of (events ?? []) as Pick<ClientDossierEvent, 'dossier_id' | 'created_at'>[]) {
    const stats = map.get(event.dossier_id)
    if (!stats) continue
    if (!stats.last_activity_at || event.created_at > stats.last_activity_at) stats.last_activity_at = event.created_at
  }

  return map
}

function emptyStats() {
  return {
    documents_total: 0,
    documents_missing: 0,
    documents_validated: 0,
    last_activity_at: null as string | null,
  }
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  return {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

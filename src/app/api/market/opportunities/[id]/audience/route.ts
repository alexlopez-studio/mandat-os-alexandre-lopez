import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

interface AudienceRow {
  id: string
  opportunity_id: string
  portal: string
  captured_on: string
  views: number
  contacts: number
  favorites: number
  visits: number
  notes: string | null
  created_at: string
  updated_at: string
}

function nonNegativeInteger(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function validDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function portalId(name: string) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized.includes('seloger')) return 'seloger'
  if (normalized.includes('leboncoin')) return 'leboncoin'
  if (normalized.includes('bienici')) return 'bienici'
  if (normalized === 'iad' || normalized.includes('iadfrance')) return 'iad'
  if (normalized.includes('global') || normalized.includes('ombrelle')) return 'global'
  return normalized || 'autre'
}

function summarize(rows: AudienceRow[]) {
  const dates = [...new Set(rows.map((row) => row.captured_on))].sort()
  const latestByPortal = new Map<string, AudienceRow>()
  for (const row of rows) {
    const current = latestByPortal.get(row.portal)
    if (!current || row.captured_on > current.captured_on) latestByPortal.set(row.portal, row)
  }

  const totals = [...latestByPortal.values()].reduce(
    (sum, row) => ({
      views: sum.views + row.views,
      contacts: sum.contacts + row.contacts,
      favorites: sum.favorites + row.favorites,
      visits: sum.visits + row.visits,
    }),
    { views: 0, contacts: 0, favorites: 0, visits: 0 },
  )

  const timeline = dates.map((date) => {
    const knownByPortal = new Map<string, AudienceRow>()
    for (const row of rows) {
      if (row.captured_on <= date) {
        const current = knownByPortal.get(row.portal)
        if (!current || row.captured_on > current.captured_on) knownByPortal.set(row.portal, row)
      }
    }
    return [...knownByPortal.values()].reduce(
      (point, row) => ({
        ...point,
        views: point.views + row.views,
        contacts: point.contacts + row.contacts,
        favorites: point.favorites + row.favorites,
        visits: point.visits + row.visits,
      }),
      { date, views: 0, contacts: 0, favorites: 0, visits: 0 },
    )
  })

  const previous = timeline.at(-2)
  const percentChange = (current: number, before?: number) =>
    before && before > 0 ? Math.round(((current - before) / before) * 100) : null

  return {
    totals,
    changes: {
      views: percentChange(totals.views, previous?.views),
      contacts: percentChange(totals.contacts, previous?.contacts),
    },
    portals: [...latestByPortal.values()].sort((a, b) => a.portal.localeCompare(b.portal, 'fr')),
    timeline,
  }
}

async function readRows(opportunityId: string) {
  const { data, error } = await supabaseAdmin
    .from('opportunity_audience_snapshots')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('captured_on', { ascending: true })
    .order('portal', { ascending: true })
  if (error) throw error
  return (data ?? []) as AudienceRow[]
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await readRows(id)
    return NextResponse.json({ snapshots: rows, summary: summarize(rows) })
  } catch (error) {
    console.error('[API opportunity audience GET]', error)
    return NextResponse.json({ error: 'Impossible de charger les statistiques de diffusion' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const portal = typeof body.portal === 'string' ? body.portal.trim() : ''
    const capturedOn = validDate(body.captured_on)
    const views = nonNegativeInteger(body.views)
    const contacts = nonNegativeInteger(body.contacts)
    const favorites = nonNegativeInteger(body.favorites)
    const visits = nonNegativeInteger(body.visits)
    if (!portal || !capturedOn || [views, contacts, favorites, visits].some((value) => value === null)) {
      return NextResponse.json({ error: 'Portail, date et compteurs positifs requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('opportunity_audience_snapshots')
      .upsert({
        opportunity_id: id,
        portal,
        captured_on: capturedOn,
        views,
        contacts,
        favorites,
        visits,
        notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
      } as never, { onConflict: 'opportunity_id,portal,captured_on' })
    if (error) throw error

    const rows = await readRows(id)
    const summary = summarize(rows)
    const { data: opportunity, error: opportunityError } = await supabaseAdmin
      .from('opportunities')
      .select('professional_opinion')
      .eq('id', id)
      .maybeSingle()
    if (opportunityError) throw opportunityError
    if (!opportunity) return NextResponse.json({ error: 'Affaire introuvable' }, { status: 404 })

    const opinion = opportunity.professional_opinion && typeof opportunity.professional_opinion === 'object' && !Array.isArray(opportunity.professional_opinion)
      ? opportunity.professional_opinion as Record<string, Json | undefined>
      : {}
    const portals = Object.fromEntries(summary.portals.map((row) => [portalId(row.portal), {
      name: row.portal,
      views: row.views,
      contacts: row.contacts,
      calls: row.contacts,
      messages: 0,
      favorites: row.favorites,
      visits: row.visits,
    }]))
    const audience = {
      views_count: summary.totals.views,
      contacts_count: summary.totals.contacts,
      views_change: summary.changes.views,
      contacts_change: summary.changes.contacts,
      portals,
      updated_at: new Date().toISOString(),
    }
    const { error: updateError } = await supabaseAdmin
      .from('opportunities')
      .update({ professional_opinion: { ...opinion, audience } as Json } as never)
      .eq('id', id)
    if (updateError) throw updateError

    return NextResponse.json({ snapshots: rows, summary })
  } catch (error) {
    console.error('[API opportunity audience POST]', error)
    return NextResponse.json({ error: 'Impossible d’enregistrer le relevé' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

const TERMINAL_STATUSES = new Set(['expired', 'removed', 'deleted', 'offline', 'inactive', 'archived', 'expire'])

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : null
}

function isComparableType(a: unknown, b: unknown) {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return true
  if (left === right) return true
  if (left.includes(right) || right.includes(left)) return true
  return false
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('id, commune')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (leadError) {
      console.error('[API /leads/[id]/comparables] lead:', leadError)
      return NextResponse.json({ success: false, error: 'Erreur lecture lead' }, { status: 500 })
    }
    if (!lead) return NextResponse.json({ success: false, error: 'Lead introuvable' }, { status: 404 })

    const { data: sellerProperties } = await supabaseAdmin
      .from('seller_properties')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(1)

    const sellerProperty = sellerProperties?.[0] ?? null
    const commune = lead.commune ?? null
    if (!commune) {
      return NextResponse.json({ success: true, data: [], seller_property: sellerProperty })
    }

    const { data: properties, error } = await supabaseAdmin
      .from('market_properties')
      .select('id, title, city, zipcode, property_type, price, surface, land_surface, rooms, price_per_m2, status, url, first_seen_at, seller_type')
      .ilike('city', commune)
      .order('price_per_m2', { ascending: true, nullsFirst: false })
      .limit(60)

    if (error) {
      console.error('[API /leads/[id]/comparables] properties:', error)
      return NextResponse.json({ success: false, error: 'Erreur lecture comparables' }, { status: 500 })
    }

    const comparableType = sellerProperty?.type_bien ?? null
    const rows = (properties ?? [])
      .filter((property) => !TERMINAL_STATUSES.has(String(property.status ?? '').toLowerCase()))
      .filter((property) => isComparableType(property.property_type, comparableType))
      .slice(0, 12)

    return NextResponse.json({
      success: true,
      data: rows,
      seller_property: sellerProperty,
    })
  } catch (err) {
    console.error('[API /leads/[id]/comparables]', err)
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}

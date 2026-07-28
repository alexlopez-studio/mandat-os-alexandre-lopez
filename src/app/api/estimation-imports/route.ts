import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

const VALID_KINDS = ['pre_estimation', 'estimation']

/**
 * POST /api/estimation-imports — ingestion machine-à-machine (skill Claude externe).
 * Auth par secret partagé, jamais une clé Supabase. N'écrit jamais dans `opportunities` :
 * l'import reste `pending` tant qu'un admin ne l'a pas appliqué manuellement.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ESTIMATION_IMPORT_API_KEY
    const authHeader = req.headers.get('authorization')
    const providedKey = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!apiKey || !providedKey || providedKey !== apiKey) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    const body = asRecord(await req.json().catch(() => null))
    const kind = text(body.kind)
    if (!kind || !VALID_KINDS.includes(kind)) {
      return NextResponse.json({ success: false, error: 'kind invalide (pre_estimation|estimation)' }, { status: 400 })
    }
    if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      return NextResponse.json({ success: false, error: 'payload requis (objet JSON)' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('estimation_imports')
      .insert({
        kind,
        source: text(body.source) || 'claude_skill',
        opportunity_id: text(body.opportunity_id) || null,
        contact_name: text(body.contact_name),
        contact_email: text(body.contact_email),
        contact_phone: text(body.contact_phone),
        property_address: text(body.property_address),
        property_city: text(body.property_city),
        property_type: text(body.property_type),
        property_surface: numberValue(body.property_surface),
        price_low: numberValue(body.price_low),
        price_high: numberValue(body.price_high),
        price_m2: numberValue(body.price_m2),
        confidence: numberValue(body.confidence),
        summary: text(body.summary),
        payload: body.payload as Json,
        raw_filename: text(body.raw_filename),
        raw_format: text(body.raw_format),
        status: 'pending',
      } as never)
      .select('id, opportunity_id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: { id: data.id, linked: Boolean(data.opportunity_id) } }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/estimation-imports]', err)
    return NextResponse.json({ success: false, error: 'Import impossible' }, { status: 500 })
  }
}

/**
 * GET /api/estimation-imports?status=pending — liste pour la page admin globale.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('estimation_imports')
      .select('id, opportunity_id, kind, source, contact_name, property_address, property_city, price_low, price_high, price_m2, confidence, summary, status, created_at, applied_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/estimation-imports]', err)
    return NextResponse.json({ success: false, error: 'Lecture impossible' }, { status: 500 })
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

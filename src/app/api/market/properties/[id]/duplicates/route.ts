import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rescoreAndPersist } from '@/lib/market/mandate-score-persist'
import {
  ensurePropertySourceFromProperty,
  recordDuplicateDecision,
  scoreDuplicateCandidate,
  upsertPropertySource,
} from '@/lib/market/property-deduplication'
import type { Json } from '@/types/supabase'

type PropertyRow = {
  id: string
  source: string
  external_id: string | null
  title: string | null
  city: string | null
  zipcode: string | null
  insee_code: string | null
  property_type: string | null
  price: number | null
  surface: number | null
  land_surface: number | null
  rooms: number | null
  status: string | null
  url: string | null
  published_at: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  raw_json: Json
}

function asObjectJson(value: Json): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { previous_raw_json: value }
}

async function movePropertyReferences(fromId: string, toId: string) {
  const tables = [
    'property_price_history',
    'property_tags',
    'property_notes',
    'notifications',
    'opportunities',
    'match_results',
  ]

  for (const table of tables) {
    const column = table === 'match_results' ? 'property_id' : 'market_property_id'
    const { error } = await supabaseAdmin
      .from(table as never)
      .update({ [column]: toId } as never)
      .eq(column, fromId)

    if (error) throw new Error(`Transfert ${table} impossible: ${error.message}`)
  }
}

async function moveSources(from: PropertyRow, to: PropertyRow) {
  await ensurePropertySourceFromProperty(to.id)
  await ensurePropertySourceFromProperty(from.id)

  const { data: sources, error } = await supabaseAdmin
    .from('market_property_sources')
    .select('*')
    .eq('market_property_id', from.id)

  if (error) throw new Error(`Lecture diffusions doublon impossible: ${error.message}`)

  for (const source of sources ?? []) {
    await upsertPropertySource({
      propertyId: to.id,
      source: source.source,
      externalId: source.external_id,
      url: source.url,
      title: source.title,
      price: source.price,
      status: source.status,
      publishedAt: source.published_at,
      firstSeenAt: source.first_seen_at,
      lastSeenAt: source.last_seen_at,
      rawJson: source.raw_json as Json,
    })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('market_property_sources')
    .delete()
    .eq('market_property_id', from.id)

  if (deleteError) throw new Error(`Nettoyage diffusions doublon impossible: ${deleteError.message}`)
}

/**
 * POST /api/market/properties/[id]/duplicates
 * Confirme ou écarte un doublon probable.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const candidateId = typeof body.candidate_property_id === 'string' ? body.candidate_property_id : null
    const action = body.action === 'reject' ? 'reject' : body.action === 'merge' ? 'merge' : null

    if (!candidateId || !action || candidateId === id) {
      return NextResponse.json({ error: 'candidate_property_id et action requis' }, { status: 400 })
    }

    const { data: rows, error } = await supabaseAdmin
      .from('market_properties')
      .select('id, source, external_id, title, city, zipcode, insee_code, property_type, price, surface, land_surface, rooms, status, url, published_at, first_seen_at, last_seen_at, raw_json')
      .in('id', [id, candidateId])

    if (error) throw new Error(error.message)
    const property = rows?.find((row) => row.id === id) as PropertyRow | undefined
    const candidate = rows?.find((row) => row.id === candidateId) as PropertyRow | undefined
    if (!property || !candidate) {
      return NextResponse.json({ error: 'Bien ou doublon introuvable' }, { status: 404 })
    }

    const scored = scoreDuplicateCandidate(property, candidate)

    if (action === 'reject') {
      await recordDuplicateDecision({
        propertyId: id,
        candidatePropertyId: candidateId,
        status: 'rejected',
        score: scored.score,
        reasons: scored.reasons,
      })
      return NextResponse.json({ success: true, status: 'rejected' })
    }

    await moveSources(candidate, property)
    await movePropertyReferences(candidate.id, property.id)

    const mergedRawJson = {
      ...asObjectJson(candidate.raw_json),
      duplicate_of: property.id,
      duplicate_merged_at: new Date().toISOString(),
    }

    const { error: updateDuplicateError } = await supabaseAdmin
      .from('market_properties')
      .update({
        status: 'duplicate',
        raw_json: mergedRawJson as never,
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)

    if (updateDuplicateError) throw new Error(`Marquage doublon impossible: ${updateDuplicateError.message}`)

    await recordDuplicateDecision({
      propertyId: id,
      candidatePropertyId: candidateId,
      status: 'confirmed',
      score: scored.score,
      reasons: scored.reasons,
    })
    await rescoreAndPersist(property.id)

    return NextResponse.json({ success: true, status: 'confirmed', canonical_property_id: property.id })
  } catch (e) {
    console.error('[API /market/properties/[id]/duplicates]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}

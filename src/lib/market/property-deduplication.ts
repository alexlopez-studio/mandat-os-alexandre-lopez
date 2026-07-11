import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

export type PropertySourceInput = {
  propertyId: string
  source?: string | null
  externalId?: string | null
  url?: string | null
  title?: string | null
  price?: number | null
  status?: string | null
  publishedAt?: string | null
  firstSeenAt?: string | null
  lastSeenAt?: string | null
  rawJson?: Json | null
}

export type DuplicateCandidateView = {
  property: {
    id: string
    title: string | null
    city: string | null
    zipcode: string | null
    property_type: string | null
    price: number | null
    surface: number | null
    land_surface: number | null
    rooms: number | null
    status: string | null
    url: string | null
    first_seen_at: string | null
    last_seen_at: string | null
  }
  score: number
  reasons: string[]
  status: 'pending' | 'confirmed' | 'rejected'
}

type CandidateProperty = DuplicateCandidateView['property'] & {
  insee_code?: string | null
}

export function portalFromUrl(url?: string | null, fallback?: string | null) {
  if (!url) return fallback || 'Source inconnue'
  try {
    const host = new URL(url).hostname
      .replace(/^www\./, '')
      .replace(/^m\./, '')
      .toLowerCase()

    if (host.includes('leboncoin')) return 'Leboncoin'
    if (host.includes('seloger')) return 'SeLoger'
    if (host.includes('pap.fr')) return 'PAP'
    if (host.includes('bienici')) return "Bien'ici"
    if (host.includes('logic-immo')) return 'Logic-Immo'
    if (host.includes('figaro')) return 'Figaro Immobilier'

    return host
  } catch {
    return fallback || 'Source inconnue'
  }
}

function normalizeText(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nearPercent(a: number | null, b: number | null, tolerance: number) {
  if (a == null || b == null || a <= 0 || b <= 0) return false
  return Math.abs(a - b) / Math.max(a, b) <= tolerance
}

function sameNumber(a: number | null, b: number | null) {
  return a != null && b != null && a === b
}

function titleSimilarity(a?: string | null, b?: string | null) {
  const left = new Set(normalizeText(a).split(' ').filter((word) => word.length >= 4))
  const right = new Set(normalizeText(b).split(' ').filter((word) => word.length >= 4))
  if (left.size === 0 || right.size === 0) return 0
  const intersection = [...left].filter((word) => right.has(word)).length
  return intersection / Math.max(left.size, right.size)
}

export function scoreDuplicateCandidate(
  property: CandidateProperty,
  candidate: CandidateProperty,
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (property.property_type && property.property_type === candidate.property_type) {
    score += 15
    reasons.push('même type')
  }

  if (sameNumber(property.price, candidate.price)) {
    score += 30
    reasons.push('même prix')
  } else if (nearPercent(property.price, candidate.price, 0.02)) {
    score += 20
    reasons.push('prix très proche')
  }

  if (sameNumber(property.surface, candidate.surface)) {
    score += 25
    reasons.push('même surface')
  } else if (nearPercent(property.surface, candidate.surface, 0.03)) {
    score += 15
    reasons.push('surface proche')
  }

  if (sameNumber(property.land_surface, candidate.land_surface)) {
    score += 10
    reasons.push('même terrain')
  }

  if (sameNumber(property.rooms, candidate.rooms)) {
    score += 10
    reasons.push('même nombre de pièces')
  }

  const titleScore = titleSimilarity(property.title, candidate.title)
  if (titleScore >= 0.6) {
    score += 10
    reasons.push('titre proche')
  }

  return { score: Math.min(100, score), reasons }
}

export async function upsertPropertySource(input: PropertySourceInput) {
  const now = new Date().toISOString()
  const source = input.source || 'stream_estate'
  const row = {
    market_property_id: input.propertyId,
    source,
    portal: portalFromUrl(input.url, source),
    external_id: input.externalId || null,
    url: input.url || null,
    title: input.title || null,
    price: input.price ?? null,
    status: input.status || 'active',
    published_at: input.publishedAt || null,
    first_seen_at: input.firstSeenAt || now,
    last_seen_at: input.lastSeenAt || now,
    raw_json: (input.rawJson ?? {}) as never,
    updated_at: now,
  }

  let existingId: string | null = null
  if (row.url) {
    const { data, error } = await supabaseAdmin
      .from('market_property_sources')
      .select('id')
      .eq('url', row.url)
      .maybeSingle()
    if (error) throw new Error(`Lecture diffusion URL impossible: ${error.message}`)
    existingId = data?.id ?? null
  } else if (row.external_id) {
    const { data, error } = await supabaseAdmin
      .from('market_property_sources')
      .select('id')
      .eq('source', source)
      .eq('external_id', row.external_id)
      .maybeSingle()
    if (error) throw new Error(`Lecture diffusion externe impossible: ${error.message}`)
    existingId = data?.id ?? null
  }

  if (existingId) {
    const { error } = await supabaseAdmin
      .from('market_property_sources')
      .update(row as never)
      .eq('id', existingId)
    if (error) throw new Error(`Mise à jour diffusion impossible: ${error.message}`)
    return
  }

  const { error } = await supabaseAdmin
    .from('market_property_sources')
    .insert(row as never)
  if (error) throw new Error(`Diffusion impossible: ${error.message}`)
}

export async function ensurePropertySourceFromProperty(propertyId: string) {
  const { data: property, error } = await supabaseAdmin
    .from('market_properties')
    .select('id, source, external_id, url, title, price, status, published_at, first_seen_at, last_seen_at, raw_json')
    .eq('id', propertyId)
    .single()

  if (error || !property) return

  await upsertPropertySource({
    propertyId,
    source: property.source,
    externalId: property.external_id,
    url: property.url,
    title: property.title,
    price: property.price,
    status: property.status,
    publishedAt: property.published_at,
    firstSeenAt: property.first_seen_at,
    lastSeenAt: property.last_seen_at,
    rawJson: property.raw_json as Json,
  })
}

export async function findDuplicateCandidates(propertyId: string): Promise<DuplicateCandidateView[]> {
  const { data: property, error } = await supabaseAdmin
    .from('market_properties')
    .select('id, title, city, zipcode, insee_code, property_type, price, surface, land_surface, rooms, status, url, first_seen_at, last_seen_at')
    .eq('id', propertyId)
    .single()

  if (error || !property) return []

  const geoColumn = property.insee_code ? 'insee_code' : 'zipcode'
  const geoValue = property.insee_code || property.zipcode
  if (!geoValue) return []

  const { data: rows } = await supabaseAdmin
    .from('market_properties')
    .select('id, title, city, zipcode, insee_code, property_type, price, surface, land_surface, rooms, status, url, first_seen_at, last_seen_at')
    .eq(geoColumn, geoValue)
    .neq('id', propertyId)
    .neq('status', 'duplicate')
    .limit(50)

  const ids = (rows ?? []).map((row) => row.id as string)
  const statusByCandidate = new Map<string, 'pending' | 'confirmed' | 'rejected'>()
  if (ids.length > 0) {
    const { data: decisions } = await supabaseAdmin
      .from('market_property_duplicate_candidates')
      .select('property_id, candidate_property_id, status')
      .or(`and(property_id.eq.${propertyId},candidate_property_id.in.(${ids.join(',')})),and(candidate_property_id.eq.${propertyId},property_id.in.(${ids.join(',')}))`)

    for (const decision of decisions ?? []) {
      const candidateId = decision.property_id === propertyId ? decision.candidate_property_id : decision.property_id
      statusByCandidate.set(candidateId as string, decision.status as 'pending' | 'confirmed' | 'rejected')
    }
  }

  return (rows ?? [])
    .map((candidate) => {
      const result = scoreDuplicateCandidate(property as CandidateProperty, candidate as CandidateProperty)
      return {
        property: candidate as DuplicateCandidateView['property'],
        score: result.score,
        reasons: result.reasons,
        status: statusByCandidate.get(candidate.id as string) ?? 'pending',
      }
    })
    .filter((candidate) => candidate.status !== 'rejected' && candidate.score >= 60)
    .sort((a, b) => b.score - a.score)
}

export async function recordDuplicateDecision({
  propertyId,
  candidatePropertyId,
  status,
  score,
  reasons,
}: {
  propertyId: string
  candidatePropertyId: string
  status: 'confirmed' | 'rejected'
  score: number
  reasons: string[]
}) {
  const [left, right] = [propertyId, candidatePropertyId].sort()
  const { error } = await supabaseAdmin
    .from('market_property_duplicate_candidates')
    .upsert({
      property_id: left,
      candidate_property_id: right,
      status,
      score,
      reasons: reasons as never,
      resolved_at: new Date().toISOString(),
      resolved_by: 'admin',
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'property_id,candidate_property_id' as never })

  if (error) throw new Error(`Décision doublon impossible: ${error.message}`)
}

import { NextRequest, NextResponse } from 'next/server'

import { isMachineOrAdmin } from '@/lib/api-machine-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database, Json, NewsCategory, NewsConfidence, NewsStatus } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type NewsInsert = Database['public']['Tables']['news_items']['Insert']

const VALID_SORT_FIELDS = new Set(['published_at', 'collected_at', 'relevance'])

const VALID_CATEGORIES = new Set<string>([
  'taux',
  'reglementation',
  'marche_national',
  'marche_local',
  'premium',
  'conseils',
])

const VALID_CONFIDENCES = new Set<string>(['verified', 'external', 'hypothesis'])

const ALL_STATUSES: NewsStatus[] = ['new', 'reviewed', 'newsletter', 'published', 'archived']

/** Un seul appel d'ingestion ne doit pas pouvoir bloquer la base. */
const MAX_INGEST_ITEMS = 50

/**
 * Repartition par statut sur l'ensemble de la table.
 *
 * Les compteurs d'onglets ne peuvent pas etre derives de la page courante :
 * celle-ci ne contient qu'un seul statut a la fois, ce qui affichait 0 partout
 * ailleurs. On agrege donc cote serveur, en une requete legere.
 */
async function loadStatusCounts(): Promise<Record<NewsStatus, number>> {
  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<NewsStatus, number>

  const { data, error } = await supabaseAdmin.from('news_items').select('status')
  if (error || !data) return counts

  for (const row of data) {
    const status = row.status as NewsStatus
    if (status in counts) counts[status] += 1
  }
  return counts
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const category = searchParams.get('category')?.trim() ?? ''
    const source = searchParams.get('source')?.trim() ?? ''
    const status = searchParams.get('status')?.trim() ?? 'all'
    const sort = searchParams.get('sort') ?? 'published_at.desc'
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const offset = (page - 1) * limit
    const [sortField, sortDir] = sort.split('.')

    let query = supabaseAdmin.from('news_items').select('*', { count: 'exact' })

    if (q) {
      // Échappe les wildcards LIKE pour une recherche littérale.
      const escaped = q.replace(/[%_]/g, (m) => `\\${m}`)
      query = query.ilike('title', `%${escaped}%`)
    }
    if (category && category !== 'all') query = query.eq('category', category as NewsCategory)
    if (source && source !== 'all') query = query.eq('source', source)
    // 'inbox' => nouveaux + relus ; 'all' (ou vide) => tout sauf archivé ; sinon statut exact.
    if (status === 'inbox') query = query.in('status', ['new', 'reviewed'])
    else if (!status || status === 'all') query = query.neq('status', 'archived')
    else query = query.eq('status', status as NewsStatus)

    query = query
      .order(VALID_SORT_FIELDS.has(sortField) ? sortField : 'published_at', {
        ascending: sortDir === 'asc',
        nullsFirst: false,
      })
      .order('collected_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const [{ data, count, error }, counts] = await Promise.all([query, loadStatusCounts()])
    if (error) {
      console.error('[API /market/news] GET', error)
      return NextResponse.json({ error: 'Erreur lecture veille' }, { status: 500 })
    }

    return NextResponse.json({ items: data ?? [], total: count ?? 0, page, limit, counts })
  } catch (error) {
    console.error('[API /market/news] GET', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/market/news — ingestion machine-a-machine de la veille.
 *
 * Meme contrat que `/api/estimation-imports` : secret partage en Bearer, jamais
 * une clé Supabase. Idempotent grace a la contrainte `news_items_url_key` : le
 * meme article reingere est ignore, pas duplique.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { items?: unknown } | null
    const rawItems = Array.isArray(body?.items) ? body.items : null

    if (!rawItems || rawItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items requis (tableau non vide)' },
        { status: 400 },
      )
    }
    if (rawItems.length > MAX_INGEST_ITEMS) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_INGEST_ITEMS} articles par appel` },
        { status: 400 },
      )
    }

    const rows: NewsInsert[] = []
    for (const [index, raw] of rawItems.entries()) {
      const parsed = parseItem(raw, index)
      if ('error' in parsed) {
        return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
      }
      rows.push(parsed.row)
    }

    // `ignoreDuplicates` : une URL deja connue n'ecrase pas la qualification
    // existante ni le statut de tri deja pose par Alexandre.
    const { data, error } = await supabaseAdmin
      .from('news_items')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error('[API /market/news] POST', error)
      return NextResponse.json({ success: false, error: 'Erreur ingestion veille' }, { status: 500 })
    }

    const inserted = data?.length ?? 0
    return NextResponse.json(
      { success: true, data: { inserted, skipped: rows.length - inserted } },
      { status: 201 },
    )
  } catch (error) {
    console.error('[API /market/news] POST', error)
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}

type ParseResult = { row: NewsInsert } | { error: string }

function parseItem(raw: unknown, index: number): ParseResult {
  const at = `items[${index}]`
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: `${at} : objet attendu` }
  }
  const item = raw as Record<string, unknown>

  const source = text(item.source)
  const url = text(item.url)
  const title = text(item.title)
  const category = text(item.category)

  if (!source) return { error: `${at}.source requis` }
  if (!url) return { error: `${at}.url requis` }
  if (!title) return { error: `${at}.title requis` }
  if (!category || !VALID_CATEGORIES.has(category)) {
    return { error: `${at}.category invalide (${[...VALID_CATEGORIES].join('|')})` }
  }

  const confidence = text(item.confidence)
  if (confidence && !VALID_CONFIDENCES.has(confidence)) {
    return { error: `${at}.confidence invalide (${[...VALID_CONFIDENCES].join('|')})` }
  }

  const relevance = item.relevance == null ? 0 : Number(item.relevance)
  if (!Number.isFinite(relevance) || relevance < 0 || relevance > 100) {
    return { error: `${at}.relevance doit être un entier entre 0 et 100` }
  }

  const publishedAt = text(item.published_at)
  if (publishedAt && Number.isNaN(new Date(publishedAt).getTime())) {
    return { error: `${at}.published_at n'est pas une date ISO valide` }
  }

  return {
    row: {
      source,
      url,
      title,
      summary: text(item.summary),
      key_figure: text(item.key_figure),
      category: category as NewsCategory,
      insee_code: text(item.insee_code),
      city: text(item.city),
      zipcode: text(item.zipcode),
      published_at: publishedAt,
      relevance: Math.round(relevance),
      confidence: (confidence as NewsConfidence) || 'external',
      raw_json: isPlainObject(item.raw_json) ? (item.raw_json as Json) : {},
    },
  }
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isPlainObject(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

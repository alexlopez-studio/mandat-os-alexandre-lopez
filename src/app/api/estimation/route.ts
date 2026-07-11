import { NextRequest, NextResponse } from 'next/server'
import { calculerEstimation } from '@/lib/estimation'
import { estimationInputSchema } from '@/lib/schemas/estimation'

/**
 * Rate limit léger en mémoire — réinitialisé à chaque cold start.
 * 10 requêtes / minute par IP. Suffisant pour bloquer un script naïf
 * sur un seul nœud serverless. Pour un trafic plus volumineux ou
 * multi-instance, basculer sur Upstash / Vercel KV ultérieurement.
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10

const ipHits = new Map<string, { count: number; resetAt: number }>()

function rateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { ok: true }
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count += 1
  return { ok: true }
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  // 1. Rate limit
  const ip = clientIp(req)
  const rl = rateLimit(ip)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes', retry_after: rl.retryAfter },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfter) },
      }
    )
  }

  // 2. JSON parsing
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  // 3. Validation Zod
  const parsed = estimationInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation échouée',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 }
    )
  }

  // 4. Calcul estimation
  try {
    const result = await calculerEstimation(parsed.data)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[API /estimation]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

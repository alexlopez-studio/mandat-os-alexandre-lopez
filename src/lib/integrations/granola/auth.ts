import type { NextRequest } from 'next/server'

import { getCurrentAdmin } from '@/lib/auth'

/**
 * Garde des routes Granola.
 *
 * `/api/integrations/*` n'est pas couvert par le matcher du middleware (des
 * webhooks y vivent deja) : la garde est donc portee par chaque route, et elle
 * est fail-closed.
 *
 * Deux voies d'acces :
 *  - `Authorization: Bearer <GRANOLA_INGEST_SECRET|CRON_SECRET>` pour une machine
 *    (le cron Vercel, un webhook Zapier, un rejeu depuis un script) ;
 *  - une session admin valide pour l'app.
 */
export async function isGranolaMachineOrAdmin(req: NextRequest): Promise<boolean> {
  if (hasGranolaMachineKey(req)) return true
  return (await getCurrentAdmin()) !== null
}

export function hasGranolaMachineKey(req: NextRequest): boolean {
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!provided) return false

  const accepted = [process.env.GRANOLA_INGEST_SECRET, process.env.CRON_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  )

  return accepted.some((secret) => timingSafeEqual(provided, secret))
}

/** Comparaison a duree constante, pour ne pas fuiter le secret octet par octet. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

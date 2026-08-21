import type { NextRequest } from 'next/server'

import { getCurrentAdmin } from '@/lib/auth'

/**
 * Garde des routes ouvertes a la fois a l'app et a une machine.
 *
 * Les routes veille/editorial sont sorties de la protection globale du
 * middleware (`PUBLIC_API_PATHS` dans `src/middleware.ts`) pour que la skill
 * Claude puisse les appeler sans session Supabase. La contrepartie : c'est cette
 * fonction qui porte alors toute la garde, et elle est fail-closed.
 *
 * Deux voies d'acces, jamais une clé Supabase :
 *  - `Authorization: Bearer <EDITORIAL_API_KEY>` pour la machine ;
 *  - une session admin valide pour l'app.
 */
export async function isMachineOrAdmin(req: NextRequest): Promise<boolean> {
  if (hasMachineKey(req)) return true
  return (await getCurrentAdmin()) !== null
}

/** Vrai si la requete porte le secret partage editorial. */
export function hasMachineKey(req: NextRequest): boolean {
  const expected = process.env.EDITORIAL_API_KEY
  if (!expected) return false

  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!provided) return false

  return timingSafeEqual(provided, expected)
}

/** Comparaison a duree constante, pour ne pas fuiter la clé octet par octet. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

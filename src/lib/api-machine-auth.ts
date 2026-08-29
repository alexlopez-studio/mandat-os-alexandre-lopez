import type { NextRequest } from 'next/server'

import { getCurrentAdmin } from '@/lib/auth'

export type MachineAuthOptions = {
  /** Variable d'environnement portant le secret partage. Defaut : `EDITORIAL_API_KEY`. */
  envVar?: string
  /** Accepte aussi l'en-tete `x-api-key` (raccourcis iOS, ou `Authorization` est moins pratique). */
  allowApiKeyHeader?: boolean
}

/**
 * Garde des routes ouvertes a la fois a l'app et a une machine.
 *
 * Les routes veille/editorial et la note vocale sont sorties de la protection
 * globale du middleware (`PUBLIC_API_PATHS` dans `src/middleware.ts`) pour
 * qu'une skill Claude ou un raccourci iOS puisse les appeler sans session
 * Supabase. La contrepartie : c'est cette fonction qui porte alors toute la
 * garde, et elle est fail-closed.
 *
 * Deux voies d'acces, jamais une clé Supabase :
 *  - `Authorization: Bearer <secret>` (ou `x-api-key`) pour la machine ;
 *  - une session admin valide pour l'app.
 */
export async function isMachineOrAdmin(req: NextRequest, options?: MachineAuthOptions): Promise<boolean> {
  if (hasMachineKey(req, options)) return true
  return (await getCurrentAdmin()) !== null
}

/** Vrai si la requete porte le secret partage attendu. */
export function hasMachineKey(req: NextRequest, options?: MachineAuthOptions): boolean {
  const expected = process.env[options?.envVar ?? 'EDITORIAL_API_KEY']
  if (!expected) return false

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const apiKeyHeader = options?.allowApiKeyHeader ? req.headers.get('x-api-key')?.trim() : null
  const provided = bearer || apiKeyHeader
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

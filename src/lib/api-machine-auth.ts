import type { NextRequest } from 'next/server'

import { getCurrentAdmin } from '@/lib/auth'

export type MachineAuthOptions = {
  /**
   * Valeur du secret partage attendu. Defaut : `EDITORIAL_API_KEY`.
   *
   * On passe la VALEUR et non le NOM de la variable : `process.env[nom]` est un
   * acces dynamique, que le bundler ne peut pas resoudre a la compilation. Une
   * reference statique `process.env.MA_VARIABLE` cote appelant est la seule
   * forme garantie de retrouver la valeur a l'execution.
   */
  secret?: string | null
  /** Accepte aussi l'en-tete `x-api-key` (raccourcis iOS, ou `Authorization` est moins pratique). */
  allowApiKeyHeader?: boolean
}

/** Pourquoi la garde a accepte ou refuse. Sert a rendre les 401 diagnosticables. */
export type MachineAuthResult =
  | 'machine' // secret partage valide
  | 'admin' // session admin valide
  | 'no-secret-configured' // aucun secret cote serveur : la voie machine est fermee
  | 'bad-credentials' // secret absent ou errone, et pas de session

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
export async function checkMachineOrAdmin(
  req: NextRequest,
  options?: MachineAuthOptions
): Promise<MachineAuthResult> {
  const expected = (options?.secret ?? process.env.EDITORIAL_API_KEY)?.trim()
  const provided = readProvidedKey(req, options)

  if (expected && provided && timingSafeEqual(provided, expected)) return 'machine'
  if ((await getCurrentAdmin()) !== null) return 'admin'

  // Distinguer les deux echecs evite de chercher a l'aveugle entre « variable
  // absente du deploiement » et « valeur qui ne correspond pas ».
  return expected ? 'bad-credentials' : 'no-secret-configured'
}

/** Variante booleenne, pour les routes qui n'ont pas besoin du motif. */
export async function isMachineOrAdmin(req: NextRequest, options?: MachineAuthOptions): Promise<boolean> {
  const result = await checkMachineOrAdmin(req, options)
  return result === 'machine' || result === 'admin'
}

/** Vrai si la requete porte le secret partage attendu. */
export function hasMachineKey(req: NextRequest, options?: MachineAuthOptions): boolean {
  const expected = (options?.secret ?? process.env.EDITORIAL_API_KEY)?.trim()
  if (!expected) return false

  const provided = readProvidedKey(req, options)
  if (!provided) return false

  return timingSafeEqual(provided, expected)
}

/** Secret porte par la requete, en Bearer ou (si autorise) en `x-api-key`. */
function readProvidedKey(req: NextRequest, options?: MachineAuthOptions): string | null {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const apiKeyHeader = options?.allowApiKeyHeader ? req.headers.get('x-api-key')?.trim() : null
  return bearer || apiKeyHeader || null
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

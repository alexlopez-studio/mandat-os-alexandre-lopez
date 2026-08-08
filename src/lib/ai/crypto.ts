import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const VERSION = 'v1'

/**
 * Repli signalé une seule fois par processus : sans cela, l'avertissement
 * noierait les journaux à chaque appel.
 */
let fallbackWarned = false

/**
 * Clé de chiffrement des secrets stockés (clés IA, jetons Google, Granola).
 *
 * ATTENTION — la chaîne de repli est un piège opérationnel : si
 * `AI_CREDENTIALS_SECRET` n'est pas défini, la clé dérive de
 * `SUPABASE_SERVICE_ROLE_KEY`, qui diffère d'un environnement à l'autre et peut
 * être régénérée. Tout secret chiffré avec une valeur devient alors illisible
 * avec l'autre — sans aucun signal, jusqu'à l'échec de déchiffrement.
 *
 * `AI_CREDENTIALS_SECRET` doit donc porter la MÊME valeur en local et sur
 * chaque déploiement. Le repli n'existe que pour ne pas casser l'existant.
 */
function keyMaterial() {
  const explicit = process.env.AI_CREDENTIALS_SECRET
  const secret = explicit
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AI_CREDENTIALS_SECRET doit être configuré en production')
  }

  if (!explicit && !fallbackWarned) {
    fallbackWarned = true
    console.warn(
      '[crypto] AI_CREDENTIALS_SECRET absent : la clé de chiffrement dérive de SUPABASE_SERVICE_ROLE_KEY. ' +
        'Les secrets chiffrés seront illisibles depuis tout environnement ayant une autre valeur ' +
        '(erreur « Unsupported state or unable to authenticate data »). Définissez la variable partout, à l’identique.',
    )
  }

  return createHash('sha256')
    .update(secret ?? 'local-development-ai-credentials-secret')
    .digest()
}

export function encryptSecret(plainText: string) {
  if (!plainText.trim()) throw new Error('Secret vide')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptSecret(payload: string) {
  const [version, ivB64, tagB64, encryptedB64] = payload.split(':')
  if (version !== VERSION || !ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Secret chiffré invalide')
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', keyMaterial(), Buffer.from(ivB64, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch (err) {
    console.error('[decryptSecret] Déchiffrement impossible:', err)
    throw new Error('Clé API ou jeton chiffré illisible (la clé de sécurité du serveur a été modifiée). Veuillez ressaisir vos clés dans Réglages > Assistant IA.')
  }
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null
  if (value.length <= 8) return '••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

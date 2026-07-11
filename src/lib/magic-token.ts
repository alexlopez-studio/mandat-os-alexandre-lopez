import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Type d'outil prospect à l'origine du dossier magic link.
 */
export type MagicLeadType = 'vendre' | 'acheter' | 'audit'

/**
 * Payload encodé dans le token magic link Phase A.
 *
 * Phase A = zéro persistance externe : tout ce dont /resultats/[token]
 * et /api/pdf ont besoin pour reconstruire le rendu prospect doit vivre
 * ici. Pas de PII libre côté URL : on s'appuie sur la signature HS256
 * pour empêcher toute altération.
 */
export type MagicTokenPayload = {
  /** Identifiant logique du dossier prospect (UUID v4 généré côté API). */
  jti: string
  /** Type d'outil à l'origine du dossier. */
  type: MagicLeadType
  /** Snapshot complet du formulaire (sérialisable JSON). */
  formData: Record<string, unknown>
  /** Résultat calculé : estimation, score audit, critères acheteur, etc. */
  results: Record<string, unknown>
  /** Timestamp d'émission (epoch seconds). */
  iat: number
  /** Timestamp d'expiration (epoch seconds). */
  exp: number
}

/** Durée de vie par défaut d'un magic link : 30 jours. */
export const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60

/** En-tête JWT figé : HS256 / JWT. */
const HEADER_B64 = base64UrlEncode(
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8'),
)

/** Codes d'erreur exposés par {@link MagicTokenError}. */
export type MagicTokenErrorCode =
  | 'invalid_format'
  | 'invalid_signature'
  | 'expired'
  | 'invalid_payload'
  | 'missing_secret'

/**
 * Erreur typée renvoyée par {@link signMagicToken} et {@link verifyMagicToken}.
 * Permet aux appelants (route /api/leads, /resultats/[token], /api/pdf)
 * de différencier proprement les cas — sans exposer le détail au prospect.
 */
export class MagicTokenError extends Error {
  public readonly code: MagicTokenErrorCode

  constructor(code: MagicTokenErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'MagicTokenError'
  }
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(str: string): Buffer {
  const padded = str + '==='.slice((str.length + 3) % 4)
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function resolveSecret(secret?: string): string {
  const value = secret ?? process.env.MAGIC_LINK_JWT_SECRET
  if (!value || value.length < 16) {
    throw new MagicTokenError(
      'missing_secret',
      'MAGIC_LINK_JWT_SECRET manquant ou trop court (>= 16 caractères requis).',
    )
  }
  return value
}

function hmac(input: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(input).digest()
}

export type SignMagicTokenOptions = {
  /** Override de la durée de vie (en secondes). Par défaut 30 jours. */
  ttlSeconds?: number
  /** Horloge injectable (utile en test). En millisecondes. */
  nowMs?: number
  /** Override du secret (utile en test). Sinon process.env.MAGIC_LINK_JWT_SECRET. */
  secret?: string
}

/**
 * Sérialise et signe un payload magic link.
 *
 * Le token retourné est compatible JWT compact (`header.payload.signature`)
 * et entièrement signé via HMAC-SHA256.
 */
export function signMagicToken(
  payload: Omit<MagicTokenPayload, 'iat' | 'exp'>,
  options: SignMagicTokenOptions = {},
): string {
  const secret = resolveSecret(options.secret)
  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000)
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS

  const fullPayload: MagicTokenPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + ttl,
  }

  const payloadB64 = base64UrlEncode(
    Buffer.from(JSON.stringify(fullPayload), 'utf8'),
  )
  const signingInput = `${HEADER_B64}.${payloadB64}`
  const signature = base64UrlEncode(hmac(signingInput, secret))
  return `${signingInput}.${signature}`
}

export type VerifyMagicTokenOptions = {
  /** Horloge injectable (utile en test). En millisecondes. */
  nowMs?: number
  /** Override du secret (utile en test). Sinon process.env.MAGIC_LINK_JWT_SECRET. */
  secret?: string
}

/**
 * Vérifie la signature et la fraîcheur d'un magic link, puis renvoie le payload
 * décodé. Lève {@link MagicTokenError} pour toute anomalie (format, signature,
 * expiration, payload incomplet, secret manquant).
 */
export function verifyMagicToken(
  token: string,
  options: VerifyMagicTokenOptions = {},
): MagicTokenPayload {
  const secret = resolveSecret(options.secret)

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new MagicTokenError('invalid_format', 'Token mal formé.')
  }
  const [headerB64, payloadB64, signatureB64] = parts

  if (headerB64 !== HEADER_B64) {
    throw new MagicTokenError('invalid_format', 'En-tête de token inattendu.')
  }

  const expectedSig = hmac(`${headerB64}.${payloadB64}`, secret)
  let providedSig: Buffer
  try {
    providedSig = base64UrlDecode(signatureB64)
  } catch {
    throw new MagicTokenError('invalid_signature', 'Signature illisible.')
  }
  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    throw new MagicTokenError('invalid_signature', 'Signature invalide.')
  }

  let parsed: MagicTokenPayload
  try {
    parsed = JSON.parse(
      base64UrlDecode(payloadB64).toString('utf8'),
    ) as MagicTokenPayload
  } catch {
    throw new MagicTokenError('invalid_payload', 'Payload illisible.')
  }

  if (
    typeof parsed?.exp !== 'number' ||
    typeof parsed?.iat !== 'number' ||
    typeof parsed?.jti !== 'string' ||
    typeof parsed?.type !== 'string' ||
    !parsed.formData ||
    !parsed.results
  ) {
    throw new MagicTokenError('invalid_payload', 'Payload incomplet.')
  }

  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000)
  if (nowSec >= parsed.exp) {
    throw new MagicTokenError('expired', 'Token expiré.')
  }

  return parsed
}

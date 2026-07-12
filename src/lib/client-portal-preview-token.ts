import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_SECONDS = 60 * 60

export type ClientPortalPreviewTokenPayload = {
  dossier_id: string
  exp: number
}

export function signClientPortalPreviewToken(dossierId: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const payload: ClientPortalPreviewTokenPayload = {
    dossier_id: dossierId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const encodedPayload = base64url(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function verifyClientPortalPreviewToken(token: string): ClientPortalPreviewTokenPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expected = sign(encodedPayload)
  if (!safeEqual(signature, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as ClientPortalPreviewTokenPayload
    if (!payload.dossier_id || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url')
}

function getSecret() {
  const secret = process.env.CLIENT_PORTAL_PREVIEW_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('CLIENT_PORTAL_PREVIEW_SECRET missing')
  return secret
}

function base64url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

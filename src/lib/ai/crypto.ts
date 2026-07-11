import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const VERSION = 'v1'

function keyMaterial() {
  const secret = process.env.AI_CREDENTIALS_SECRET
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AI_CREDENTIALS_SECRET doit être configuré en production')
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

  const decipher = createDecipheriv('aes-256-gcm', keyMaterial(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null
  if (value.length <= 8) return '••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

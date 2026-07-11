import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TTL_SECONDS,
  MagicTokenError,
  signMagicToken,
  verifyMagicToken,
} from '../magic-token'

const SECRET = 'unit-test-secret-please-rotate-in-prod'

const samplePayload = {
  jti: '11111111-1111-4111-8111-111111111111',
  type: 'vendre' as const,
  formData: { surface: 75, ville: 'Brignoles' },
  results: { low: 250000, mid: 270000, high: 290000 },
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

describe('magic-token', () => {
  it('roundtrip — un token signé est correctement vérifié et restitue le payload original', () => {
    const token = signMagicToken(samplePayload, { secret: SECRET })
    const decoded = verifyMagicToken(token, { secret: SECRET })

    expect(decoded.jti).toBe(samplePayload.jti)
    expect(decoded.type).toBe(samplePayload.type)
    expect(decoded.formData).toEqual(samplePayload.formData)
    expect(decoded.results).toEqual(samplePayload.results)
    expect(decoded.exp - decoded.iat).toBe(DEFAULT_TTL_SECONDS)
  })

  it('refuse un token altéré (signature invalide)', () => {
    const token = signMagicToken(samplePayload, { secret: SECRET })
    const [headerB64, payloadB64, signatureB64] = token.split('.')

    // On modifie le payload sans recalculer la signature.
    const tamperedPayloadObj = {
      ...JSON.parse(base64UrlDecode(payloadB64).toString('utf8')),
      jti: 'evil-jti',
    }
    const tamperedPayloadB64 = base64UrlEncode(
      Buffer.from(JSON.stringify(tamperedPayloadObj), 'utf8'),
    )
    const tampered = `${headerB64}.${tamperedPayloadB64}.${signatureB64}`

    expect(() => verifyMagicToken(tampered, { secret: SECRET })).toThrow(
      MagicTokenError,
    )
    try {
      verifyMagicToken(tampered, { secret: SECRET })
    } catch (err) {
      expect((err as MagicTokenError).code).toBe('invalid_signature')
    }
  })

  it('refuse un token expiré', () => {
    const issuedAtMs = Date.UTC(2026, 0, 1) // 2026-01-01T00:00:00Z
    const token = signMagicToken(samplePayload, {
      secret: SECRET,
      nowMs: issuedAtMs,
      ttlSeconds: 60,
    })

    // 61 secondes plus tard => expiré.
    const checkAtMs = issuedAtMs + 61_000

    expect(() =>
      verifyMagicToken(token, { secret: SECRET, nowMs: checkAtMs }),
    ).toThrow(MagicTokenError)
    try {
      verifyMagicToken(token, { secret: SECRET, nowMs: checkAtMs })
    } catch (err) {
      expect((err as MagicTokenError).code).toBe('expired')
    }
  })

  it('refuse un token avec mauvais secret', () => {
    const token = signMagicToken(samplePayload, { secret: SECRET })
    expect(() =>
      verifyMagicToken(token, { secret: 'autre-secret-de-test-1234' }),
    ).toThrow(MagicTokenError)
  })
})

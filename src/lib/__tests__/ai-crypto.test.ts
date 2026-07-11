import { describe, expect, it, vi, afterEach } from 'vitest'
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/ai/crypto'

describe('ai credentials crypto', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('encrypts and decrypts an API key without storing it in plain text', () => {
    vi.stubEnv('AI_CREDENTIALS_SECRET', 'unit-test-secret')
    const encrypted = encryptSecret('sk-test-123456')

    expect(encrypted).not.toContain('sk-test')
    expect(decryptSecret(encrypted)).toBe('sk-test-123456')
  })

  it('masks secrets for UI metadata', () => {
    expect(maskSecret('sk-test-123456')).toBe('sk-t••••3456')
  })
})

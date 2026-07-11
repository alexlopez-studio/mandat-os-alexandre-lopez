import { decryptSecret, encryptSecret, maskSecret } from '@/lib/ai/crypto'
import { adminDb, isMissingAiSchemaError } from '@/lib/ai/db'
import { AI_PROVIDER_CATALOG, getProvider, isAiProviderId, type AiProviderId } from '@/lib/ai/providers'
import { getSetting, setSetting } from '@/lib/settings'

export const AI_DEFAULT_PROVIDER_KEY = 'ai_default_provider'
export const AI_DEFAULT_MODEL_KEY = 'ai_default_model'

export type AiCredentialPublic = {
  id: string
  provider_id: AiProviderId
  label: string
  default_model: string | null
  status: 'active' | 'revoked' | 'error'
  last_tested_at: string | null
  last_error: string | null
  masked_key: string | null
  created_at: string
  updated_at: string
}

type AiCredentialRow = {
  id: string
  provider_id: AiProviderId
  label: string
  encrypted_api_key: string
  default_model: string | null
  status: 'active' | 'revoked' | 'error'
  last_tested_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export async function listAiCredentials(): Promise<AiCredentialPublic[]> {
  const { data, error } = await adminDb()
    .from('ai_credentials')
    .select('*')
    .neq('status', 'revoked')
    .order('updated_at', { ascending: false })

  if (error) {
    if (isMissingAiSchemaError(error)) return []
    throw new Error(error.message)
  }

  return ((data ?? []) as AiCredentialRow[]).map((row) => {
    let masked: string | null = null
    try {
      masked = maskSecret(decryptSecret(row.encrypted_api_key))
    } catch {
      masked = '••••••'
    }
    return {
      id: row.id,
      provider_id: row.provider_id,
      label: row.label,
      default_model: row.default_model,
      status: row.status,
      last_tested_at: row.last_tested_at,
      last_error: row.last_error,
      masked_key: masked,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })
}

export async function upsertAiCredential(input: {
  providerId: AiProviderId
  apiKey: string
  defaultModel?: string | null
  label?: string | null
}) {
  const provider = getProvider(input.providerId)
  if (!provider) throw new Error('Fournisseur IA inconnu')

  const defaultModel = input.defaultModel?.trim() || provider.defaultModel
  const payload = {
    provider_id: input.providerId,
    label: input.label?.trim() || provider.label,
    encrypted_api_key: encryptSecret(input.apiKey.trim()),
    default_model: defaultModel,
    status: 'active',
    last_error: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await adminDb()
    .from('ai_credentials')
    .upsert(payload, { onConflict: 'provider_id' })
    .select('*')
    .single()

  if (error) {
    if (isMissingAiSchemaError(error)) throw new Error('Migration 026 Assistant IA non appliquée')
    throw new Error(error.message)
  }
  await setSetting(AI_DEFAULT_PROVIDER_KEY, input.providerId)
  await setSetting(AI_DEFAULT_MODEL_KEY, defaultModel)
  return data as AiCredentialRow
}

export async function revokeAiCredential(id: string) {
  const { error } = await adminDb()
    .from('ai_credentials')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function setDefaultAiProvider(providerId: AiProviderId, model?: string | null) {
  const provider = getProvider(providerId)
  if (!provider) throw new Error('Fournisseur IA inconnu')
  await setSetting(AI_DEFAULT_PROVIDER_KEY, providerId)
  await setSetting(AI_DEFAULT_MODEL_KEY, model?.trim() || provider.defaultModel)
}

export async function resolveDefaultProvider() {
  const configuredProvider = await getSetting<string>(AI_DEFAULT_PROVIDER_KEY, 'openrouter')
  const providerId = isAiProviderId(configuredProvider) ? configuredProvider : 'openrouter'
  const provider = getProvider(providerId) ?? AI_PROVIDER_CATALOG[0]
  const model = await getSetting<string>(AI_DEFAULT_MODEL_KEY, provider.defaultModel)
  return { providerId: provider.id, model: model || provider.defaultModel }
}

export async function getActiveAiCredential(providerId?: AiProviderId | null) {
  const resolved = providerId ? { providerId, model: getProvider(providerId)?.defaultModel ?? null } : await resolveDefaultProvider()
  const { data, error } = await adminDb()
    .from('ai_credentials')
    .select('*')
    .eq('provider_id', resolved.providerId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as AiCredentialRow
  return {
    id: row.id,
    providerId: row.provider_id,
    apiKey: decryptSecret(row.encrypted_api_key),
    model: row.default_model || resolved.model || getProvider(row.provider_id)?.defaultModel || '',
  }
}

export async function markCredentialTested(providerId: AiProviderId, ok: boolean, errorMessage?: string) {
  const { error } = await adminDb()
    .from('ai_credentials')
    .update({
      status: ok ? 'active' : 'error',
      last_tested_at: new Date().toISOString(),
      last_error: ok ? null : errorMessage ?? 'Test échoué',
      updated_at: new Date().toISOString(),
    })
    .eq('provider_id', providerId)
    .neq('status', 'revoked')

  if (error) throw new Error(error.message)
}

import { getActiveAiCredential } from '@/lib/ai/credentials'
import { getProvider, type AiProviderId } from '@/lib/ai/providers'

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiGatewayResult = {
  content: string
  providerId: AiProviderId | 'fallback'
  model: string
  usage?: Record<string, unknown>
}

const SYSTEM_FALLBACK = `Assistant Mandat OS indisponible: aucune clé IA active n'est configurée.`

export async function aiChat(input: {
  messages: AiChatMessage[]
  providerId?: AiProviderId | null
  model?: string | null
}): Promise<AiGatewayResult> {
  const credential = await getActiveAiCredential(input.providerId ?? null)
  if (!credential) {
    return {
      content: buildLocalFallback(input.messages),
      providerId: 'fallback',
      model: 'local-fallback',
    }
  }

  const provider = getProvider(credential.providerId)
  const model = input.model?.trim() || credential.model || provider?.defaultModel || ''
  if (!provider) throw new Error('Fournisseur IA inconnu')

  if (provider.openAiCompatible && provider.baseUrl) {
    return callOpenAiCompatible({
      baseUrl: provider.baseUrl,
      apiKey: credential.apiKey,
      model,
      messages: input.messages,
      providerId: credential.providerId,
    })
  }

  if (credential.providerId === 'anthropic') {
    return callAnthropic({ apiKey: credential.apiKey, model, messages: input.messages })
  }

  if (credential.providerId === 'google') {
    return callGoogle({ apiKey: credential.apiKey, model, messages: input.messages })
  }

  if (credential.providerId === 'cohere') {
    return callCohere({ apiKey: credential.apiKey, model, messages: input.messages })
  }

  return {
    content: buildLocalFallback(input.messages),
    providerId: 'fallback',
    model: 'unsupported-provider',
  }
}

export async function testAiProvider(providerId: AiProviderId, model?: string | null) {
  const result = await aiChat({
    providerId,
    model,
    messages: [
      { role: 'system', content: 'Réponds uniquement par OK.' },
      { role: 'user', content: 'Test de connexion.' },
    ],
  })
  return result.providerId !== 'fallback'
}

async function callOpenAiCompatible(input: {
  baseUrl: string
  apiKey: string
  model: string
  messages: AiChatMessage[]
  providerId: AiProviderId
}): Promise<AiGatewayResult> {
  const res = await fetch(`${input.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      'X-Title': 'Mandat OS',
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: 0.25,
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(asProviderError(json, `Erreur ${input.providerId}`))

  return {
    content: json.choices?.[0]?.message?.content ?? '',
    providerId: input.providerId,
    model: input.model,
    usage: json.usage,
  }
}

async function callAnthropic(input: {
  apiKey: string
  model: string
  messages: AiChatMessage[]
}): Promise<AiGatewayResult> {
  const system = input.messages.find((message) => message.role === 'system')?.content
  const messages = input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': input.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: input.model,
      system,
      messages,
      max_tokens: 1400,
      temperature: 0.25,
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(asProviderError(json, 'Erreur Anthropic'))

  return {
    content: json.content?.map((part: { text?: string }) => part.text ?? '').join('\n').trim() ?? '',
    providerId: 'anthropic',
    model: input.model,
    usage: json.usage,
  }
}

async function callGoogle(input: {
  apiKey: string
  model: string
  messages: AiChatMessage[]
}): Promise<AiGatewayResult> {
  const prompt = input.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.25 },
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(asProviderError(json, 'Erreur Google Gemini'))

  return {
    content: json.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('\n').trim() ?? '',
    providerId: 'google',
    model: input.model,
    usage: json.usageMetadata,
  }
}

async function callCohere(input: {
  apiKey: string
  model: string
  messages: AiChatMessage[]
}): Promise<AiGatewayResult> {
  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
      temperature: 0.25,
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(asProviderError(json, 'Erreur Cohere'))

  return {
    content: json.message?.content?.map((part: { text?: string }) => part.text ?? '').join('\n').trim() ?? '',
    providerId: 'cohere',
    model: input.model,
    usage: json.meta,
  }
}

function asProviderError(json: unknown, fallback: string) {
  if (json && typeof json === 'object') {
    const record = json as Record<string, any>
    return record.error?.message ?? record.message ?? fallback
  }
  return fallback
}

function buildLocalFallback(messages: AiChatMessage[]) {
  const user = [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
  return [
    SYSTEM_FALLBACK,
    '',
    "Je peux quand même préparer une réponse de travail à valider :",
    `- Demande comprise : ${user.slice(0, 260) || 'non précisée'}`,
    "- Prochaine action recommandée : configurer une clé dans Paramètres > IA & intégrations.",
    "- Aucune action externe n'a été exécutée.",
  ].join('\n')
}

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

// ── Appel d'outils (boucle d'agent) ──────────────────────────
// Seuls les fournisseurs compatibles OpenAI sont supportés : ils partagent le
// même format `tools` / `tool_calls`. Anthropic et Google ont chacun le leur,
// et leur ajout demanderait une implémentation dédiée.

export type AiToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type AiToolCall = {
  id: string
  name: string
  arguments: string
}

export type AiConversationMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: AiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type AiToolTurn = {
  content: string
  toolCalls: AiToolCall[]
  providerId: AiProviderId
  model: string
  usage?: Record<string, unknown>
}

/** Un tour de boucle d'agent : le modèle répond, ou demande des outils. */
export async function aiChatWithTools(input: {
  messages: AiConversationMessage[]
  tools: AiToolDefinition[]
  providerId?: AiProviderId | null
  model?: string | null
}): Promise<AiToolTurn> {
  const credential = await getActiveAiCredential(input.providerId ?? null)
  if (!credential) throw new Error("Aucune clé IA active : configure un fournisseur dans les réglages.")

  const provider = getProvider(credential.providerId)
  if (!provider) throw new Error('Fournisseur IA inconnu')
  if (!provider.openAiCompatible || !provider.baseUrl) {
    throw new Error(`${provider.label} ne supporte pas encore l'appel d'outils dans Mandat OS.`)
  }

  const model = input.model?.trim() || credential.model || provider.defaultModel

  const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credential.apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      'X-Title': 'Mandat OS',
    },
    body: JSON.stringify({
      model,
      messages: input.messages.map(toWireMessage),
      temperature: 0.2,
      max_tokens: 1200,
      tools: input.tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      })),
      tool_choice: 'auto',
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Une boucle d'agent consomme 4 à 6 appels par message : les quotas
    // gratuits (6 000 tokens/minute chez Groq) sautent très vite. On le dit
    // clairement plutôt que de remonter l'erreur brute du fournisseur.
    if (res.status === 429) {
      throw new Error(
        "Quota du fournisseur IA atteint. L'agent consomme plusieurs appels par message : "
          + 'un palier payant est nécessaire, ou attends une minute avant de réessayer.',
      )
    }
    throw new Error(asProviderError(json, `Erreur ${credential.providerId}`))
  }

  const message = json.choices?.[0]?.message ?? {}
  const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []

  return {
    content: typeof message.content === 'string' ? message.content : '',
    toolCalls: rawCalls.map((call: Record<string, any>) => ({
      id: String(call.id ?? ''),
      name: String(call.function?.name ?? ''),
      arguments: String(call.function?.arguments ?? '{}'),
    })),
    providerId: credential.providerId,
    model,
    usage: json.usage,
  }
}

function toWireMessage(message: AiConversationMessage) {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.tool_call_id, content: message.content }
  }
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.content ?? '',
      ...(message.tool_calls?.length
        ? {
            tool_calls: message.tool_calls.map((call) => ({
              id: call.id,
              type: 'function',
              function: { name: call.name, arguments: call.arguments },
            })),
          }
        : {}),
    }
  }
  return { role: message.role, content: message.content }
}

export async function aiChat(input: {
  messages: AiChatMessage[]
  providerId?: AiProviderId | null
  model?: string | null
  /**
   * Force une reponse JSON.
   *
   * DeepSeek et les fournisseurs compatibles OpenAI n'exposent que le mode
   * `json_object` : il garantit un JSON syntaxiquement valide, jamais qu'il
   * respecte un schema. L'appelant doit donc valider la sortie (zod) et
   * gerer le cas documente ou le contenu revient vide.
   */
  json?: boolean
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
      json: input.json === true,
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

export async function testAiProvider(providerId: AiProviderId, model?: string | null, apiKey?: string | null) {
  let testModel = model?.trim() || null
  if (providerId === 'groq') {
    testModel = 'llama-3.1-8b-instant'
  } else if (testModel?.includes('whisper')) {
    testModel = 'gpt-4o-mini'
  }

  if (apiKey) {
    const provider = getProvider(providerId)
    if (!provider) throw new Error('Fournisseur IA inconnu')

    if (provider.openAiCompatible && provider.baseUrl) {
      const modelsRes = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (modelsRes.ok) return true

      const errJson = await modelsRes.json().catch(() => ({}))
      throw new Error(asProviderError(errJson, `Clé API ${provider.label} invalide ou refusée`))
    }

    if (providerId === 'anthropic') {
      const res = await callAnthropic({ apiKey, model: 'claude-3-5-haiku-latest', messages: [{ role: 'user', content: 'Test' }] })
      return Boolean(res.content)
    }

    if (providerId === 'google') {
      const res = await callGoogle({ apiKey, model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Test' }] })
      return Boolean(res.content)
    }
  }

  const result = await aiChat({
    providerId,
    model: testModel,
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
  json?: boolean
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
      // DeepSeek tronque le JSON si max_tokens est laisse au defaut bas.
      ...(input.json ? { response_format: { type: 'json_object' }, max_tokens: 2000 } : {}),
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

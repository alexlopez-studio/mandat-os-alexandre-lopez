export type AiProviderId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'groq'
  | 'perplexity'
  | 'together'
  | 'fireworks'
  | 'cohere'

export type AiCapability = 'chat' | 'structured' | 'classification' | 'summarization' | 'toolPlan'

export type AiProviderCatalogItem = {
  id: AiProviderId
  label: string
  category: 'direct' | 'router'
  defaultModel: string
  models: string[]
  capabilities: AiCapability[]
  helpUrl: string
  baseUrl?: string
  openAiCompatible?: boolean
}

export const AI_PROVIDER_CATALOG: AiProviderCatalogItem[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    category: 'router',
    defaultModel: 'openai/gpt-4.1-mini',
    models: ['openai/gpt-4.1-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash', 'mistralai/mistral-large'],
    capabilities: ['chat', 'structured', 'classification', 'summarization', 'toolPlan'],
    helpUrl: 'https://openrouter.ai/docs/quickstart',
    baseUrl: 'https://openrouter.ai/api/v1',
    openAiCompatible: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    category: 'direct',
    defaultModel: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
    capabilities: ['chat', 'structured', 'classification', 'summarization', 'toolPlan'],
    helpUrl: 'https://platform.openai.com/docs',
    baseUrl: 'https://api.openai.com/v1',
    openAiCompatible: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    category: 'direct',
    defaultModel: 'claude-3-5-sonnet-latest',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    capabilities: ['chat', 'structured', 'classification', 'summarization', 'toolPlan'],
    helpUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    category: 'direct',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    capabilities: ['chat', 'structured', 'classification', 'summarization'],
    helpUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    category: 'direct',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest'],
    capabilities: ['chat', 'structured', 'classification', 'summarization'],
    helpUrl: 'https://docs.mistral.ai',
    baseUrl: 'https://api.mistral.ai/v1',
    openAiCompatible: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    category: 'direct',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    capabilities: ['chat', 'structured', 'classification', 'summarization'],
    helpUrl: 'https://api-docs.deepseek.com',
    baseUrl: 'https://api.deepseek.com/v1',
    openAiCompatible: true,
  },
  {
    id: 'xai',
    label: 'xAI',
    category: 'direct',
    defaultModel: 'grok-3-mini',
    models: ['grok-3-mini', 'grok-3'],
    capabilities: ['chat', 'classification', 'summarization'],
    helpUrl: 'https://docs.x.ai',
    baseUrl: 'https://api.x.ai/v1',
    openAiCompatible: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    category: 'direct',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    capabilities: ['chat', 'classification', 'summarization'],
    helpUrl: 'https://console.groq.com/docs',
    baseUrl: 'https://api.groq.com/openai/v1',
    openAiCompatible: true,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    category: 'direct',
    defaultModel: 'sonar',
    models: ['sonar', 'sonar-pro'],
    capabilities: ['chat', 'summarization'],
    helpUrl: 'https://docs.perplexity.ai',
    baseUrl: 'https://api.perplexity.ai',
    openAiCompatible: true,
  },
  {
    id: 'together',
    label: 'Together AI',
    category: 'direct',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'],
    capabilities: ['chat', 'classification', 'summarization'],
    helpUrl: 'https://docs.together.ai',
    baseUrl: 'https://api.together.xyz/v1',
    openAiCompatible: true,
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    category: 'direct',
    defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    models: ['accounts/fireworks/models/llama-v3p1-70b-instruct'],
    capabilities: ['chat', 'classification', 'summarization'],
    helpUrl: 'https://docs.fireworks.ai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    openAiCompatible: true,
  },
  {
    id: 'cohere',
    label: 'Cohere',
    category: 'direct',
    defaultModel: 'command-r-plus',
    models: ['command-r-plus', 'command-r'],
    capabilities: ['chat', 'classification', 'summarization'],
    helpUrl: 'https://docs.cohere.com',
  },
]

export function getProvider(id: string | null | undefined) {
  return AI_PROVIDER_CATALOG.find((provider) => provider.id === id)
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && AI_PROVIDER_CATALOG.some((provider) => provider.id === value)
}

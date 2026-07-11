import { supabaseAdmin } from '@/lib/supabase'

export function adminDb() {
  return supabaseAdmin as any
}

export function isMissingAiSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  return record.code === '42P01'
    || message.includes('ai_credentials')
    || message.includes('ai_action_queue')
    || message.includes('granola_connections')
    || message.includes('external_transcripts')
}

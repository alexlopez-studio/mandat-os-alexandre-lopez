import { adminDb, isMissingAiSchemaError } from '@/lib/ai/db'
import type { Json } from '@/types/supabase'

export type AiActionStatus = 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed'

export type ProposedAiAction = {
  title: string
  description?: string | null
  action_type: string
  risk_level?: 'low' | 'medium' | 'high'
  dossier_id?: string | null
  thread_id?: string | null
  source?: string
  payload?: Json
}

export async function enqueueAiAction(action: ProposedAiAction) {
  const { data, error } = await adminDb()
    .from('ai_action_queue')
    .insert({
      title: action.title,
      description: action.description ?? null,
      action_type: action.action_type,
      risk_level: action.risk_level ?? 'medium',
      dossier_id: action.dossier_id ?? null,
      thread_id: action.thread_id ?? null,
      source: action.source ?? 'assistant',
      payload: action.payload ?? {},
      proposed_by: 'assistant',
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingAiSchemaError(error)) throw new Error('Migration 026 Assistant IA non appliquée')
    throw new Error(error.message)
  }
  return data
}

export async function listAiActions(status?: string | null) {
  let query = adminDb()
    .from('ai_action_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    if (isMissingAiSchemaError(error)) return []
    throw new Error(error.message)
  }
  return data ?? []
}

export async function reviewAiAction(id: string, status: Extract<AiActionStatus, 'approved' | 'rejected'>) {
  const { data, error } = await adminDb()
    .from('ai_action_queue')
    .update({
      status,
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['proposed', 'failed'])
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function executeAiAction(id: string) {
  const { data: action, error } = await adminDb()
    .from('ai_action_queue')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!action) throw new Error('Action introuvable')
  if (!['approved', 'proposed'].includes(action.status)) throw new Error('Action non approuvée')

  try {
    const result = await executeApprovedAction(action)
    const { data: updated, error: updateError } = await adminDb()
      .from('ai_action_queue')
      .update({
        status: 'executed',
        result,
        error: null,
        executed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) throw new Error(updateError.message)
    return updated
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await adminDb()
      .from('ai_action_queue')
      .update({ status: 'failed', error: message })
      .eq('id', id)
    throw err
  }
}

export function suggestActionsFromMessage(input: {
  message: string
  assistantContent: string
  dossierId?: string | null
  threadId?: string | null
}): ProposedAiAction[] {
  const lower = `${input.message} ${input.assistantContent}`.toLowerCase()
  const actions: ProposedAiAction[] = []

  if (input.dossierId && /transcript|granola|compte.?rendu|rdv|visite|réunion|reunion/.test(lower)) {
    actions.push({
      title: 'Ajouter un compte rendu au dossier',
      description: 'Créer un jalon interne à partir de la synthèse IA, après validation.',
      action_type: 'create_dossier_event',
      risk_level: 'medium',
      dossier_id: input.dossierId,
      thread_id: input.threadId,
      payload: {
        type: 'note',
        title: 'Compte rendu préparé par IA',
        description: input.assistantContent.slice(0, 1800),
        status: 'info',
        visible_to_client: false,
      },
    })
  }

  if (/mail|email|e-mail|réponse|relance/.test(lower)) {
    actions.push({
      title: 'Préparer un brouillon email',
      description: 'Créer un brouillon de réponse à relire avant envoi.',
      action_type: 'draft_email',
      risk_level: 'high',
      dossier_id: input.dossierId ?? null,
      thread_id: input.threadId,
      payload: { draft: input.assistantContent.slice(0, 3000) },
    })
  }

  if (input.dossierId && /document|pièce|piece|diagnostic|notaire|dossier/.test(lower)) {
    actions.push({
      title: 'Revoir la checklist documents',
      description: 'Signaler les pièces manquantes ou à relancer.',
      action_type: 'review_documents',
      risk_level: 'low',
      dossier_id: input.dossierId,
      thread_id: input.threadId,
      payload: { note: input.assistantContent.slice(0, 1600) },
    })
  }

  return actions.slice(0, 3)
}

async function executeApprovedAction(action: any): Promise<Json> {
  if (action.action_type === 'create_dossier_event') {
    const payload = asRecord(action.payload)
    const dossierId = action.dossier_id ?? asText(payload.dossier_id)
    if (!dossierId) throw new Error('Dossier requis')

    const { data, error } = await adminDb()
      .from('client_dossier_events')
      .insert({
        dossier_id: dossierId,
        type: asText(payload.type) ?? 'note',
        title: asText(payload.title) ?? action.title,
        description: asText(payload.description),
        status: asText(payload.status) ?? 'info',
        event_date: asText(payload.event_date),
        payload,
        visible_to_client: Boolean(payload.visible_to_client),
        created_by: 'assistant_validated',
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return { client_dossier_event_id: data.id }
  }

  return { queued_only: true, reason: 'Action sans exécuteur automatique en V1' }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

import { adminDb } from '@/lib/ai/db'
import type { AiConversationMessage, AiToolCall } from '@/lib/ai/gateway'

/**
 * Mémoire de conversation.
 *
 * Le webhook est sans état : sans ce module, l'agent ne pourrait pas poser une
 * question et comprendre la réponse envoyée au message suivant. On réutilise
 * `ai_threads` / `ai_messages`, déjà présentes depuis la migration 026.
 */

/** Au-delà de ce délai sans échange, on repart d'une conversation vierge. */
const THREAD_IDLE_MINUTES = 120

/**
 * Nombre de messages rechargés — borne le coût de chaque tour.
 *
 * Un seul échange produit facilement 4 à 6 lignes (assistant, appels d'outils,
 * résultats, réponse finale) : une fenêtre trop courte ne tient même pas trois
 * demandes.
 */
const HISTORY_LIMIT = 40

function ownerFor(chatId: number) {
  return `telegram:${chatId}`
}

/**
 * Récupère la conversation en cours, ou en ouvre une nouvelle si la dernière
 * activité est trop ancienne.
 */
export async function getOrCreateThread(chatId: number): Promise<string> {
  const owner = ownerFor(chatId)
  const cutoff = new Date(Date.now() - THREAD_IDLE_MINUTES * 60 * 1000).toISOString()

  const { data: existing } = await adminDb()
    .from('ai_threads')
    .select('id, updated_at')
    .eq('created_by', owner)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)

  const thread = (existing ?? [])[0]
  if (thread && thread.updated_at > cutoff) return thread.id as string

  // Conversation trop ancienne : on l'archive pour repartir propre.
  if (thread) {
    await adminDb().from('ai_threads').update({ status: 'archived' }).eq('id', thread.id)
  }

  const { data, error } = await adminDb()
    .from('ai_threads')
    .insert({ title: 'Conversation Telegram', created_by: owner, status: 'active' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

export async function loadHistory(threadId: string): Promise<AiConversationMessage[]> {
  // Tri décroissant puis remise à l'endroit : on veut les messages les plus
  // RÉCENTS. Trié à l'endroit, la troncature gardait le début du fil et
  // coupait le message qu'Alexandre vient d'envoyer — l'agent répondait alors
  // à une demande vieille d'une heure.
  const { data, error } = await adminDb()
    .from('ai_messages')
    .select('role, content, metadata')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as Array<Record<string, any>>).reverse()

  const messages: AiConversationMessage[] = []
  for (const row of rows) {
    if (row.role === 'user') {
      messages.push({ role: 'user', content: row.content })
    } else if (row.role === 'assistant') {
      const toolCalls = row.metadata?.tool_calls as AiToolCall[] | undefined
      messages.push({
        role: 'assistant',
        content: row.content || null,
        ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
      })
    } else if (row.role === 'tool') {
      messages.push({
        role: 'tool',
        tool_call_id: String(row.metadata?.tool_call_id ?? ''),
        content: row.content,
      })
    }
  }
  return trimToCleanStart(messages)
}

/**
 * La troncature peut tomber au milieu d'un échange d'outils. Un message `tool`
 * dont l'appel a disparu fait rejeter toute la requête par le fournisseur : on
 * repart donc du premier message d'Alexandre présent dans la fenêtre.
 */
function trimToCleanStart(messages: AiConversationMessage[]): AiConversationMessage[] {
  const first = messages.findIndex((message) => message.role === 'user')
  return first <= 0 ? messages : messages.slice(first)
}

export async function appendUser(threadId: string, content: string) {
  await insert(threadId, 'user', content, {})
}

export async function appendAssistant(threadId: string, content: string, toolCalls: AiToolCall[]) {
  await insert(threadId, 'assistant', content, toolCalls.length ? { tool_calls: toolCalls } : {})
}

export async function appendToolResult(threadId: string, toolCallId: string, content: string) {
  await insert(threadId, 'tool', content, { tool_call_id: toolCallId })
}

async function insert(threadId: string, role: string, content: string, metadata: Record<string, unknown>) {
  await adminDb().from('ai_messages').insert({ thread_id: threadId, role, content, metadata })
  await adminDb().from('ai_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
}

/** Referme la conversation en cours — commande /nouveau. */
export async function resetThread(chatId: number) {
  await adminDb()
    .from('ai_threads')
    .update({ status: 'archived' })
    .eq('created_by', ownerFor(chatId))
    .eq('status', 'active')
}

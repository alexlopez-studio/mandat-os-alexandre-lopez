import { NextRequest, NextResponse } from 'next/server'
import { enqueueAiAction, suggestActionsFromMessage } from '@/lib/ai/actions'
import { aiChatWithTools, type AiConversationMessage } from '@/lib/ai/gateway'
import { adminDb } from '@/lib/ai/db'
import { loadAiDossierContext, renderDossierContext } from '@/lib/ai/dossier-context'
import { isAiProviderId } from '@/lib/ai/providers'
import { executeGoogleTool, GOOGLE_TOOL_DEFINITIONS } from '@/lib/google/tools'

/** Garde-fou : au-delà, on rend la main plutôt que de boucler indéfiniment. */
const MAX_STEPS = 6

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message?: unknown
      thread_id?: unknown
      dossier_id?: unknown
      provider_id?: unknown
      model?: unknown
    }

    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return NextResponse.json({ success: false, error: 'Message requis' }, { status: 400 })

    const dossierId = typeof body.dossier_id === 'string' && body.dossier_id ? body.dossier_id : null
    const providerId = isAiProviderId(body.provider_id) ? body.provider_id : null
    const model = typeof body.model === 'string' ? body.model : null
    const context = dossierId ? await loadAiDossierContext(dossierId) : null

    const thread = await ensureThread({
      threadId: typeof body.thread_id === 'string' ? body.thread_id : null,
      dossierId,
      providerId,
      model,
      title: message.slice(0, 80),
    })

    await adminDb().from('ai_messages').insert({
      thread_id: thread.id,
      role: 'user',
      content: message,
      metadata: { dossier_id: dossierId },
    })

    const { data: history } = await adminDb()
      .from('ai_messages')
      .select('role, content')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(20)

    const today = new Date()
    const messages: AiConversationMessage[] = [
      {
        role: 'system',
        content: [
          `Nous sommes le ${today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${today.toISOString().slice(0, 10)}).`,
          'Tu es l’assistant privé Mandat OS d’Alexandre Lopez, conseiller immobilier iad.',
          'Tu aides à gérer les dossiers, emails, documents, rendez-vous et comptes rendus.',
          '',
          'Tu disposes d’outils branchés sur son compte Google : documents Drive, messagerie Gmail, agenda.',
          'Utilise-les dès qu’une question porte sur un document, un échange ou une date — ne réponds jamais',
          'de mémoire sur ces sujets, et n’invente jamais un nom de fichier ni le contenu d’un mail.',
          'Convertis toi-même les dates relatives en AAAA-MM-JJ à partir de la date du jour indiquée plus haut.',
          'Quand tu cites un document, donne son nom et son lien Drive.',
          '',
          'Ces outils sont en lecture seule. Tu ne déclenches jamais une action externe sans validation humaine :',
          'pour un envoi de mail ou une écriture dans l’agenda, propose-la, ne la fais pas.',
          'Réponds en français, de façon concise, orientée prochaine action.',
          renderDossierContext(context),
        ].join('\n'),
      },
      ...((history ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>).filter(
        (item) => item.role === 'user' || item.role === 'assistant',
      ),
    ]

    // Boucle d'agent : le modèle alterne appels d'outils et réflexion jusqu'à
    // produire une réponse en clair.
    let result = await aiChatWithTools({ providerId, model, messages, tools: GOOGLE_TOOL_DEFINITIONS })

    for (let step = 0; step < MAX_STEPS && result.toolCalls.length > 0; step += 1) {
      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls,
      })

      for (const call of result.toolCalls) {
        const output = await executeGoogleTool(call.name, call.arguments)
        messages.push({ role: 'tool', tool_call_id: call.id, content: output })
      }

      result = await aiChatWithTools({ providerId, model, messages, tools: GOOGLE_TOOL_DEFINITIONS })
    }

    await adminDb().from('ai_messages').insert({
      thread_id: thread.id,
      role: 'assistant',
      content: result.content,
      metadata: { provider_id: result.providerId, model: result.model, usage: result.usage ?? null },
    })

    const proposed = []
    for (const action of suggestActionsFromMessage({
      message,
      assistantContent: result.content,
      dossierId,
      threadId: thread.id,
    })) {
      proposed.push(await enqueueAiAction(action))
    }

    return NextResponse.json({
      success: true,
      data: {
        thread_id: thread.id,
        answer: result.content,
        provider_id: result.providerId,
        model: result.model,
        proposed_actions: proposed,
      },
    })
  } catch (err) {
    console.error('[POST /api/ai/chat]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur assistant IA' }, { status: 500 })
  }
}

async function ensureThread(input: {
  threadId: string | null
  dossierId: string | null
  providerId: string | null
  model: string | null
  title: string
}) {
  if (input.threadId) {
    const { data, error } = await adminDb()
      .from('ai_threads')
      .select('*')
      .eq('id', input.threadId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return data
  }

  let validDossierFk: string | null = null
  if (input.dossierId) {
    const { data: dossierRow } = await adminDb()
      .from('client_dossiers')
      .select('id')
      .eq('id', input.dossierId)
      .maybeSingle()
    if (dossierRow) {
      validDossierFk = dossierRow.id
    }
  }

  const { data, error } = await adminDb()
    .from('ai_threads')
    .insert({
      title: input.title || 'Conversation IA',
      dossier_id: validDossierFk,
      provider_id: input.providerId,
      model: input.model,
      created_by: 'admin',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

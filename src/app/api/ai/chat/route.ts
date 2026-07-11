import { NextRequest, NextResponse } from 'next/server'
import { enqueueAiAction, suggestActionsFromMessage } from '@/lib/ai/actions'
import { aiChat } from '@/lib/ai/gateway'
import { adminDb } from '@/lib/ai/db'
import { loadAiDossierContext, renderDossierContext } from '@/lib/ai/dossier-context'
import { isAiProviderId } from '@/lib/ai/providers'

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

    const result = await aiChat({
      providerId,
      model,
      messages: [
        {
          role: 'system',
          content: [
            'Tu es l’assistant privé Mandat OS d’Alexandre Lopez, conseiller immobilier iad.',
            'Tu aides à gérer les dossiers, emails, documents, rendez-vous et comptes rendus.',
            'Tu ne déclenches jamais une action externe sans validation humaine.',
            'Réponds en français, de façon concise, orientée prochaine action.',
            renderDossierContext(context),
          ].join('\n'),
        },
        ...((history ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>).filter((item) => item.role === 'user' || item.role === 'assistant'),
      ],
    })

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

  const { data, error } = await adminDb()
    .from('ai_threads')
    .insert({
      title: input.title || 'Conversation IA',
      dossier_id: input.dossierId,
      provider_id: input.providerId,
      model: input.model,
      created_by: 'admin',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

import { adminDb } from '@/lib/ai/db'
import { escapeHtml, sendMessage, type TelegramConfig } from '@/lib/telegram/client'
import { extractIntent, listOpportunityCandidates } from '@/lib/telegram/extraction'
import { applyExtraction, listRecap, undoOperation } from '@/lib/telegram/journal'
import { env } from '@/lib/env'

const CONFIDENCE_FLOOR = 0.5

const HELP = [
  '<b>Mandat OS — assistant</b>',
  '',
  'Ecris-moi simplement ce que tu veux retenir :',
  '· « les Dupont acceptent 285, ils sont presses »',
  '· « rappelle-moi de relancer Martin jeudi »',
  '· « nouveau vendeur Bernard a Rocbaron, 06 12 34 56 78 »',
  '',
  '<b>Commandes</b>',
  '/recap — ce que j\'ai enregistre aujourd\'hui',
  '/recap semaine — les 7 derniers jours',
  '/annuler — annule la derniere operation',
  '/annuler 47 — annule l\'operation #47',
].join('\n')

export async function handleTextMessage(config: TelegramConfig, text: string) {
  const trimmed = text.trim()

  if (trimmed.startsWith('/')) {
    return handleCommand(config, trimmed)
  }

  const candidates = await listOpportunityCandidates()
  const { extraction } = await extractIntent({ text: trimmed, candidates })

  if (extraction.intent === 'unknown') {
    await sendMessage(config, "Je n'ai pas compris de quoi il s'agit. Reformule, ou tape /aide.")
    return
  }

  // Une note sans dossier identifie serait rangee nulle part : on prefere demander.
  if ((extraction.intent === 'note' || extraction.intent === 'task') && !extraction.target_id) {
    const hint = extraction.target_name ? ` pour « ${escapeHtml(extraction.target_name)} »` : ''
    await sendMessage(
      config,
      `Je n'ai pas trouve de dossier${hint}.\nPrecise le nom et la ville, ou cree le contact d'abord.`,
    )
    return
  }

  if (extraction.confidence < CONFIDENCE_FLOOR && extraction.target_id) {
    const label = labelFor(candidates, extraction.target_id)
    await sendMessage(
      config,
      `Je ne suis pas sur du dossier (${escapeHtml(label ?? 'inconnu')}).\nRenvoie le message en precisant le nom complet et la ville.`,
    )
    return
  }

  const operation = await applyExtraction({
    chatId: config.allowedChatId,
    sourceText: trimmed,
    extraction,
    candidateLabel: extraction.target_id ? labelFor(candidates, extraction.target_id) : null,
  })

  const link = extraction.target_id
    ? `\n${env.app.siteUrl}/admin/market/opportunities/${extraction.target_id}`
    : ''

  await sendMessage(config, `✅ <b>#${operation.ref}</b> ${escapeHtml(operation.summary)}${link}`)
}

async function handleCommand(config: TelegramConfig, command: string) {
  const [name, ...args] = command.split(/\s+/)

  switch (name) {
    case '/start':
    case '/aide':
    case '/help':
      await sendMessage(config, HELP)
      return

    case '/recap': {
      const days = args[0]?.toLowerCase().startsWith('sem') ? 7 : 1
      const entries = await listRecap(config.allowedChatId, days)
      if (entries.length === 0) {
        await sendMessage(config, days === 1 ? "Rien d'enregistre aujourd'hui." : 'Rien enregistre cette semaine.')
        return
      }
      const lines = entries.map((entry) => {
        const mark = entry.status === 'undone' ? '↩️' : '·'
        return `${mark} <b>#${entry.ref}</b> ${escapeHtml(entry.summary)}`
      })
      await sendMessage(config, [days === 1 ? "<b>Aujourd'hui</b>" : '<b>7 derniers jours</b>', '', ...lines].join('\n'))
      return
    }

    case '/annuler': {
      const ref = args[0] ? Number(args[0].replace('#', '')) : undefined
      if (args[0] && !Number.isFinite(ref)) {
        await sendMessage(config, 'Numero invalide. Exemple : /annuler 47')
        return
      }
      const summary = await undoOperation(config.allowedChatId, ref)
      await sendMessage(config, `↩️ Annule — ${escapeHtml(summary)}`)
      return
    }

    default:
      await sendMessage(config, `Commande inconnue : ${escapeHtml(name)}\nTape /aide.`)
  }
}

function labelFor(
  candidates: Awaited<ReturnType<typeof listOpportunityCandidates>>,
  id: string,
): string | null {
  const found = candidates.find((candidate) => candidate.id === id)
  if (!found) return null
  return [found.seller_name, found.property_city].filter(Boolean).join(' — ') || found.title
}

/** Marque le message brut comme traite ou en echec. */
export async function markMessage(updateId: number, status: 'processed' | 'failed', error?: string) {
  await adminDb()
    .from('telegram_messages')
    .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
    .eq('update_id', updateId)
}

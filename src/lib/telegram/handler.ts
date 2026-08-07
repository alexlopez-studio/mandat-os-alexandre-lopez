import { adminDb } from '@/lib/ai/db'
import { runAgent } from '@/lib/telegram/agent'
import { escapeHtml, sendMessage, type TelegramConfig } from '@/lib/telegram/client'
import { listRecap, undoOperation } from '@/lib/telegram/crm'
import { resetThread } from '@/lib/telegram/memory'

const HELP = [
  '<b>Mandat OS — assistant</b>',
  '',
  'Écris-moi ce que tu veux retenir, je consulte ta base et je te pose une question si quelque chose est ambigu :',
  '· « les Dupont acceptent 285, ils sont pressés »',
  '· « rappelle-moi de relancer Martin jeudi »',
  '· « nouveau vendeur Bernard à Rocbaron, 06 12 34 56 78 »',
  '',
  '<b>Commandes</b>',
  "/recap — ce que j'ai enregistré aujourd'hui",
  '/recap semaine — les 7 derniers jours',
  '/annuler — annule la dernière opération',
  "/annuler 47 — annule l'opération #47",
  '/nouveau — repart d\'une conversation vierge',
].join('\n')

export async function handleTextMessage(config: TelegramConfig, text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith('/')) return handleCommand(config, trimmed)

  const { answer, operations } = await runAgent({ chatId: config.allowedChatId, text: trimmed })

  // Les références des écritures sont ajoutées sous la réponse : elles sont
  // ce qu'Alexandre réutilise pour /annuler.
  const refs = operations.map((operation) => `✅ <b>#${operation.ref}</b> ${escapeHtml(operation.summary)}`)
  const body = [escapeHtml(answer), ...(refs.length ? ['', ...refs] : [])].join('\n')

  await sendMessage(config, body)
}

async function handleCommand(config: TelegramConfig, command: string) {
  const [name, ...args] = command.split(/\s+/)

  switch (name) {
    case '/start':
    case '/aide':
    case '/help':
      await sendMessage(config, HELP)
      return

    case '/nouveau':
      await resetThread(config.allowedChatId)
      await sendMessage(config, "C'est reparti de zéro. De quoi veux-tu me parler ?")
      return

    case '/recap': {
      const days = args[0]?.toLowerCase().startsWith('sem') ? 7 : 1
      const entries = await listRecap(config.allowedChatId, days)
      if (entries.length === 0) {
        await sendMessage(config, days === 1 ? "Rien d'enregistré aujourd'hui." : 'Rien enregistré cette semaine.')
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
        await sendMessage(config, 'Numéro invalide. Exemple : /annuler 47')
        return
      }
      const summary = await undoOperation(config.allowedChatId, ref)
      await sendMessage(config, `↩️ Annulé — ${escapeHtml(summary)}`)
      return
    }

    default:
      await sendMessage(config, `Commande inconnue : ${escapeHtml(name)}\nTape /aide.`)
  }
}

/** Marque le message brut comme traité ou en échec. */
export async function markMessage(updateId: number, status: 'processed' | 'failed', error?: string) {
  await adminDb()
    .from('telegram_messages')
    .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
    .eq('update_id', updateId)
}

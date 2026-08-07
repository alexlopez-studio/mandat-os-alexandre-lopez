import { adminDb } from '@/lib/ai/db'
import { escapeHtml, sendMessage, type TelegramConfig } from '@/lib/telegram/client'
import {
  candidateLabel,
  extractIntent,
  findByName,
  listCandidates,
  type Candidate,
} from '@/lib/telegram/extraction'
import { applyExtraction, listRecap, undoOperation } from '@/lib/telegram/journal'
import { env } from '@/lib/env'

const CONFIDENCE_FLOOR = 0.5

const HELP = [
  '<b>Mandat OS — assistant</b>',
  '',
  'Écris-moi simplement ce que tu veux retenir :',
  '· « les Dupont acceptent 285, ils sont pressés »',
  '· « rappelle-moi de relancer Martin jeudi »',
  '· « nouveau vendeur Bernard à Rocbaron, 06 12 34 56 78 »',
  '',
  '<b>Commandes</b>',
  "/recap — ce que j'ai enregistré aujourd'hui",
  '/recap semaine — les 7 derniers jours',
  '/annuler — annule la dernière opération',
  "/annuler 47 — annule l'opération #47",
].join('\n')

export async function handleTextMessage(config: TelegramConfig, text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith('/')) return handleCommand(config, trimmed)

  const candidates = await listCandidates()
  const { extraction } = await extractIntent({ text: trimmed, candidates })

  if (extraction.intent === 'unknown') {
    await sendMessage(config, "Je n'ai pas compris de quoi il s'agit. Reformule, ou tape /aide.")
    return
  }

  const isContact = extraction.intent === 'contact_seller' || extraction.intent === 'contact_buyer'

  // Garde-fou anti-doublon : si le nom existe deja, on ne cree pas un second
  // dossier — le modele n'a pas toujours reconnu la personne dans la liste.
  if (isContact) {
    const existing = findByName(candidates, extraction.contact?.name ?? extraction.target_name)
    if (existing) {
      await sendMessage(
        config,
        [
          `⚠️ <b>${escapeHtml(candidateLabel(existing))}</b> existe déjà.`,
          '',
          "Je n'ai rien créé pour éviter un doublon.",
          'Reformule en note si tu veux compléter sa fiche —',
          `par exemple : « ${escapeHtml(existing.name)} a un budget de 250 000 ».`,
        ].join('\n'),
      )
      return
    }
  }

  const target = extraction.target_id
    ? candidates.find((candidate) => candidate.id === extraction.target_id) ?? null
    : null

  if ((extraction.intent === 'note' || extraction.intent === 'task') && !target) {
    const hint = extraction.target_name ? ` pour « ${escapeHtml(extraction.target_name)} »` : ''
    await sendMessage(
      config,
      `Je n'ai pas trouvé de dossier${hint}.\nPrécise le nom et la ville, ou crée le contact d'abord.`,
    )
    return
  }

  if (target && extraction.confidence < CONFIDENCE_FLOOR) {
    await sendMessage(
      config,
      `Je ne suis pas sûr du dossier (${escapeHtml(candidateLabel(target))}).\nRenvoie le message en précisant le nom complet et la ville.`,
    )
    return
  }

  const operation = await applyExtraction({
    chatId: config.allowedChatId,
    sourceText: trimmed,
    extraction,
    target,
  })

  await sendMessage(config, `✅ <b>#${operation.ref}</b> ${escapeHtml(operation.summary)}${linkFor(target)}`)
}

function linkFor(target: Candidate | null) {
  if (!target || target.kind !== 'seller') return ''
  return `\n${env.app.siteUrl}/admin/market/opportunities/${target.id}`
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

/** Marque le message brut comme traite ou en echec. */
export async function markMessage(updateId: number, status: 'processed' | 'failed', error?: string) {
  await adminDb()
    .from('telegram_messages')
    .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
    .eq('update_id', updateId)
}

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/ai/db'
import { readTelegramConfig, sendMessage } from '@/lib/telegram/client'
import { handleTextMessage, markMessage } from '@/lib/telegram/handler'

/**
 * Webhook Telegram.
 *
 * Trois garde-fous, dans cet ordre :
 *  1. le secret d'en-tete, connu de Telegram seul ;
 *  2. l'allowlist du chat_id — tout autre expediteur est journalise puis ignore ;
 *  3. l'unicite de `update_id`, qui rend l'ensemble idempotent.
 *
 * Le traitement est synchrone : en texte pur il tient largement sous la limite
 * de 10 s du plan Vercel Hobby, et si Telegram reemettait malgre tout, le
 * point 3 empeche tout doublon.
 */

// On repond toujours 200 : un code d'erreur ferait reemettre Telegram en boucle.
const ACK = NextResponse.json({ ok: true })

export async function POST(req: NextRequest) {
  const config = readTelegramConfig()
  if (!config) {
    console.error('[telegram] configuration absente (TELEGRAM_BOT_TOKEN / ALLOWED_CHAT_ID / WEBHOOK_SECRET)')
    return ACK
  }

  if (req.headers.get('x-telegram-bot-api-secret-token') !== config.webhookSecret) {
    console.warn('[telegram] secret invalide — requete ignoree')
    return new NextResponse('forbidden', { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return ACK
  }

  const message = update.message
  const chatId = message?.chat?.id
  if (!update.update_id || !message || typeof chatId !== 'number') return ACK

  if (chatId !== config.allowedChatId) {
    // Journalise l'identifiant refuse : c'est ce qui permet de corriger
    // TELEGRAM_ALLOWED_CHAT_ID sans enquete si la valeur configuree est fausse.
    console.warn(`[telegram] expediteur refuse — chat_id=${chatId} (attendu ${config.allowedChatId})`)
    return ACK
  }

  const isVoice = Boolean(message.voice || message.audio)
  const text = message.text ?? ''

  // Idempotence : l'insertion echoue si l'update a deja ete recu.
  const { error: insertError } = await adminDb()
    .from('telegram_messages')
    .insert({
      update_id: update.update_id,
      chat_id: chatId,
      message_id: message.message_id ?? null,
      kind: isVoice ? 'voice' : text.startsWith('/') ? 'command' : 'text',
      body: text || null,
      raw: update as unknown as Record<string, unknown>,
    })

  if (insertError) {
    if (isDuplicate(insertError)) return ACK
    console.error('[telegram] enregistrement impossible', insertError)
    return ACK
  }

  try {
    if (isVoice) {
      await sendMessage(config, 'Le vocal arrive bientot — pour l\'instant, ecris-moi le message.')
      await markMessage(update.update_id, 'processed')
      return ACK
    }

    if (!text.trim()) {
      await markMessage(update.update_id, 'processed')
      return ACK
    }

    await handleTextMessage(config, text)
    await markMessage(update.update_id, 'processed')
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[telegram] traitement en echec', err)
    await markMessage(update.update_id, 'failed', detail).catch(() => {})
    await sendMessage(config, `⚠️ ${detail}`).catch(() => {})
  }

  return ACK
}

function isDuplicate(error: unknown) {
  if (!error || typeof error !== 'object') return false
  return (error as { code?: string }).code === '23505'
}

type TelegramUpdate = {
  update_id?: number
  message?: {
    message_id?: number
    text?: string
    voice?: unknown
    audio?: unknown
    chat?: { id?: number }
  }
}

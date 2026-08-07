/**
 * Client minimal de la Bot API Telegram.
 *
 * Le token est une chaine unique `<botId>:<secret>` : on ne la decoupe jamais,
 * elle se colle telle quelle apres `bot` dans l'URL.
 */

const API_BASE = 'https://api.telegram.org'

export type TelegramConfig = {
  token: string
  allowedChatId: number
  webhookSecret: string
}

/**
 * Lit la configuration Telegram depuis l'environnement.
 * Retourne null (et non une exception) si elle est incomplete, pour que le
 * webhook puisse repondre proprement plutot que de planter en 500.
 */
export function readTelegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const allowedChatId = Number(process.env.TELEGRAM_ALLOWED_CHAT_ID)
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!token || !webhookSecret || !Number.isFinite(allowedChatId) || allowedChatId === 0) return null
  return { token, allowedChatId, webhookSecret }
}

async function callTelegram(token: string, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.ok === false) {
    throw new Error(`Telegram ${method}: ${json?.description ?? res.status}`)
  }
  return json.result
}

export async function sendMessage(config: TelegramConfig, text: string) {
  return callTelegram(config.token, 'sendMessage', {
    chat_id: config.allowedChatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  })
}

/**
 * Enregistre l'URL du webhook aupres de Telegram.
 * A appeler une fois au deploiement, pas a chaque requete.
 */
export async function setWebhook(config: TelegramConfig, url: string) {
  return callTelegram(config.token, 'setWebhook', {
    url,
    secret_token: config.webhookSecret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  })
}

/** Echappe le HTML avant insertion dans un message `parse_mode: HTML`. */
export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

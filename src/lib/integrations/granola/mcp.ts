import { getGranolaAccessToken } from './connection'
import { parseGranolaMeetings } from './parse'
import { GRANOLA_MCP_URL, type GranolaMeeting } from './types'

/**
 * Client MCP distant (transport HTTP streamable).
 *
 * Granola n'expose pas d'API REST sur le plan gratuit : tout passe par un
 * serveur MCP en JSON-RPC 2.0. Chaque session commence par `initialize`, suivi
 * de la notification `notifications/initialized`, avant tout appel d'outil.
 *
 * Les reponses peuvent revenir en `application/json` ou en `text/event-stream`
 * selon l'implementation : les deux sont gerees ici.
 */

const PROTOCOL_VERSION = '2025-06-18'

/** ~100 requetes/minute cote Granola : 700 ms entre deux appels garde une marge. */
const MIN_INTERVAL_MS = 700

export class GranolaMcpClient {
  private sessionId: string | null = null
  private nextId = 1
  private lastCallAt = 0

  constructor(
    private readonly url: string,
    private readonly accessToken: string,
  ) {}

  async initialize(): Promise<void> {
    const result = await this.rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'mandat-os', version: '1.0.0' },
    })
    void result
    await this.notify('notifications/initialized', {})
  }

  /** Appelle un outil et renvoie le contenu texte concatene. */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const result = await this.rpc('tools/call', { name, arguments: args })
    const content = Array.isArray(result?.content) ? result.content : []

    if (result?.isError) {
      throw new Error(`Outil Granola "${name}" en erreur : ${extractText(content) || 'motif inconnu'}`)
    }

    return extractText(content)
  }

  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    await this.send({ jsonrpc: '2.0', method, params }, true)
  }

  private async rpc(method: string, params: Record<string, unknown>): Promise<any> {
    const id = this.nextId++
    const payload = await this.send({ jsonrpc: '2.0', id, method, params }, false)
    if (payload?.error) {
      const detail = payload.error.message ?? JSON.stringify(payload.error)
      throw new Error(`MCP Granola ${method} : ${detail}`)
    }
    return payload?.result
  }

  private async send(body: Record<string, unknown>, isNotification: boolean): Promise<any> {
    await this.throttle()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.accessToken}`,
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    }
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId

    const res = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body) })

    const session = res.headers.get('mcp-session-id')
    if (session) this.sessionId = session

    if (res.status === 401 || res.status === 403) {
      throw new Error('invalid_grant: le MCP Granola a refuse le jeton (reconnexion necessaire)')
    }
    if (isNotification) return null
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`MCP Granola HTTP ${res.status} : ${text.slice(0, 300)}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    const raw = await res.text()
    return contentType.includes('text/event-stream') ? parseSseEnvelope(raw) : safeJson(raw)
  }

  /** Espace les appels pour rester sous la limite de debit de Granola. */
  private async throttle(): Promise<void> {
    const wait = this.lastCallAt + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    this.lastCallAt = Date.now()
  }
}

/** Ouvre une session MCP authentifiee, ou `null` si Granola n'est pas connecte. */
export async function openGranolaSession(): Promise<GranolaMcpClient | null> {
  const auth = await getGranolaAccessToken()
  if (!auth) return null

  const client = new GranolaMcpClient(auth.connection.server_url ?? GRANOLA_MCP_URL, auth.token)
  await client.initialize()
  return client
}

/**
 * Liste les reunions de la fenetre demandee.
 *
 * `list_meetings` ne renvoie que les metadonnees : titre, date, participants.
 * Le resume s'obtient ensuite via `get_meetings`, par lots de 10 maximum.
 */
export async function listGranolaMeetings(
  client: GranolaMcpClient,
  timeRange: 'this_week' | 'last_week' | 'last_30_days' = 'last_30_days',
): Promise<GranolaMeeting[]> {
  return parseGranolaMeetings(await client.callTool('list_meetings', { time_range: timeRange }))
}

/** Detail (resume structure inclus) d'un lot de reunions. Maximum 10 par appel. */
export async function getGranolaMeetings(client: GranolaMcpClient, ids: string[]): Promise<GranolaMeeting[]> {
  const details: GranolaMeeting[] = []

  for (let index = 0; index < ids.length; index += 10) {
    const batch = ids.slice(index, index + 10)
    details.push(...parseGranolaMeetings(await client.callTool('get_meetings', { meeting_ids: batch })))
  }

  return details
}

export async function getGranolaAccountInfo(client: GranolaMcpClient): Promise<string> {
  return client.callTool('get_account_info', {})
}

function extractText(content: unknown[]): string {
  return content
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).text : null))
    .filter((text): text is string => typeof text === 'string')
    .join('\n')
}

/**
 * Enveloppe SSE : le corps est une suite de lignes `data:`. Seule la derniere
 * charge JSON valide nous interesse (la reponse a la requete envoyee).
 */
function parseSseEnvelope(raw: string): any {
  let last: any = null
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = safeJson(trimmed.slice(5).trim())
    if (payload) last = payload
  }
  return last
}

function safeJson(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

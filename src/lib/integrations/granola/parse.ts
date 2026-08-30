import type { GranolaMeeting, GranolaParticipant } from './types'

/**
 * Lecture des reponses du MCP Granola.
 *
 * Le serveur distant ne renvoie pas du JSON mais un balisage texte
 * (`<meetings_data><meeting id=… title=… date=…>…`). C'est donc ici que se joue
 * la fidelite de l'ingestion : un attribut mal lu, et l'idempotence saute
 * puisque `external_id` est la moitie de la cle unique.
 *
 * La fonction accepte aussi du JSON, au cas ou Granola bascule un jour de
 * format : un objet `{ meetings: [...] }` ou un tableau est normalise
 * directement, sans passer par le balisage.
 */
export function parseGranolaMeetings(payload: unknown): GranolaMeeting[] {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseGranolaMeetings(JSON.parse(trimmed))
      } catch {
        // Pas du JSON malgre l'accolade : on retombe sur le balisage.
      }
    }
    return parseMeetingsMarkup(trimmed)
  }

  if (Array.isArray(payload)) {
    return payload.map(normalizeMeetingObject).filter((meeting): meeting is GranolaMeeting => meeting !== null)
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const list = record.meetings ?? record.notes ?? record.data
    if (Array.isArray(list)) return parseGranolaMeetings(list)
    const single = normalizeMeetingObject(record)
    return single ? [single] : []
  }

  return []
}

/** Extrait les blocs `<meeting …>` d'une reponse MCP. */
export function parseMeetingsMarkup(text: string): GranolaMeeting[] {
  const meetings: GranolaMeeting[] = []
  const blockPattern = /<meeting\s([^>]*?)>([\s\S]*?)<\/meeting>/g

  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(text)) !== null) {
    const attributes = parseAttributes(match[1])
    const body = match[2]
    const externalId = attributes.id
    if (!externalId) continue

    meetings.push({
      external_id: externalId,
      title: decodeEntities(attributes.title ?? '').trim() || 'Reunion Granola',
      meeting_at: parseGranolaDate(attributes.date ?? null),
      summary: extractSection(body, 'summary'),
      transcript_text: extractSection(body, 'transcript'),
      participants: parseParticipants(extractSection(body, 'known_participants')),
      raw: {
        ...attributes,
        summary: extractSection(body, 'summary'),
        notes: extractSection(body, 'notes'),
        known_participants: extractSection(body, 'known_participants'),
      },
    })
  }

  return meetings
}

/**
 * Dates Granola : « Aug 22, 2026 10:34 AM GMT+2 ».
 *
 * Le decalage court (`GMT+2`) est hors norme ; il est ramene a `GMT+0200` avant
 * d'etre confie a `Date`, faute de quoi certains moteurs le rejettent
 * silencieusement et la reunion se retrouve sans date.
 */
export function parseGranolaDate(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = decodeEntities(value)
    .trim()
    .replace(/GMT([+-])(\d{1,2})(?::?(\d{2}))?$/, (_m, sign: string, hours: string, minutes?: string) =>
      `GMT${sign}${hours.padStart(2, '0')}${minutes ?? '00'}`,
    )

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeMeetingObject(value: unknown): GranolaMeeting | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>

  const externalId = asText(record.external_id) ?? asText(record.id) ?? asText(record.meeting_id)
  if (!externalId) return null

  const participants = Array.isArray(record.participants)
    ? record.participants
    : Array.isArray(record.attendees)
      ? record.attendees
      : []

  return {
    external_id: externalId,
    title: asText(record.title) ?? asText(record.name) ?? 'Reunion Granola',
    meeting_at:
      parseGranolaDate(asText(record.meeting_at) ?? asText(record.date) ?? asText(record.start_time) ?? asText(record.created_at)),
    summary: asText(record.summary) ?? asText(record.notes) ?? null,
    transcript_text: asText(record.transcript_text) ?? asText(record.transcript) ?? null,
    participants: participants
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((person) => ({
        name: asText(person.name),
        email: asText(person.email),
        company: asText(person.company),
      })),
    raw: record,
  }
}

/**
 * Participants : « Alexandre Lopez (note creator) from IAD <alex@exemple.fr> ».
 * L'e-mail est le seul point d'accroche identifiant fiable ; le reste est
 * indicatif et ne doit jamais suffire a creer une fiche contact.
 */
function parseParticipants(block: string | null): GranolaParticipant[] {
  if (!block) return []

  return block
    .split('\n')
    .map((line) => decodeEntities(line).trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const emailMatch = line.match(/<([^>]+@[^>]+)>/) ?? line.match(/([\w.+-]+@[\w.-]+\.\w+)/)
      const email = emailMatch ? emailMatch[1].trim() : null
      const companyMatch = line.match(/\sfrom\s+([^<]+?)(?:\s*<|$)/i)
      const isNoteCreator = /\(note creator\)/i.test(line)

      const name = line
        .replace(/<[^>]*>/g, '')
        .replace(/\(note creator\)/i, '')
        .replace(/\sfrom\s+.*$/i, '')
        .trim()

      return {
        name: name || null,
        email,
        company: companyMatch ? companyMatch[1].trim() : null,
        is_note_creator: isNoteCreator,
      }
    })
}

function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const pattern = /([\w-]+)\s*=\s*"([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(raw)) !== null) {
    attributes[match[1]] = decodeEntities(match[2])
  }
  return attributes
}

function extractSection(body: string, tag: string): string | null {
  const match = body.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  if (!match) return null
  const content = decodeEntities(match[1]).trim()
  return content.length > 0 ? content : null
}

function decodeEntities(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

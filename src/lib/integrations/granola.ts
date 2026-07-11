import { enqueueAiAction } from '@/lib/ai/actions'
import { encryptSecret, decryptSecret } from '@/lib/ai/crypto'
import { adminDb } from '@/lib/ai/db'
import { listDossierCandidates } from '@/lib/ai/dossier-context'

type GranolaConnection = {
  id: string
  encrypted_api_key: string
  status: string
}

type GranolaNoteListItem = {
  id: string
  title?: string
  created_at?: string
  start_time?: string
  summary?: string
}

type GranolaNoteDetail = GranolaNoteListItem & {
  transcript?: Array<{ text?: string; speaker?: Record<string, unknown> }>
  attendees?: Array<{ name?: string; email?: string }>
}

export async function upsertGranolaApiKey(apiKey: string) {
  const encrypted = encryptSecret(apiKey.trim())
  const { data: current, error: readError } = await adminDb()
    .from('granola_connections')
    .select('id')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (readError) throw new Error(readError.message)

  const query = current
    ? adminDb()
      .from('granola_connections')
      .update({
        encrypted_api_key: encrypted,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id)
    : adminDb()
    .from('granola_connections')
    .insert({
      label: 'Granola',
      encrypted_api_key: encrypted,
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    })

  const { data, error } = await query
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function syncGranolaNotes(input: { apiKey?: string | null; createdAfter?: string | null }) {
  if (input.apiKey?.trim()) await upsertGranolaApiKey(input.apiKey)
  const connection = await getGranolaConnection()
  if (!connection) throw new Error('Clé Granola absente')

  const apiKey = decryptSecret(connection.encrypted_api_key)
  const createdAfter = input.createdAfter ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const notes = await listGranolaNotes(apiKey, createdAfter)
  const candidates = await listDossierCandidates()

  let imported = 0
  let queued = 0

  for (const note of notes.slice(0, 20)) {
    const detail = await getGranolaNote(apiKey, note.id)
    const transcriptText = (detail.transcript ?? []).map((item) => item.text).filter(Boolean).join('\n')
    const summary = detail.summary ?? note.summary ?? ''
    const classification = classifyTranscript({ title: detail.title ?? note.title ?? 'Note Granola', summary, transcriptText, candidates })

    const { data: transcript, error } = await adminDb()
      .from('external_transcripts')
      .upsert({
        provider: 'granola',
        external_id: detail.id,
        title: detail.title ?? note.title ?? 'Note Granola',
        meeting_at: detail.start_time ?? detail.created_at ?? note.start_time ?? note.created_at ?? null,
        summary,
        transcript_text: transcriptText || null,
        raw_payload: detail,
        dossier_id: classification.dossierId,
        classification_confidence: classification.confidence,
        status: classification.dossierId && classification.confidence >= 0.62 ? 'classified' : 'needs_review',
      }, { onConflict: 'provider,external_id' })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    imported += 1

    if (classification.dossierId) {
      await enqueueAiAction({
        title: `Classer le transcript Granola: ${detail.title ?? note.title ?? 'Réunion'}`,
        description: classification.reason,
        action_type: 'create_dossier_event',
        risk_level: classification.confidence >= 0.75 ? 'low' : 'medium',
        dossier_id: classification.dossierId,
        source: 'granola',
        payload: {
          type: 'note',
          title: detail.title ?? note.title ?? 'Compte rendu Granola',
          description: [summary, transcriptText ? `\nExtrait transcript:\n${transcriptText.slice(0, 1800)}` : ''].join('\n').trim(),
          status: 'info',
          visible_to_client: false,
          external_transcript_id: transcript.id,
          confidence: classification.confidence,
        },
      })
      queued += 1
    } else {
      await enqueueAiAction({
        title: `Revoir le transcript Granola: ${detail.title ?? note.title ?? 'Réunion'}`,
        description: 'Aucun dossier client suffisamment probable.',
        action_type: 'review_transcript_classification',
        risk_level: 'medium',
        source: 'granola',
        payload: { external_transcript_id: transcript.id, title: detail.title ?? note.title },
      })
      queued += 1
    }
  }

  await adminDb()
    .from('granola_connections')
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq('id', connection.id)

  return { imported, queued }
}

async function getGranolaConnection(): Promise<GranolaConnection | null> {
  const { data, error } = await adminDb()
    .from('granola_connections')
    .select('id, encrypted_api_key, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as GranolaConnection | null
}

async function listGranolaNotes(apiKey: string, createdAfter: string): Promise<GranolaNoteListItem[]> {
  const url = new URL('https://public-api.granola.ai/v1/notes')
  url.searchParams.set('created_after', createdAfter)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error?.message ?? json.message ?? 'Erreur Granola')
  return json.notes ?? []
}

async function getGranolaNote(apiKey: string, noteId: string): Promise<GranolaNoteDetail> {
  const res = await fetch(`https://public-api.granola.ai/v1/notes/${encodeURIComponent(noteId)}?include=transcript`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error?.message ?? json.message ?? 'Erreur détail Granola')
  return json
}

function classifyTranscript(input: {
  title: string
  summary: string
  transcriptText: string
  candidates: any[]
}) {
  const haystack = normalize(`${input.title} ${input.summary} ${input.transcriptText}`)
  let best = { dossierId: null as string | null, score: 0, reason: 'Aucun signal.' }

  for (const candidate of input.candidates) {
    const profile = candidate.client_profile ?? {}
    const snapshot = candidate.property_snapshot ?? {}
    const terms = [
      candidate.title,
      profile.email,
      profile.first_name,
      profile.last_name,
      profile.phone,
      snapshot.commune,
      snapshot.adresse,
      snapshot.address,
      snapshot.type_bien,
    ].filter(Boolean).map((value) => normalize(String(value)))

    const matches = terms.filter((term) => term.length >= 3 && haystack.includes(term))
    const score = matches.length * 0.22 + (matches.some((term) => term.includes('@')) ? 0.25 : 0)
    if (score > best.score) {
      best = {
        dossierId: candidate.id,
        score,
        reason: `Signaux trouvés: ${matches.slice(0, 5).join(', ') || 'titre similaire'}`,
      }
    }
  }

  return {
    dossierId: best.score >= 0.22 ? best.dossierId : null,
    confidence: Math.min(0.99, Number(best.score.toFixed(3))),
    reason: best.reason,
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

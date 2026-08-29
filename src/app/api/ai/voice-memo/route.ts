import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/ai/db'
import { processVoiceMemo } from '@/lib/ai/voice-memo-processor'

// Augmenter la taille limite et le timeout pour les fichiers audio de réunion
export const maxDuration = 60 // 60 secondes max pour les requêtes lourdes

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const apiKeyHeader = req.headers.get('x-api-key')
    const isWebhookAuth = Boolean(authHeader?.startsWith('Bearer ') || apiKeyHeader)

    // Lecture du FormData
    const formData = await req.formData()
    const audioFile = formData.get('audio') || formData.get('file')
    const providedTranscript = (formData.get('transcript') as string | null) || (formData.get('text') as string | null)
    const contactId = formData.get('contact_id') as string | null
    const projectId = formData.get('project_id') as string | null
    const source = (formData.get('source') as string) || (isWebhookAuth ? 'ios_shortcut' : 'web')

    if (!(audioFile instanceof File) && !providedTranscript?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Veuillez fournir un fichier audio (champ "audio") ou une transcription texte (champ "transcript")' },
        { status: 400 }
      )
    }

    const audioBuffer = audioFile instanceof File ? Buffer.from(await audioFile.arrayBuffer()) : null

    // Extraction des photos jointes
    const photos: Array<{ buffer: Buffer; fileName: string; mimeType: string }> = []
    const allPhotoEntries = formData.getAll('photos')
    
    // Support également de champs photo_0, photo_1 ou photos multiples
    for (const entry of allPhotoEntries) {
      if (entry instanceof File && entry.type.startsWith('image/')) {
        photos.push({
          buffer: Buffer.from(await entry.arrayBuffer()),
          fileName: entry.name || 'photo.jpg',
          mimeType: entry.type || 'image/jpeg',
        })
      }
    }

    // Traitement de l'audio et des photos par le moteur Granola
    const result = await processVoiceMemo({
      audioBuffer,
      audioFileName: audioFile instanceof File ? audioFile.name : 'transcription.txt',
      audioMimeType: audioFile instanceof File ? audioFile.type : 'text/plain',
      providedTranscript,
      photos,
      contactId: contactId && contactId !== 'null' ? contactId : null,
      projectId: projectId && projectId !== 'null' ? projectId : null,
      source: source as 'ios_shortcut' | 'dictaphone' | 'telegram' | 'web',
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[POST /api/ai/voice-memo] Erreur de traitement:', error)
    const message = error instanceof Error ? error.message : 'Erreur interne lors du traitement vocal'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const contactId = searchParams.get('contact_id')
    const projectId = searchParams.get('project_id')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Tentative 1 : Table voice_memos
    const { data: voiceMemos, error: vmError } = await adminDb()
      .from('voice_memos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!vmError && voiceMemos) {
      let filtered = voiceMemos as Array<Record<string, unknown>>
      if (contactId) filtered = filtered.filter((m: Record<string, unknown>) => m.contact_id === contactId)
      if (projectId) filtered = filtered.filter((m: Record<string, unknown>) => m.project_id === projectId)
      return NextResponse.json({ success: true, data: filtered })
    }

    // Tentative 2 (Fallback) : Table activities
    let actQuery = adminDb()
      .from('activities')
      .select('*')
      .in('type', ['meeting', 'call'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (contactId) actQuery = actQuery.eq('contact_id', contactId)
    if (projectId) actQuery = actQuery.eq('opportunity_id', projectId)

    const { data: activities, error: actError } = await actQuery

    if (actError) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Transformation en VoiceMemoRecord
    const mapped = (activities || [])
      .filter((a: Record<string, any>) => a.metadata && typeof a.metadata === 'object' && a.metadata.voice_memo)
      .map((a: Record<string, any>) => {
        const meta = (a.metadata || {}) as Record<string, unknown>
        return {
          id: a.id,
          contact_id: a.contact_id,
          project_id: a.opportunity_id,
          opportunity_id: a.opportunity_id,
          title: (a.title || 'Compte-rendu').replace(/^🎙️\s*/, ''),
          meeting_type: (meta.meeting_type || 'general') as any,
          audio_url: (meta.audio_url as string) || null,
          audio_storage_path: null,
          audio_duration_seconds: null,
          photos: (meta.photos || []) as any,
          transcript: (meta.transcript as string) || a.content || '',
          structured_summary: (meta.structured_summary || {
            context: a.content || '',
            client_situation: '',
            key_points: [],
            objections_and_vigilance: [],
          }) as any,
          action_items: (meta.action_items || []) as any,
          lead_temperature: (meta.lead_temperature || 'warm') as any,
          source: (meta.source as string) || 'web',
          ai_provider: null,
          ai_model: null,
          created_at: a.created_at,
          updated_at: a.updated_at,
        }
      })

    return NextResponse.json({
      success: true,
      data: mapped,
    })
  } catch (error) {
    console.error('[GET /api/ai/voice-memo] Erreur:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}

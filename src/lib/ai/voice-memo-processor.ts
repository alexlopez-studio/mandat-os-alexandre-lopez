import { adminDb } from '@/lib/ai/db'
import { getActiveAiCredential } from '@/lib/ai/credentials'
import { VOICE_MEMO_BUCKET, signVoiceMemoPhotos, signVoiceMemoUrl } from '@/lib/ai/voice-memo-storage'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  GranolaProcessedResult,
  VoiceActionItem,
  VoiceAiProvider,
  VoiceMeetingType,
  VoicePhotoAttachment,
  VoiceProcessingDiagnostics,
  VoiceStructuredSummary,
  LeadTemperature,
} from './voice-memo-types'

/** Modeles Groq surs pour la synthese, quand aucun n'est choisi dans les Reglages. */
const GROQ_CHAT_FALLBACKS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

/**
 * Modeles Groq acceptant une image, pour l'OCR des photos de documents.
 * Le catalogue multimodal de Groq bouge vite : la liste est essayee dans
 * l'ordre et l'echec est sans consequence, la chaine reprend au moteur suivant.
 */
const GROQ_VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
]

/**
 * Modeles a essayer, dans l'ordre : celui choisi dans Reglages > Assistant IA
 * d'abord, puis les valeurs sures. Un modele de transcription selectionne par
 * erreur comme modele par defaut est ignore ici : Whisper ne fait pas de chat.
 */
function groqChatModels(preferred?: string | null): string[] {
  const candidate = preferred?.trim()
  const usable = candidate && !candidate.includes('whisper') ? [candidate] : []
  return [...new Set([...usable, ...GROQ_CHAT_FALLBACKS])]
}

type GranolaSummary = {
  title: string
  meeting_type: VoiceMeetingType
  matched_contact_id: string | null
  matched_project_id: string | null
  new_contact_suggested: GranolaProcessedResult['new_contact_suggested']
  structured_summary: VoiceStructuredSummary
  action_items: VoiceActionItem[]
  lead_temperature: LeadTemperature
}

type TranscriptionOutcome = {
  text: string
  provider: VoiceAiProvider
  model: string | null
  errors: string[]
}

interface ProcessVoiceMemoInput {
  audioBuffer?: Buffer | null
  audioFileName?: string
  audioMimeType?: string
  providedTranscript?: string | null
  photos?: Array<{
    buffer: Buffer
    fileName: string
    mimeType: string
  }>
  contactId?: string | null
  projectId?: string | null
  source?: 'ios_shortcut' | 'dictaphone' | 'telegram' | 'web'
}

/**
 * Orchestrateur principal : Transcription + Vision OCR + Extraction Granola + Sauvegarde Supabase
 */
export async function processVoiceMemo(input: ProcessVoiceMemoInput): Promise<GranolaProcessedResult> {
  const {
    audioBuffer = null,
    audioFileName = 'memo.m4a',
    audioMimeType = 'audio/m4a',
    providedTranscript = null,
    photos = [],
    contactId = null,
    projectId = null,
    source = 'web',
  } = input

  // 1. Récupération des clés IA actives avec fallback sécurisé
  const [openAiCred, groqCred, googleCred, openRouterCred, deepseekCred] = await Promise.all([
    getActiveAiCredential('openai').catch(() => null),
    getActiveAiCredential('groq').catch(() => null),
    getActiveAiCredential('google').catch(() => null),
    getActiveAiCredential('openrouter').catch(() => null),
    getActiveAiCredential('deepseek').catch(() => null),
  ])

  const openAiKey = openAiCred?.apiKey || process.env.OPENAI_API_KEY
  const groqKey = groqCred?.apiKey || process.env.GROQ_API_KEY
  const googleKey = googleCred?.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
  const openRouterKey = openRouterCred?.apiKey || process.env.OPENROUTER_API_KEY
  const deepseekKey = deepseekCred?.apiKey || process.env.DEEPSEEK_API_KEY

  // 2. Transcription de l'audio si pas déjà fournie par l'iPhone
  let transcript = providedTranscript?.trim() || ''
  let transcription: TranscriptionOutcome = {
    text: transcript,
    provider: 'none',
    model: transcript ? 'transcription fournie par l’appareil' : null,
    errors: [],
  }

  if (!transcript && audioBuffer) {
    transcription = await transcribeAudio({
      audioBuffer,
      audioFileName,
      audioMimeType,
      openAiKey,
      groqKey,
      googleKey,
    })
    transcript = transcription.text
  }

  // 3. Upload des médias vers Supabase Storage
  let audioStoragePath: string | null = null
  let audioUrl: string | undefined

  if (audioBuffer) {
    audioStoragePath = `audio/${crypto.randomUUID()}-${audioFileName.replace(/[^a-zA-Z0-9._-]+/g, '_')}`
    const audioUpload = await supabaseAdmin.storage
      .from(VOICE_MEMO_BUCKET)
      .upload(audioStoragePath, audioBuffer, {
        contentType: audioMimeType,
        upsert: false,
      })

    if (audioUpload.error) {
      console.warn('[processVoiceMemo] upload audio impossible:', audioUpload.error.message)
      audioStoragePath = null
    } else {
      // Lien temporaire pour la reponse immediate. Rien de durable n'est
      // stocke : le bucket est prive, les lectures re-signent depuis le chemin.
      audioUrl = (await signVoiceMemoUrl(audioStoragePath)) ?? undefined
    }
  }

  // Upload et analyse Vision des photos jointes
  const photoAttachments: VoicePhotoAttachment[] = []
  for (const photo of photos) {
    const photoStoragePath = `photos/${crypto.randomUUID()}-${photo.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_')}`
    const photoUpload = await supabaseAdmin.storage
      .from(VOICE_MEMO_BUCKET)
      .upload(photoStoragePath, photo.buffer, {
        contentType: photo.mimeType,
        upsert: false,
      })

    if (photoUpload.error) {
      console.warn('[processVoiceMemo] upload photo impossible:', photoUpload.error.message)
    }

    // Extraction OCR / Vision sur la photo si clé disponible
    const ocrData = await analyzePhotoWithVision({
      imageBuffer: photo.buffer,
      mimeType: photo.mimeType,
      openAiKey: openAiCred?.apiKey,
      googleKey: googleCred?.apiKey,
      openRouterKey: openRouterCred?.apiKey,
      groqKey,
    })

    photoAttachments.push({
      // Pas d'`url` ici : ce tableau part en base. Les liens sont signes a la
      // lecture, depuis `storage_path`.
      storage_path: photoUpload.error ? undefined : photoStoragePath,
      name: photo.fileName,
      mime_type: photo.mimeType,
      document_type: ocrData.documentType,
      ocr_extracted_text: ocrData.text,
      key_values: ocrData.keyValues,
    })
  }

  // 4. Contexte CRM pour le rapprochement
  const crmContext = await fetchCrmContext()

  // 5. Analyse Granola & Structuration par LLM
  const { summary: structuredData, provider: summaryProvider, model: summaryModel } = await generateGranolaSummary({
    transcript,
    photoAttachments,
    crmContext,
    forcedContactId: contactId,
    forcedProjectId: projectId,
    openAiKey,
    groqKey,
    googleKey,
    openRouterKey,
    deepseekKey,
    preferredGroqModel: groqCred?.model,
  })

  const matchedContactId = contactId || structuredData.matched_contact_id
  const matchedProjectId = projectId || structuredData.matched_project_id

  const diagnostics: VoiceProcessingDiagnostics = {
    transcription: {
      provider: transcription.provider,
      model: transcription.model,
      errors: transcription.errors,
    },
    summary: { provider: summaryProvider, model: summaryModel },
  }

  // 6. Enregistrement en base de données Supabase (activities + voice_memos)
  let voiceMemoId: string | undefined

  try {
    const { data: voiceMemoRow } = await adminDb()
      .from('voice_memos')
      .insert({
        contact_id: matchedContactId,
        project_id: matchedProjectId,
        title: structuredData.title,
        meeting_type: structuredData.meeting_type,
        // `audio_url` reste vide : un lien durable en base serait exploitable
        // par quiconque y accede. Seul le chemin est conserve.
        audio_url: null,
        audio_storage_path: audioStoragePath,
        photos: photoAttachments as unknown as Record<string, unknown>[],
        transcript,
        structured_summary: structuredData.structured_summary as unknown as Record<string, unknown>,
        action_items: structuredData.action_items as unknown as Record<string, unknown>[],
        lead_temperature: structuredData.lead_temperature,
        source,
        // Le moteur réellement utilisé, pas celui dont la clé existe : sans ça
        // une note transcrite par Groq était enregistrée comme « openai ».
        ai_provider: summaryProvider,
        ai_model: summaryModel,
        raw_ai_response: { diagnostics } as unknown as Record<string, unknown>,
      })
      .select('id, created_at')
      .single()

    voiceMemoId = voiceMemoRow?.id
  } catch (e) {
    console.warn('[voice-memo-processor] voice_memos table insert fallback:', e)
  }

  // Résolution d'un contact par défaut si aucun n'est matché pour satisfaire la contrainte CHECK de activities
  let targetContactId = matchedContactId
  const targetOpportunityId = matchedProjectId
  if (!targetContactId && !targetOpportunityId) {
    const firstContact = crmContext.contacts[0] as { id: string } | undefined
    if (firstContact?.id) {
      targetContactId = firstContact.id
    }
  }

  // Création de l'activité dans le journal CRM (table activities)
  if (targetContactId || targetOpportunityId) {
    const formattedContent = buildActivityMarkdown(structuredData, transcript, photoAttachments)
    const { data: actRow } = await adminDb()
      .from('activities')
      .insert({
        contact_id: targetContactId,
        opportunity_id: targetOpportunityId,
        type: structuredData.meeting_type === 'followup_call' ? 'call' : 'meeting',
        title: `🎙️ ${structuredData.title}`,
        content: formattedContent,
        metadata: {
          voice_memo: true,
          voice_memo_id: voiceMemoId,
          meeting_type: structuredData.meeting_type,
          lead_temperature: structuredData.lead_temperature,
          audio_storage_path: audioStoragePath,
          photos: photoAttachments,
          photos_count: photoAttachments.length,
          transcript,
          structured_summary: structuredData.structured_summary,
          action_items: structuredData.action_items,
          source,
        },
      })
      .select('id')
      .single()

    if (!voiceMemoId && actRow?.id) {
      voiceMemoId = actRow.id
    }

    // Création des tâches extraites dans activities
    for (const item of structuredData.action_items) {
      if (item.title) {
        await adminDb()
          .from('activities')
          .insert({
            contact_id: targetContactId,
            opportunity_id: targetOpportunityId,
            type: 'task',
            title: item.title,
            due_at: item.due_date || null,
            metadata: {
              priority: item.priority || 'normal',
              assignee: item.assignee || 'advisor',
              parent_voice_memo_id: voiceMemoId,
            },
          })
      }
    }
  }

  return {
    id: voiceMemoId,
    title: structuredData.title,
    meeting_type: structuredData.meeting_type,
    matched_contact_id: matchedContactId,
    matched_project_id: matchedProjectId,
    new_contact_suggested: structuredData.new_contact_suggested,
    structured_summary: structuredData.structured_summary,
    action_items: structuredData.action_items,
    lead_temperature: structuredData.lead_temperature,
    transcript,
    // Liens signes, valables le temps d'afficher la reponse.
    photos: await signVoiceMemoPhotos(photoAttachments),
    audio_url: audioUrl,
    source,
    created_at: new Date().toISOString(),
    diagnostics,
  }
}

// ─────────────────────────────────────────────────────────────
// Fonctions Internes
// ─────────────────────────────────────────────────────────────

async function transcribeAudio(input: {
  audioBuffer: Buffer
  audioFileName: string
  audioMimeType: string
  openAiKey?: string
  groqKey?: string
  googleKey?: string
}): Promise<TranscriptionOutcome> {
  const { audioBuffer, audioFileName, audioMimeType, openAiKey, groqKey, googleKey } = input
  const errors: string[] = []

  // Priorité 1 : Groq Whisper (whisper-large-v3 pour précision max, puis whisper-large-v3-turbo)
  if (groqKey) {
    for (const groqModel of ['whisper-large-v3', 'whisper-large-v3-turbo']) {
      try {
        const formData = new FormData()
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: audioMimeType || 'audio/m4a' })
        formData.append('file', blob, audioFileName || 'audio.m4a')
        formData.append('model', groqModel)
        formData.append('language', 'fr')

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}` },
          body: formData,
        })
        if (res.ok) {
          const json = (await res.json()) as { text?: string }
          if (json.text) return { text: json.text.trim(), provider: 'groq', model: groqModel, errors }
          errors.push(`groq/${groqModel}: réponse sans texte`)
        } else {
          // Sans ce détail, une clé invalide ou un quota dépassé passait
          // inaperçu : la note tombait en silence sur OpenAI ou sur le message
          // « transcription indisponible ».
          const detail = await res.text().catch(() => '')
          errors.push(`groq/${groqModel}: HTTP ${res.status} ${detail.slice(0, 200)}`.trim())
          console.warn(`[transcribeAudio] Groq ${groqModel} HTTP ${res.status}:`, detail.slice(0, 500))
        }
      } catch (e) {
        errors.push(`groq/${groqModel}: ${e instanceof Error ? e.message : 'erreur réseau'}`)
        console.warn(`[transcribeAudio] Groq ${groqModel} error:`, e)
      }
    }
  } else {
    errors.push('groq: aucune clé API active (Réglages > Assistant IA, ou GROQ_API_KEY)')
  }

  // Priorité 2 : OpenAI Whisper officiel
  if (openAiKey) {
    try {
      const formData = new FormData()
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: audioMimeType || 'audio/m4a' })
      formData.append('file', blob, audioFileName || 'audio.m4a')
      formData.append('model', 'whisper-1')
      formData.append('language', 'fr')

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAiKey}` },
        body: formData,
      })
      if (res.ok) {
        const json = (await res.json()) as { text?: string }
        if (json.text) return { text: json.text.trim(), provider: 'openai', model: 'whisper-1', errors }
      } else {
        const detail = await res.text().catch(() => '')
        errors.push(`openai/whisper-1: HTTP ${res.status} ${detail.slice(0, 200)}`.trim())
      }
    } catch (e) {
      errors.push(`openai/whisper-1: ${e instanceof Error ? e.message : 'erreur réseau'}`)
      console.warn('[transcribeAudio] OpenAI transcription fallback:', e)
    }
  }

  // Priorité 3 : Gemini Multimodal Audio
  if (googleKey) {
    try {
      const base64Audio = audioBuffer.toString('base64')
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: audioMimeType || 'audio/mp4',
                      data: base64Audio,
                    },
                  },
                  {
                    text: 'Transcris fidèlement et intégralement cet enregistrement audio en français sans ajouter de commentaire.',
                  },
                ],
              },
            ],
          }),
        }
      )
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return { text: text.trim(), provider: 'google', model: 'gemini-2.0-flash', errors }
      } else {
        const detail = await res.text().catch(() => '')
        errors.push(`google/gemini-2.0-flash: HTTP ${res.status} ${detail.slice(0, 200)}`.trim())
      }
    } catch (e) {
      errors.push(`google/gemini-2.0-flash: ${e instanceof Error ? e.message : 'erreur réseau'}`)
      console.warn('[transcribeAudio] Google transcription fallback:', e)
    }
  }

  return {
    text: "Note vocale enregistrée (transcription automatique indisponible : vérifiez les clés IA dans les Réglages).",
    provider: 'none',
    model: null,
    errors,
  }
}

async function analyzePhotoWithVision(input: {
  imageBuffer: Buffer
  mimeType: string
  openAiKey?: string
  googleKey?: string
  openRouterKey?: string
  groqKey?: string
}): Promise<{
  text: string
  documentType: VoicePhotoAttachment['document_type']
  keyValues: Record<string, string | number>
}> {
  const { imageBuffer, mimeType, openAiKey, googleKey, openRouterKey, groqKey } = input
  const base64Img = imageBuffer.toString('base64')

  const prompt = `Tu es un assistant expert en immobilier pour Alexandre Lopez (iad Provence).
Analyse cette photo prise lors d'un rendez-vous ou d'une visite de bien.
1. Identifie le type : taxe_fonciere, dpe, titre_propriete, facture_travaux, plan_cadastre, photo_bien, autre.
2. Si c'est un document, lis et retranscris le texte clé (OCR) et extrais les montants, surfaces, dates, noms d'artisans.
3. Réponds UNIQUEMENT au format JSON strict :
{
  "documentType": "taxe_fonciere" | "dpe" | "titre_propriete" | "facture_travaux" | "plan_cadastre" | "photo_bien" | "autre",
  "text": "Résumé court ou texte lisible extrait du document",
  "keyValues": {
    "montant_taxe": 1450,
    "surface": 120,
    "annee": 2021
  }
}`

  // Groq Vision en premier, comme le reste de la chaine. Sans lui, une photo
  // n'est analysee que si une cle OpenAI ou Google existe — il n'y en a plus.
  // Si le modele venait a disparaitre du catalogue Groq, on redescend
  // silencieusement sur les moteurs suivants.
  if (groqKey) {
    for (const visionModel of GROQ_VISION_MODELS) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: visionModel,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64Img}` },
                  },
                ],
              },
            ],
          }),
        })
        if (res.ok) {
          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
          const content = json.choices?.[0]?.message?.content
          if (content) {
            const parsed = JSON.parse(content)
            return {
              text: parsed.text || '',
              documentType: parsed.documentType || 'autre',
              keyValues: parsed.keyValues || {},
            }
          }
        } else {
          const detail = await res.text().catch(() => '')
          console.warn(`[analyzePhotoWithVision] Groq ${visionModel} HTTP ${res.status}:`, detail.slice(0, 500))
        }
      } catch (e) {
        console.warn(`[analyzePhotoWithVision] Groq ${visionModel} error:`, e)
      }
    }
  }

  // Google Gemini Vision
  if (googleKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Img } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      )
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          const parsed = JSON.parse(text)
          return {
            text: parsed.text || '',
            documentType: parsed.documentType || 'autre',
            keyValues: parsed.keyValues || {},
          }
        }
      }
    } catch (e) {
      console.warn('[analyzePhotoWithVision] Gemini vision error:', e)
    }
  }

  // OpenAI Vision
  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64Img}` },
                },
              ],
            },
          ],
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const content = json.choices?.[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content)
          return {
            text: parsed.text || '',
            documentType: parsed.documentType || 'autre',
            keyValues: parsed.keyValues || {},
          }
        }
      }
    } catch (e) {
      console.warn('[analyzePhotoWithVision] OpenAI vision error:', e)
    }
  }

  return { text: 'Photo ajoutée à la note', documentType: 'photo_bien', keyValues: {} }
}

async function fetchCrmContext() {
  const { data: contacts } = await adminDb()
    .from('contacts')
    .select('id, first_name, last_name, phone, email, city, role')
    .order('updated_at', { ascending: false })
    .limit(40)

  const { data: projects } = await adminDb()
    .from('projects')
    .select('id, title, commune, price_holder, stage')
    .order('updated_at', { ascending: false })
    .limit(30)

  return {
    contacts: contacts || [],
    projects: projects || [],
  }
}

async function generateGranolaSummary(input: {
  transcript: string
  photoAttachments: VoicePhotoAttachment[]
  crmContext: { contacts: unknown[]; projects: unknown[] }
  forcedContactId?: string | null
  forcedProjectId?: string | null
  openAiKey?: string
  groqKey?: string
  googleKey?: string
  openRouterKey?: string
  deepseekKey?: string
  /** Modele Groq choisi dans Reglages > Assistant IA, prioritaire sur les valeurs sures. */
  preferredGroqModel?: string | null
}): Promise<{
  summary: GranolaSummary
  provider: VoiceAiProvider | 'fallback'
  model: string | null
}> {
  const {
    transcript,
    photoAttachments,
    crmContext,
    forcedContactId,
    forcedProjectId,
    openAiKey,
    groqKey,
    googleKey,
    openRouterKey,
    deepseekKey,
    preferredGroqModel,
  } = input

  const ocrSummary = photoAttachments
    .filter((p) => p.ocr_extracted_text || p.document_type)
    .map((p) => `Document (${p.document_type}): ${p.ocr_extracted_text} | Valeurs: ${JSON.stringify(p.key_values)}`)
    .join('\n')

  const systemPrompt = `Tu es le copilote IA d'Alexandre Lopez, conseiller immobilier d'élite iad en Provence Verte et Verdon.
Tu analyses la transcription d'une conversation, d'une visite de bien ou d'un débriefing vocal, ainsi que les documents photos joints.

Ton rôle est de générer une note de réunion structurée de très haut niveau, dans le style de "Granola.ai" adapté à l'immobilier, et de relier automatiquement les contacts et projets existants.

Aujourd'hui nous sommes le : ${new Date().toLocaleDateString('fr-FR')} (${new Date().toISOString().split('T')[0]}).

BASE DE DONNÉES CONTACTS EXISTANTS :
${JSON.stringify(crmContext.contacts)}

BASE DE DONNÉES PROJETS EXISTANTS :
${JSON.stringify(crmContext.projects)}

DIRECTIVES :
1. Titre percutant et clair (ex: "R1 Découverte — Maison Barjols — M. et Mme Martin").
2. Type de réunion : 'discovery_r1', 'estimation_r2', 'followup_call', 'visit', 'negotiation', 'artisan_meeting' ou 'general'.
3. Rapprochement automatique :
   - Si un contact correspond dans la base, retourne son UUID dans "matched_contact_id".
   - Si un projet correspond, retourne son UUID dans "matched_project_id".
   - Si le contact est nouveau, renseigne "new_contact_suggested" avec son nom, prénom, téléphone, rôle.
4. Synthèse structurée (Granola format) :
   - "context" : 2-3 phrases résumant l'essentiel et l'intention.
   - "client_situation" : Projet de vie, motivation de vente, délai, accord bancaire / apport.
   - "property_insights" : Surface, pièces, terrain, prix attendu, état, points forts, points faibles.
   - "key_points" : Liste à puces des faits et chiffres clés.
   - "objections_and_vigilance" : Points bloquants, doutes juridiques, travaux, fosse, servitudes.
   - "lead_temperature" : 'hot' (mandat imminent / acquéreur prêt), 'warm' (en réflexion), ou 'cold' (loin du projet).
5. Action Items (Tâches concrètes) :
   - Extrais toutes les actions mentionnées (ex: "Envoyer estimation comparative", "Demander facture toiture", "Rappeler le courtier").
   - Calcule une date d'échéance réaliste (format ISO YYYY-MM-DD) si mentionnée (ex: "d'ici jeudi" -> date de jeudi prochain).

Réponds UNIQUEMENT en JSON strict conforme à ce schéma :
{
  "title": "string",
  "meeting_type": "discovery_r1",
  "matched_contact_id": "UUID ou null",
  "matched_project_id": "UUID ou null",
  "new_contact_suggested": null,
  "structured_summary": {
    "context": "string",
    "client_situation": "string",
    "property_insights": {
      "type_bien": "Maison / Villa",
      "commune": "Barjols",
      "surface": 130,
      "pieces": 5,
      "surface_terrain": 1200,
      "prix_souhaite": 360000,
      "points_forts": ["Vue dégagée", "Piscine récente"],
      "points_vigilance": ["Fosse septique non conforme"]
    },
    "key_points": ["Point 1", "Point 2"],
    "objections_and_vigilance": ["Point de vigilance 1"],
    "sentiment": "Très positif"
  },
  "action_items": [
    {
      "title": "Rédiger et envoyer l'estimation comparative",
      "due_date": "2026-09-02",
      "priority": "high",
      "assignee": "advisor"
    }
  ],
  "lead_temperature": "hot"
}`

  const userContent = `TRANSCRIPTION AUDIO :
${transcript}

${ocrSummary ? `DOCUMENTS PHOTOS JOINTS (OCR) :\n${ocrSummary}` : ''}
${forcedContactId ? `\nContact forcé manuellement : ${forcedContactId}` : ''}
${forcedProjectId ? `\nProjet forcé manuellement : ${forcedProjectId}` : ''}`

  // Groq en premier : c'est le moteur retenu pour toute la chaine note vocale.
  // On essaie le modele choisi dans les Reglages, puis on redescend sur des
  // modeles surs — un modele retire du catalogue Groq ne doit pas faire perdre
  // la note.
  if (groqKey) {
    for (const groqModel of groqChatModels(preferredGroqModel)) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: groqModel,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
          }),
        })
        if (res.ok) {
          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
          const content = json.choices?.[0]?.message?.content
          if (content) return { summary: JSON.parse(content), provider: 'groq', model: groqModel }
        } else {
          const detail = await res.text().catch(() => '')
          console.warn(`[generateGranolaSummary] Groq ${groqModel} HTTP ${res.status}:`, detail.slice(0, 500))
        }
      } catch (e) {
        console.warn(`[generateGranolaSummary] Groq ${groqModel} error:`, e)
      }
    }
  }

  // DeepSeek (si configuré)
  if (deepseekKey) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const content = json.choices?.[0]?.message?.content
        if (content) return { summary: JSON.parse(content), provider: 'deepseek', model: 'deepseek-chat' }
      }
    } catch (e) {
      console.warn('[generateGranolaSummary] DeepSeek error:', e)
    }
  }

  // OpenAI
  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const content = json.choices?.[0]?.message?.content
        if (content) return { summary: JSON.parse(content), provider: 'openai', model: 'gpt-4o-mini' }
      }
    } catch (e) {
      console.warn('[generateGranolaSummary] OpenAI error:', e)
    }
  }

  // Google Gemini
  if (googleKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      )
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return { summary: JSON.parse(text), provider: 'google', model: 'gemini-2.0-flash' }
      }
    } catch (e) {
      console.warn('[generateGranolaSummary] Gemini error:', e)
    }
  }

  // Fallback structuré par défaut
  return {
    summary: {
      title: 'Compte-rendu de réunion',
      meeting_type: 'general',
      matched_contact_id: forcedContactId || null,
      matched_project_id: forcedProjectId || null,
      new_contact_suggested: null,
      structured_summary: {
        context: transcript.slice(0, 200),
        client_situation: 'Non renseigné',
        key_points: [transcript.slice(0, 100)],
        objections_and_vigilance: [],
      },
      action_items: [],
      lead_temperature: 'warm',
    },
    provider: 'fallback',
    model: null,
  }
}

function buildActivityMarkdown(
  summary: {
    title: string
    meeting_type: VoiceMeetingType
    structured_summary: VoiceStructuredSummary
    action_items: VoiceActionItem[]
    lead_temperature: LeadTemperature
  },
  rawTranscript: string,
  photos: VoicePhotoAttachment[]
): string {
  const { structured_summary, action_items, lead_temperature } = summary
  const tempEmoji = lead_temperature === 'hot' ? '🔥 Chaud' : lead_temperature === 'cold' ? '❄️ Froid' : '⚖️ Tiède'

  let md = `### 📋 Synthèse
**Température du prospect :** ${tempEmoji}

**Contexte :**
${structured_summary.context}

**Situation & Projet :**
${structured_summary.client_situation}
`

  if (structured_summary.property_insights?.surface || structured_summary.property_insights?.commune) {
    const p = structured_summary.property_insights
    md += `
**Caractéristiques du bien :**
- **Type & Lieu :** ${p.type_bien || 'Bien'} à ${p.commune || 'Var'}
- **Surface :** ${p.surface ? `${p.surface} m²` : 'Non précisée'}${p.pieces ? ` (${p.pieces} pièces)` : ''}
- **Terrain :** ${p.surface_terrain ? `${p.surface_terrain} m²` : 'Non précisé'}
- **Prix attendu :** ${p.prix_souhaite ? `${p.prix_souhaite.toLocaleString('fr-FR')} €` : 'Non précisé'}
`
  }

  if (structured_summary.key_points?.length) {
    md += `
**💡 Points clés :**
${structured_summary.key_points.map((pt) => `• ${pt}`).join('\n')}
`
  }

  if (structured_summary.objections_and_vigilance?.length) {
    md += `
**⚠️ Points de vigilance / Objections :**
${structured_summary.objections_and_vigilance.map((ob) => `• ${ob}`).join('\n')}
`
  }

  if (action_items?.length) {
    md += `
**✅ Actions à mener :**
${action_items.map((it) => `- [ ] **${it.title}**${it.due_date ? ` *(Échéance : ${it.due_date})*` : ''}`).join('\n')}
`
  }

  if (photos.length) {
    md += `
**📸 Documents & Photos (${photos.length}) :**
${photos.map((p) => `• *${p.name}* (${p.document_type || 'photo'}): ${p.ocr_extracted_text || 'Ajouté'}`).join('\n')}
`
  }

  return md.trim()
}

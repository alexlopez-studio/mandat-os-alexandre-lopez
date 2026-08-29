export type VoiceMeetingType =
  | 'discovery_r1'
  | 'estimation_r2'
  | 'followup_call'
  | 'visit'
  | 'negotiation'
  | 'artisan_meeting'
  | 'general'

export type LeadTemperature = 'cold' | 'warm' | 'hot'

export type VoiceActionItem = {
  id?: string
  title: string
  due_date?: string | null
  priority: 'low' | 'normal' | 'high'
  assignee: 'advisor' | 'client'
  completed?: boolean
}

export type VoicePhotoAttachment = {
  url?: string
  storage_path?: string
  name: string
  mime_type?: string
  ocr_extracted_text?: string
  document_type?: 'taxe_fonciere' | 'dpe' | 'titre_propriete' | 'facture_travaux' | 'plan_cadastre' | 'photo_bien' | 'autre'
  key_values?: Record<string, string | number>
}

export type VoicePropertyInsights = {
  type_bien?: string
  commune?: string
  adresse?: string
  surface?: number
  pieces?: number
  surface_terrain?: number
  prix_souhaite?: number
  annee_construction?: number
  points_forts?: string[]
  points_vigilance?: string[]
}

export type VoiceStructuredSummary = {
  context: string
  client_situation: string
  property_insights?: VoicePropertyInsights
  key_points: string[]
  objections_and_vigilance: string[]
  sentiment?: string
}

export type NewContactSuggestion = {
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  role?: 'seller' | 'buyer' | 'notary' | 'artisan' | 'partner' | 'other'
  city?: string
  notes?: string
}

/** Moteur ayant réellement traité la note. `none` = aucun moteur n'a répondu. */
export type VoiceAiProvider = 'groq' | 'openai' | 'google' | 'deepseek' | 'none'

/**
 * Qui a fait quoi sur cette note, et pourquoi un moteur a été écarté.
 * Sert à vérifier que Groq est bien la voie active depuis l'iPhone, et à
 * diagnostiquer une clé invalide ou un quota dépassé sans lire les logs Vercel.
 */
export type VoiceProcessingDiagnostics = {
  transcription: {
    provider: VoiceAiProvider
    model: string | null
    /** Moteurs écartés, avec le motif (clé absente, HTTP 401, quota…). */
    errors: string[]
  }
  summary: {
    provider: VoiceAiProvider | 'fallback'
    model: string | null
  }
}

export type GranolaProcessedResult = {
  id?: string
  title: string
  meeting_type: VoiceMeetingType
  matched_contact_id: string | null
  matched_project_id: string | null
  new_contact_suggested: NewContactSuggestion | null
  structured_summary: VoiceStructuredSummary
  action_items: VoiceActionItem[]
  lead_temperature: LeadTemperature
  transcript: string
  photos: VoicePhotoAttachment[]
  audio_url?: string
  audio_duration_seconds?: number
  source: 'ios_shortcut' | 'dictaphone' | 'telegram' | 'web'
  created_at?: string
  diagnostics?: VoiceProcessingDiagnostics
}

export type VoiceMemoRecord = {
  id: string
  contact_id: string | null
  project_id: string | null
  opportunity_id: string | null
  title: string
  meeting_type: VoiceMeetingType
  audio_url: string | null
  audio_storage_path: string | null
  audio_duration_seconds: number | null
  photos: VoicePhotoAttachment[]
  transcript: string | null
  structured_summary: VoiceStructuredSummary
  action_items: VoiceActionItem[]
  lead_temperature: LeadTemperature
  source: string
  ai_provider: string | null
  ai_model: string | null
  created_at: string
  updated_at: string
}

/**
 * Formes normalisees de l'ingestion Granola.
 *
 * Tout ce qui entre dans Mandat OS passe par `GranolaMeeting`, quelle que soit
 * la source : le synchroniseur (MCP distant), un webhook Zapier, ou un rejeu
 * manuel. C'est ce qui rend ces trois voies interchangeables sans rien changer
 * en aval — cf. `ingestGranolaMeetings`.
 */

export const GRANOLA_PROVIDER = 'granola'

/** Signature de source portee par toute ligne produite par cette chaine. */
export const GRANOLA_AI_SIGNATURE = 'ai:granola'

/** Serveur MCP distant de Granola (plan gratuit : OAuth, pas de cle API). */
export const GRANOLA_MCP_URL = 'https://mcp.granola.ai/mcp'

/**
 * Outils disponibles sur le plan Basic.
 * `get_meeting_transcript` et `list_meeting_folders` sont reserves aux plans
 * payants : ne jamais les appeler, l'erreur serait comptee comme un echec de sync.
 */
export const GRANOLA_FREE_TOOLS = ['list_meetings', 'get_meetings', 'query_granola_meetings', 'get_account_info'] as const

/**
 * Fenetre du plan gratuit. Au-dela, les reunions sortent de l'historique
 * expose par Granola et sont definitivement perdues : c'est ce qui fait de la
 * synchronisation quotidienne une securite, pas un confort.
 */
export const GRANOLA_RETENTION_DAYS = 30

/** Seuil d'alerte : il reste 10 jours de marge avant la perte definitive. */
export const GRANOLA_STALE_ALERT_DAYS = 20

export type GranolaParticipant = {
  name: string | null
  email: string | null
  is_note_creator?: boolean
  company?: string | null
}

export type GranolaMeeting = {
  /** UUID Granola — cle d'idempotence avec `provider`. */
  external_id: string
  title: string
  /** Debut de la reunion, ISO 8601. */
  meeting_at: string | null
  /**
   * Resume structure. Le verbatim (`transcript_text`) reste `NULL` sur le plan
   * gratuit : c'est nominal, pas une erreur.
   */
  summary: string | null
  transcript_text?: string | null
  participants: GranolaParticipant[]
  /** Reponse brute, conservee telle quelle pour pouvoir rejouer une extraction. */
  raw: Record<string, unknown>
}

export type GranolaIngestSource = 'poller' | 'webhook' | 'manual'

export type GranolaIngestResult = {
  fetched: number
  created: number
  updated: number
  classified: number
  needs_review: number
  linked: number
  errors: Array<{ external_id: string; message: string }>
}

/** Cle de provenance d'une ecriture IA dans un journal (activities, events...). */
export type ProvenanceKey = {
  source_provider: string
  source_external_id: string
  source_item_key: string
}

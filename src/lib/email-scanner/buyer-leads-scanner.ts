import { getGoogleAccessToken } from '@/lib/google/tokens'
import { supabaseAdmin } from '@/lib/supabase'
import { extractBuyerLeadFromEmail } from '@/lib/email-scanner/ai-extract'
import { detectPortal } from '@/lib/email-scanner/heuristics'
import { matchBuyerEmailToProperty } from '@/lib/email-scanner/property-match'

/**
 * Scan de la boîte Gmail à la recherche de demandes d'acquéreurs.
 *
 * Le scanner ne crée plus de projet. Il dépose un candidat dans
 * `buyer_lead_candidates`, qu'Alexandre valide depuis l'écran Acquéreurs.
 * Une extraction IA fausse ne peut donc plus polluer le CRM.
 *
 * Les e-mails écartés par le modèle sont enregistrés eux aussi, en `rejected`.
 * C'est ce qui rend le scan idempotent — sans quoi chaque exécution les
 * réanalyserait, et paierait l'appel IA à chaque fois — et c'est aussi la seule
 * façon de repérer un vrai acquéreur passé à la trappe.
 */

export type ScannedEmailResult = {
  gmailMessageId: string
  subject: string
  from: string
  date: string
  portal: string
  contactName: string | null
  email: string | null
  phone: string | null
  confidence: number
  matchedProjectId: string | null
  matchReason: string | null
  candidateId: string | null
  status: 'candidate' | 'discarded' | 'already_processed' | 'error'
  error?: string
}

export type ScanSummary = {
  success: boolean
  totalFound: number
  processedCount: number
  /** Candidats en attente de validation, créés par ce scan. */
  candidateCount: number
  /** E-mails écartés par le modèle ou déjà traités. */
  discardedCount: number
  alreadyProcessedCount: number
  errorCount: number
  /** Vrai si au moins un e-mail a dû retomber sur l'extraction par motifs. */
  degraded: boolean
  results: ScannedEmailResult[]
  error?: string
}

function decodeBase64Url(input: string): string {
  try {
    return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function extractEmailBody(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data) return decodeBase64Url(payload.body.data)
  if (Array.isArray(payload.parts)) {
    // Le texte brut d'abord : le HTML des portails noie l'information utile
    // sous des kilo-octets de mise en page.
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return decodeBase64Url(plain.body.data)
    for (const part of payload.parts) {
      const nested = extractEmailBody(part)
      if (nested) return nested
    }
  }
  return ''
}

/**
 * Portails par expéditeur, demandes directes par mots-clés dans l'objet.
 * Le filtre reste large : c'est le modèle qui tranche, pas la requête Gmail.
 * Mais il n'est pas absent — sans lui, chaque exécution paierait un appel IA
 * pour chaque newsletter reçue.
 */
const GMAIL_QUERY = [
  '(from:(seloger.com OR leboncoin.fr OR bienici.com OR iadfrance.fr OR figaroimmo.com OR logic-immo.com OR green-acres.com)',
  'OR subject:(demande OR contact OR acquéreur OR acquereur OR visite OR annonce OR renseignement OR achat OR offre OR "votre bien"))',
  'newer_than:14d -in:spam -in:trash',
].join(' ')

/** Identifiants déjà traités : la nouvelle table, plus l'historique de l'ancienne implémentation. */
async function loadProcessedIds(): Promise<Set<string>> {
  const processed = new Set<string>()

  const { data: candidates } = await supabaseAdmin
    .from('buyer_lead_candidates')
    .select('gmail_message_id')

  candidates?.forEach((row: any) => {
    if (row.gmail_message_id) processed.add(String(row.gmail_message_id))
  })

  // Garde-fou de migration : les e-mails traités par la version précédente ont
  // déjà créé un projet. Sans cette relecture, le premier scan les proposerait
  // une seconde fois.
  const { data: legacyEvents } = await supabaseAdmin
    .from('lead_events')
    .select('payload')
    .eq('kind', 'email' as never)

  legacyEvents?.forEach((row: any) => {
    if (row.payload?.gmail_message_id) processed.add(String(row.payload.gmail_message_id))
  })

  return processed
}

export async function scanBuyerLeadsFromGmail(limit = 15): Promise<ScanSummary> {
  const empty = {
    totalFound: 0,
    processedCount: 0,
    candidateCount: 0,
    discardedCount: 0,
    alreadyProcessedCount: 0,
    errorCount: 0,
    degraded: false,
    results: [] as ScannedEmailResult[],
  }

  const token = await getGoogleAccessToken()
  if (!token) {
    return {
      success: false,
      ...empty,
      error: 'Compte Google non connecté ou jeton expiré. Reconnectez le compte dans Réglages.',
    }
  }

  try {
    const processedIds = await loadProcessedIds()

    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    listUrl.searchParams.set('q', GMAIL_QUERY)
    listUrl.searchParams.set('maxResults', String(limit))

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!listRes.ok) {
      const errJson = await listRes.json().catch(() => ({}))
      throw new Error(`Gmail API List Error ${listRes.status}: ${errJson.error?.message || 'Erreur inconnue'}`)
    }

    const listData = await listRes.json()
    const messages: { id: string; threadId: string }[] = listData.messages || []

    const results: ScannedEmailResult[] = []
    let candidateCount = 0
    let discardedCount = 0
    let alreadyProcessedCount = 0
    let errorCount = 0
    let degraded = false

    for (const item of messages) {
      if (processedIds.has(item.id)) {
        alreadyProcessedCount += 1
        results.push({
          gmailMessageId: item.id,
          subject: 'Déjà traité',
          from: '',
          date: '',
          portal: 'Inconnu',
          contactName: null,
          email: null,
          phone: null,
          confidence: 0,
          matchedProjectId: null,
          matchReason: null,
          candidateId: null,
          status: 'already_processed',
        })
        continue
      }

      try {
        const msgUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`)
        msgUrl.searchParams.set('format', 'full')
        const msgRes = await fetch(msgUrl.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!msgRes.ok) {
          errorCount += 1
          continue
        }

        const msgData = await msgRes.json()
        const headers: { name: string; value: string }[] = msgData.payload?.headers || []

        const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(Sans objet)'
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || ''
        const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || new Date().toISOString()
        const bodyText = extractEmailBody(msgData.payload)
        const portal = detectPortal(from, subject, bodyText)

        const extraction = await extractBuyerLeadFromEmail({ subject, from, body: bodyText })
        if (extraction.extractedBy === 'heuristics') degraded = true

        const match = extraction.isBuyerLead
          ? await matchBuyerEmailToProperty({
              propertyReference: extraction.propertyReference,
              communes: extraction.communes,
              propertyType: extraction.propertyType,
              subject,
            })
          : null

        const receivedAt = Number.isNaN(Date.parse(date)) ? new Date().toISOString() : new Date(date).toISOString()

        const { data: candidate, error: insertError } = await supabaseAdmin
          .from('buyer_lead_candidates')
          .insert({
            gmail_message_id: item.id,
            gmail_thread_id: item.threadId ?? null,
            received_at: receivedAt,
            subject,
            from_address: from,
            portal,
            body_excerpt: bodyText.slice(0, 1000) || null,
            first_name: extraction.firstName || null,
            last_name: extraction.lastName || null,
            email: extraction.email,
            phone: extraction.phone,
            property_type: extraction.propertyType,
            budget_max: extraction.budgetMax,
            communes: extraction.communes.length ? extraction.communes : null,
            confidence: extraction.confidence,
            extraction: extraction.raw as never,
            extracted_by: extraction.extractedBy,
            matched_project_id: match?.projectId ?? null,
            match_reason: match?.reason ?? null,
            status: extraction.isBuyerLead ? 'pending' : 'rejected',
            review_note: extraction.isBuyerLead
              ? extraction.summary
              : 'Écarté automatiquement : non identifié comme demande d\'acquéreur',
            reviewed_at: extraction.isBuyerLead ? null : new Date().toISOString(),
          })
          .select('id')
          .single()

        if (insertError) throw new Error(`Enregistrement du candidat impossible: ${insertError.message}`)

        if (extraction.isBuyerLead) candidateCount += 1
        else discardedCount += 1

        results.push({
          gmailMessageId: item.id,
          subject,
          from,
          date,
          portal,
          contactName: [extraction.firstName, extraction.lastName].filter(Boolean).join(' ') || null,
          email: extraction.email,
          phone: extraction.phone,
          confidence: extraction.confidence,
          matchedProjectId: match?.projectId ?? null,
          matchReason: match?.reason ?? null,
          candidateId: candidate?.id ?? null,
          status: extraction.isBuyerLead ? 'candidate' : 'discarded',
        })
      } catch (itemError) {
        errorCount += 1
        results.push({
          gmailMessageId: item.id,
          subject: 'Erreur traitement',
          from: '',
          date: '',
          portal: 'Inconnu',
          contactName: null,
          email: null,
          phone: null,
          confidence: 0,
          matchedProjectId: null,
          matchReason: null,
          candidateId: null,
          status: 'error',
          error: itemError instanceof Error ? itemError.message : 'Erreur inconnue',
        })
      }
    }

    return {
      success: true,
      totalFound: messages.length,
      processedCount: messages.length - alreadyProcessedCount,
      candidateCount,
      discardedCount,
      alreadyProcessedCount,
      errorCount,
      degraded,
      results,
    }
  } catch (e) {
    console.error('[buyer-leads-scanner] Exception:', e)
    return {
      success: false,
      ...empty,
      errorCount: 1,
      error: e instanceof Error ? e.message : 'Erreur serveur lors de la numérisation',
    }
  }
}

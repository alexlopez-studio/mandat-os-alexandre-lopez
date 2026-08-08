import { getGoogleAccessToken } from '@/lib/google/tokens'
import { supabaseAdmin } from '@/lib/supabase'
import { upsertCrmProspect } from '@/lib/leads-crm'

export type ScannedEmailResult = {
  gmailMessageId: string
  subject: string
  from: string
  date: string
  portal: string
  contactName: string | null
  email: string | null
  phone: string | null
  propertyTitle: string | null
  buyerProjectId: string | null
  contactId: string | null
  status: 'created' | 'already_processed' | 'ignored' | 'error'
  error?: string
}

export type ScanSummary = {
  success: boolean
  totalFound: number
  processedCount: number
  createdCount: number
  ignoredCount: number
  errorCount: number
  results: ScannedEmailResult[]
  error?: string
}

function decodeBase64Url(input: string): string {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function extractEmailBody(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data)
        // Dépouiller succinctement le HTML
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      }
      if (part.parts) {
        const nested = extractEmailBody(part)
        if (nested) return nested
      }
    }
  }
  return ''
}

function detectPortal(from: string, subject: string, body: string): string {
  const combined = `${from} ${subject} ${body}`.toLowerCase()
  if (combined.includes('seloger')) return 'SeLoger'
  if (combined.includes('leboncoin')) return 'Leboncoin'
  if (combined.includes('bienici') || combined.includes("bien'ici")) return "Bien'Ici"
  if (combined.includes('iad')) return 'iad France'
  if (combined.includes('figaro')) return 'Figaro Immo'
  if (combined.includes('green-acres')) return 'Green-Acres'
  if (combined.includes('logic-immo')) return 'Logic-Immo'
  return 'E-mail Direct'
}

function parseLeadDetails(subject: string, body: string, from: string) {
  const fullText = `${subject}\n${body}`
  
  // Extraction téléphone
  const phoneMatch = fullText.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/)
  const phone = phoneMatch ? phoneMatch[0].replace(/[\s.-]/g, '') : null

  // Extraction email (exclure l'expéditeur portail si c'est no-reply@seloger.com)
  const emailMatches = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const email = emailMatches.find((e) => !e.includes('seloger') && !e.includes('leboncoin') && !e.includes('bienici') && !e.includes('iadfrance') && !e.includes('noreply') && !e.includes('no-reply')) || null

  // Extraction Nom / Prénom
  let firstName = ''
  let lastName = ''

  const namePatterns = [
    /(?:nom|prénom|prospect|contact|de)\s*:\s*([A-ZÀ-ÿa-z-]+\s+[A-ZÀ-ÿa-z-]+)/i,
    /(?:message de|demande de)\s+([A-ZÀ-ÿa-z-]+\s+[A-ZÀ-ÿa-z-]+)/i,
    /([A-ZÀ-ÿa-z-]+)\s+([A-ZÀ-ÿa-z-]+)\s+souhaite/i,
  ]

  for (const pat of namePatterns) {
    const m = fullText.match(pat)
    if (m && m[1]) {
      const parts = m[1].trim().split(/\s+/)
      firstName = parts[0] || ''
      lastName = parts.slice(1).join(' ') || ''
      break
    }
  }

  // Type de bien
  let propertyType: string | null = null
  if (/maison|villa/i.test(fullText)) propertyType = 'maison'
  else if (/appartement|t1|t2|t3|t4|t5|studio/i.test(fullText)) propertyType = 'appartement'
  else if (/terrain/i.test(fullText)) propertyType = 'terrain'
  else if (/immeuble/i.test(fullText)) propertyType = 'immeuble'

  // Budget
  let budgetMax: number | null = null
  const budgetMatch = fullText.match(/(\d[\d\s._]{3,})\s*(?:€|euros)/i)
  if (budgetMatch) {
    const rawVal = budgetMatch[1].replace(/[\s._]/g, '')
    const val = Number(rawVal)
    if (!Number.isNaN(val) && val > 10000) {
      budgetMax = val
    }
  }

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email,
    phone,
    propertyType,
    budgetMax,
  }
}

export async function scanBuyerLeadsFromGmail(limit = 15): Promise<ScanSummary> {
  const token = await getGoogleAccessToken()
  if (!token) {
    return {
      success: false,
      totalFound: 0,
      processedCount: 0,
      createdCount: 0,
      ignoredCount: 0,
      errorCount: 0,
      results: [],
      error: 'Compte Google non connecté ou jeton expiré. Reconnectez le compte dans Réglages.',
    }
  }

  try {
    // 1. Charger les IDs d'e-mails déjà traités pour idempotence
    const { data: existingEvents } = await supabaseAdmin
      .from('lead_events')
      .select('payload')
      .eq('kind', 'email' as never)

    const processedIds = new Set<string>()
    existingEvents?.forEach((row: any) => {
      if (row.payload?.gmail_message_id) {
        processedIds.add(String(row.payload.gmail_message_id))
      }
    })

    // 2. Rechercher les e-mails de demandes d'acquéreurs dans Gmail
    const searchQuery = 'subject:(demande OR contact OR acquéreur OR seloger OR leboncoin OR bienici OR iad OR prospect OR offre)'
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    listUrl.searchParams.set('q', searchQuery)
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
    let createdCount = 0
    let ignoredCount = 0
    let errorCount = 0

    // 3. Traiter chaque message Gmail
    for (const item of messages) {
      if (processedIds.has(item.id)) {
        results.push({
          gmailMessageId: item.id,
          subject: 'Déjà traité',
          from: '',
          date: '',
          portal: 'Inconnu',
          contactName: null,
          email: null,
          phone: null,
          propertyTitle: null,
          buyerProjectId: null,
          contactId: null,
          status: 'already_processed',
        })
        ignoredCount += 1
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
        const extracted = parseLeadDetails(subject, bodyText, from)

        // Si aucun contact valide (email/phone/nom) trouvé, marquer comme ignoré
        if (!extracted.email && !extracted.phone && !extracted.firstName && !extracted.lastName) {
          ignoredCount += 1
          results.push({
            gmailMessageId: item.id,
            subject,
            from,
            date,
            portal,
            contactName: null,
            email: null,
            phone: null,
            propertyTitle: null,
            buyerProjectId: null,
            contactId: null,
            status: 'ignored',
          })
          continue
        }

        // A. Insérer dans `contacts` (Annuaire principal)
        let contactId: string | null = null
        if (extracted.email) {
          const { data: existingC } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('email', extracted.email)
            .maybeSingle()
          if (existingC?.id) contactId = existingC.id
        }
        if (!contactId && extracted.phone) {
          const { data: existingP } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('phone', extracted.phone)
            .maybeSingle()
          if (existingP?.id) contactId = existingP.id
        }

        if (!contactId) {
          const { data: newC, error: cErr } = await supabaseAdmin
            .from('contacts')
            .insert({
              first_name: extracted.firstName || 'Acquéreur',
              last_name: extracted.lastName || portal,
              email: extracted.email,
              phone: extracted.phone,
              source: portal,
              types: ['acquereur'],
            })
            .select('id')
            .single()

          if (!cErr && newC) {
            contactId = newC.id
          }
        }

        // B. Insérer dans `prospects` pour la gestion CRM
        const prospect = await upsertCrmProspect({
          email: extracted.email,
          firstName: extracted.firstName || 'Acquéreur',
          lastName: extracted.lastName || portal,
          phone: extracted.phone,
        }).catch(() => null)

        // C. Créer le Projet d'Achat (`buyer_criteria`)
        const { data: buyer, error: buyerErr } = await supabaseAdmin
          .from('buyer_criteria')
          .insert({
            prospect_id: prospect?.id || contactId || null,
            type_bien: extracted.propertyType,
            budget_max: extracted.budgetMax,
            criteres: [portal, `Email: ${subject}`],
            active: true,
            stage: 'Nouveau contact',
            next_action: `Qualifier la demande reçue via ${portal}`,
          })
          .select('*')
          .single()

        if (buyerErr || !buyer) {
          throw new Error(`Création projet acquéreur impossible: ${buyerErr?.message || 'Erreur'}`)
        }

        // D. Liens `project_contacts`
        if (contactId) {
          await supabaseAdmin.from('project_contacts').insert({
            contact_id: contactId,
            buyer_criteria_id: buyer.id,
            role: 'Acquéreur principal',
          })
        }

        // E. Logger dans `lead_events` pour l'idempotence
        await supabaseAdmin.from('lead_events').insert({
          lead_id: buyer.id,
          kind: 'email' as never,
          payload: {
            gmail_message_id: item.id,
            subject,
            portal,
            contact_id: contactId,
          },
          created_by: 'system',
        } as never)

        createdCount += 1
        results.push({
          gmailMessageId: item.id,
          subject,
          from,
          date,
          portal,
          contactName: [extracted.firstName, extracted.lastName].filter(Boolean).join(' ') || 'Acquéreur',
          email: extracted.email,
          phone: extracted.phone,
          propertyTitle: extracted.propertyType ? `Recherche ${extracted.propertyType}` : 'Projet Achat',
          buyerProjectId: buyer.id,
          contactId,
          status: 'created',
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
          propertyTitle: null,
          buyerProjectId: null,
          contactId: null,
          status: 'error',
          error: itemError instanceof Error ? itemError.message : 'Erreur inconnue',
        })
      }
    }

    return {
      success: true,
      totalFound: messages.length,
      processedCount: messages.length - ignoredCount,
      createdCount,
      ignoredCount,
      errorCount,
      results,
    }
  } catch (e) {
    console.error('[buyer-leads-scanner] Exception:', e)
    return {
      success: false,
      totalFound: 0,
      processedCount: 0,
      createdCount: 0,
      ignoredCount: 0,
      errorCount: 1,
      results: [],
      error: e instanceof Error ? e.message : 'Erreur serveur lors de la numérisation',
    }
  }
}

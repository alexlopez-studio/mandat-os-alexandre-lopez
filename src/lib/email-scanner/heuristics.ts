/**
 * Extraction par motifs — le filet de sécurité sous l'analyse IA.
 *
 * Ces fonctions vivaient dans `buyer-leads-scanner.ts`. Elles en sortent pour
 * une raison simple : `ai-extract.ts` doit pouvoir s'y replier quand le modèle
 * est indisponible ou rend une sortie invalide, sans dépendre du scanner.
 *
 * Leur portée est volontairement limitée. Elles lisent bien les notifications
 * de portail, dont le format est stable, et mal les messages écrits en langage
 * libre — c'est précisément ce que l'IA vient couvrir.
 */

export type ExtractedLead = {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  propertyType: string | null
  budgetMax: number | null
}

export function detectPortal(from: string, subject: string, body: string): string {
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

export function parseLeadDetails(subject: string, body: string, _from: string): ExtractedLead {
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

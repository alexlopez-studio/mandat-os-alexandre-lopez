import { z } from 'zod'

import { aiChat } from '@/lib/ai/gateway'
import { parseLeadDetails } from '@/lib/email-scanner/heuristics'

/**
 * Qualification d'un e-mail entrant par le modèle.
 *
 * Deux questions en un seul appel : « est-ce une demande d'acquéreur ? » et
 * « qu'y a-t-il dedans ? ». Les séparer doublerait le coût sans rien apprendre
 * de plus — le modèle a besoin du même texte pour répondre aux deux.
 *
 * Le repli sur les motifs n'est pas une politesse : sans clé IA valide,
 * `aiChat` renvoie un texte de secours qui ne passera jamais le schéma. Le
 * scanner doit continuer à tourner ce jour-là, en mode dégradé et en le disant.
 */

const PROPERTY_TYPES = ['maison', 'appartement', 'terrain', 'immeuble'] as const

/**
 * Tolérant à dessein : `.catch()` sur chaque champ optionnel. Un modèle qui
 * rend `budget_max: "300 000 €"` au lieu d'un nombre ne doit pas faire perdre
 * le nom et le téléphone qu'il a, eux, correctement extraits.
 */
const ExtractionSchema = z.object({
  is_buyer_lead: z.boolean(),
  confidence: z.number().min(0).max(1).catch(0),
  first_name: z.string().nullable().catch(null),
  last_name: z.string().nullable().catch(null),
  email: z.string().nullable().catch(null),
  phone: z.string().nullable().catch(null),
  property_type: z.enum(PROPERTY_TYPES).nullable().catch(null),
  budget_max: z.number().nullable().catch(null),
  communes: z.array(z.string()).catch([]),
  property_reference: z.string().nullable().catch(null),
  summary: z.string().nullable().catch(null),
})

export type BuyerEmailExtraction = {
  isBuyerLead: boolean
  confidence: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  propertyType: string | null
  budgetMax: number | null
  communes: string[]
  propertyReference: string | null
  summary: string | null
  /** `ai` quand le modèle a répondu, `heuristics` quand on est retombé sur les motifs. */
  extractedBy: 'ai' | 'heuristics'
  raw: unknown
}

const SYSTEM_PROMPT = `Tu analyses les e-mails d'un conseiller immobilier en Provence Verte.

Ta seule tâche : dire si l'e-mail émane d'une personne qui cherche à ACHETER un bien — directement ou via un portail (SeLoger, Leboncoin, Bien'Ici, iad, Figaro Immo, Logic-Immo, Green-Acres) — et en extraire les informations.

Réponds UNIQUEMENT par un objet JSON :
{
  "is_buyer_lead": bool,
  "confidence": nombre entre 0 et 1,
  "first_name": string|null,
  "last_name": string|null,
  "email": string|null,
  "phone": string|null,
  "property_type": "maison"|"appartement"|"terrain"|"immeuble"|null,
  "budget_max": nombre|null,
  "communes": [string],
  "property_reference": string|null,
  "summary": string|null
}

RÈGLES :
- is_buyer_lead = false pour une newsletter, une facture, une relance de portail sans prospect identifiable, un message d'un vendeur, un échange entre confrères, ou tout e-mail personnel.
- N'invente jamais un contact. Si le nom n'apparaît pas, laisse null — un champ vide vaut mieux qu'un faux.
- N'utilise PAS l'adresse du portail (no-reply@…) comme e-mail du prospect.
- budget_max en euros, nombre entier, sans espace ni symbole.
- property_reference : la référence de l'annonce si elle figure dans le message.
- communes : les communes citées comme zone de recherche, pas l'adresse du conseiller.
- summary : une phrase en français résumant la demande.
- confidence traduit ta certitude sur is_buyer_lead, pas la richesse de l'extraction.`

function heuristicFallback(subject: string, body: string, from: string, raw: unknown): BuyerEmailExtraction {
  const parsed = parseLeadDetails(subject, body, from)
  const hasContact = Boolean(parsed.email || parsed.phone || parsed.firstName || parsed.lastName)

  return {
    // Sans IA on ne sait pas trancher : on retient tout ce qui porte un contact
    // et on laisse la file de validation faire le tri.
    isBuyerLead: hasContact,
    confidence: hasContact ? 0.3 : 0,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
    phone: parsed.phone,
    propertyType: parsed.propertyType,
    budgetMax: parsed.budgetMax,
    communes: [],
    propertyReference: null,
    summary: null,
    extractedBy: 'heuristics',
    raw,
  }
}

/** Les corps d'e-mail des portails traînent des pieds de page interminables. */
const MAX_BODY_CHARS = 6000

export async function extractBuyerLeadFromEmail(input: {
  subject: string
  from: string
  body: string
}): Promise<BuyerEmailExtraction> {
  const body = input.body.slice(0, MAX_BODY_CHARS)

  let content = ''
  try {
    const result = await aiChat({
      json: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `De : ${input.from}\nObjet : ${input.subject}\n\n${body}`,
        },
      ],
    })
    content = result.content
  } catch (err) {
    console.error('[ai-extract] appel IA en échec:', err)
    return heuristicFallback(input.subject, body, input.from, null)
  }

  let payload: unknown
  try {
    payload = JSON.parse(content)
  } catch {
    // `json: true` garantit un JSON syntaxiquement valide chez les fournisseurs
    // compatibles OpenAI, jamais chez le repli local — d'où ce garde-fou.
    console.warn('[ai-extract] réponse non JSON, repli sur les motifs')
    return heuristicFallback(input.subject, body, input.from, content)
  }

  const parsed = ExtractionSchema.safeParse(payload)
  if (!parsed.success) {
    console.warn('[ai-extract] JSON hors schéma, repli sur les motifs:', parsed.error.issues[0]?.message)
    return heuristicFallback(input.subject, body, input.from, payload)
  }

  const data = parsed.data
  return {
    isBuyerLead: data.is_buyer_lead,
    confidence: data.confidence,
    firstName: data.first_name?.trim() ?? '',
    lastName: data.last_name?.trim() ?? '',
    email: data.email?.trim() || null,
    phone: data.phone?.replace(/[\s.-]/g, '') || null,
    propertyType: data.property_type,
    budgetMax: data.budget_max,
    communes: data.communes.map((c) => c.trim()).filter(Boolean),
    propertyReference: data.property_reference?.trim() || null,
    summary: data.summary?.trim() || null,
    extractedBy: 'ai',
    raw: payload,
  }
}

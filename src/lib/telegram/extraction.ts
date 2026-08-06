import { z } from 'zod'
import { aiChat } from '@/lib/ai/gateway'
import { adminDb } from '@/lib/ai/db'

/**
 * Sortie attendue du modele.
 *
 * DeepSeek ne garantit qu'un JSON *syntaxiquement* valide (mode `json_object`),
 * jamais qu'il respecte cette forme : la validation zod ci-dessous est donc
 * la seule barriere reelle, pas une precaution.
 */
export const extractionSchema = z.object({
  intent: z.enum(['note', 'task', 'contact_seller', 'contact_buyer', 'unknown']),
  target_id: z.string().uuid().nullable().catch(null),
  target_name: z.string().nullable().catch(null),
  content: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  contact: z
    .object({
      name: z.string().nullable().catch(null),
      phone: z.string().nullable().catch(null),
      email: z.string().nullable().catch(null),
      city: z.string().nullable().catch(null),
      property_type: z.string().nullable().catch(null),
      budget: z.number().nullable().catch(null),
    })
    .nullable()
    .catch(null),
  confidence: z.number().min(0).max(1).catch(0.5),
})

export type Extraction = z.infer<typeof extractionSchema>

export type OpportunityCandidate = {
  id: string
  title: string
  seller_name: string | null
  property_city: string | null
  stage: string
}

/**
 * Dossiers proposables au modele pour rattacher une note.
 *
 * Plafonne a 40 : le palier gratuit de Groq limite a 6 000 tokens/minute, et
 * une liste de 120 dossiers suffisait a saturer ce quota des la deuxieme note
 * dictee d'affilee. 40 dossiers recents couvrent le pipeline actif.
 */
const CANDIDATE_LIMIT = 40

export async function listOpportunityCandidates(): Promise<OpportunityCandidate[]> {
  const { data, error } = await adminDb()
    .from('opportunities')
    .select('id, title, seller_name, property_city, stage')
    .order('updated_at', { ascending: false })
    .limit(CANDIDATE_LIMIT)

  if (error) throw new Error(error.message)
  return (data ?? []) as OpportunityCandidate[]
}

function renderCandidates(candidates: OpportunityCandidate[]) {
  if (candidates.length === 0) return 'Aucun dossier existant.'
  return candidates
    .map((c) => {
      const label = [c.seller_name, c.property_city].filter(Boolean).join(' — ') || c.title
      return `${c.id} | ${label} | ${c.stage}`
    })
    .join('\n')
}

function todayInParis() {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const SYSTEM_PROMPT = `Tu es l'assistant de saisie d'Alexandre Lopez, conseiller immobilier iad en Provence Verte.
Il te dicte des informations entre deux rendez-vous. Tu les transformes en JSON exploitable par son CRM.

Tu reponds UNIQUEMENT par un objet json valide, sans texte autour, avec ces cles :
- "intent" : "note" (information sur un dossier existant), "task" (chose a faire, avec ou sans echeance),
  "contact_seller" (nouveau vendeur), "contact_buyer" (nouvel acquereur), "unknown" (incomprehensible).
- "target_id" : l'identifiant EXACT d'un dossier de la liste fournie, ou null si aucun ne correspond.
- "target_name" : le nom de personne entendu, tel qu'Alexandre l'a prononce, ou null.
- "content" : l'information reformulee en francais clair, a la troisieme personne, sans perdre de detail chiffre.
- "due_date" : date au format AAAA-MM-JJ si une echeance est exprimee, sinon null.
- "contact" : pour un nouveau contact uniquement, l'objet {name, phone, email, city, property_type, budget}, sinon null.
- "confidence" : ta confiance dans le rattachement au dossier, entre 0 et 1.

Regles :
- Ne devine jamais un target_id absent de la liste. En cas de doute entre deux dossiers, mets null et baisse confidence.
- Les montants sont en euros. "285" dans un contexte de prix signifie 285000.
- N'invente aucune information absente du message.`

/**
 * Transforme un message en intention structuree.
 * Une relance est prevue : DeepSeek renvoie parfois un contenu vide en mode json.
 */
export async function extractIntent(input: {
  text: string
  candidates: OpportunityCandidate[]
}): Promise<{ extraction: Extraction; providerId: string; model: string }> {
  const userPrompt = [
    `Date du jour : ${todayInParis()} (fuseau Europe/Paris).`,
    '',
    'Dossiers existants (identifiant | vendeur — ville | etape) :',
    renderCandidates(input.candidates),
    '',
    'Message d\'Alexandre :',
    input.text,
  ].join('\n')

  let lastError = 'Reponse vide'

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await aiChat({
      json: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    })

    if (result.providerId === 'fallback') {
      throw new Error('Aucune cle IA active : configure un fournisseur dans les reglages.')
    }

    const parsed = safeParse(result.content)
    if (parsed.success) {
      return { extraction: parsed.data, providerId: result.providerId, model: result.model }
    }
    lastError = parsed.error
  }

  throw new Error(`Extraction impossible (${lastError})`)
}

function safeParse(raw: string): { success: true; data: Extraction } | { success: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { success: false, error: 'contenu vide' }

  // Certains modeles encadrent malgre tout le JSON d'un bloc markdown.
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()

  let candidate: unknown
  try {
    candidate = JSON.parse(unfenced)
  } catch {
    return { success: false, error: 'JSON illisible' }
  }

  const result = extractionSchema.safeParse(candidate)
  if (!result.success) return { success: false, error: result.error.issues[0]?.message ?? 'schema invalide' }
  return { success: true, data: result.data }
}

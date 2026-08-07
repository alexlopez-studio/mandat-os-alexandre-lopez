import { z } from 'zod'
import { aiChat } from '@/lib/ai/gateway'
import { adminDb } from '@/lib/ai/db'

/**
 * Sortie attendue du modele.
 *
 * Les fournisseurs compatibles OpenAI ne garantissent qu'un JSON
 * *syntaxiquement* valide (mode `json_object`), jamais qu'il respecte cette
 * forme : la validation zod ci-dessous est la seule barriere reelle.
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

/**
 * Un dossier proposable au modele, quel que soit le pipeline.
 *
 * Vendeurs et acquereurs vivent dans des tables differentes (`opportunities`
 * d'un cote, `buyer_criteria` + `prospects` de l'autre). Ne proposer que les
 * premiers rendait tout acquereur invisible des le message suivant, et le
 * modele le recreait faute de le retrouver.
 */
export type Candidate = {
  id: string
  kind: 'seller' | 'buyer'
  name: string
  city: string | null
  stage: string
  /** Renseigne pour les acquereurs : cible des notes dans `lead_events`. */
  leadId: string | null
}

const PER_PIPELINE_LIMIT = 25

export async function listCandidates(): Promise<Candidate[]> {
  const [sellers, buyers] = await Promise.all([listSellers(), listBuyers()])
  return [...sellers, ...buyers]
}

async function listSellers(): Promise<Candidate[]> {
  const { data, error } = await adminDb()
    .from('opportunities')
    .select('id, title, seller_name, property_city, stage')
    .order('updated_at', { ascending: false })
    .limit(PER_PIPELINE_LIMIT)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, string | null>) => ({
    id: row.id as string,
    kind: 'seller' as const,
    name: row.seller_name || row.title || 'Sans nom',
    city: row.property_city ?? null,
    stage: row.stage || 'Nouveau contact',
    leadId: null,
  }))
}

async function listBuyers(): Promise<Candidate[]> {
  const { data, error } = await adminDb()
    .from('buyer_criteria')
    .select('id, lead_id, prospect_id, communes, stage')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(PER_PIPELINE_LIMIT)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<Record<string, unknown>>
  if (rows.length === 0) return []

  // `buyer_criteria.prospect_id` n'a pas de cle etrangere vers `prospects`
  // (colonne TEXT heritee de la migration 004) : PostgREST ne peut donc pas
  // faire la jointure, on la fait ici.
  const prospectIds = rows.map((row) => row.prospect_id).filter(Boolean) as string[]
  const names = new Map<string, string>()

  if (prospectIds.length > 0) {
    const { data: prospects } = await adminDb()
      .from('prospects')
      .select('id, first_name, last_name')
      .in('id', prospectIds)

    for (const prospect of (prospects ?? []) as Array<Record<string, string | null>>) {
      const full = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ').trim()
      if (prospect.id) names.set(prospect.id, full || 'Sans nom')
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    kind: 'buyer' as const,
    name: names.get(row.prospect_id as string) ?? 'Acquereur sans nom',
    city: Array.isArray(row.communes) && row.communes.length > 0 ? String(row.communes[0]) : null,
    stage: (row.stage as string) || 'Nouveau contact',
    leadId: (row.lead_id as string) ?? null,
  }))
}

/** Libelle lisible d'un dossier, pour les reponses Telegram. */
export function candidateLabel(candidate: Candidate) {
  const role = candidate.kind === 'seller' ? 'vendeur' : 'acquereur'
  return [candidate.name, candidate.city].filter(Boolean).join(' — ') + ` (${role})`
}

/** Normalise un nom pour comparer sans se soucier des accents ni de la casse. */
export function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(m|mr|mme|monsieur|madame|les|la|le)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Cherche un dossier existant portant ce nom.
 * Sert de garde-fou anti-doublon avant toute creation de contact.
 */
export function findByName(candidates: Candidate[], rawName: string | null): Candidate | null {
  if (!rawName) return null
  const needle = normalizeName(rawName)
  if (needle.length < 3) return null

  return (
    candidates.find((candidate) => {
      const hay = normalizeName(candidate.name)
      return hay === needle || hay.includes(needle) || needle.includes(hay)
    }) ?? null
  )
}

function renderCandidates(candidates: Candidate[]) {
  if (candidates.length === 0) return 'Aucun dossier existant.'
  return candidates
    .map((c) => {
      const role = c.kind === 'seller' ? 'VENDEUR' : 'ACQUEREUR'
      return `${c.id} | ${role} | ${c.name}${c.city ? ` | ${c.city}` : ''} | ${c.stage}`
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
- "intent" : "note" (information sur un dossier EXISTANT), "task" (chose a faire, avec ou sans echeance),
  "contact_seller" (vendeur INCONNU de la liste), "contact_buyer" (acquereur INCONNU de la liste),
  "unknown" (incomprehensible).
- "target_id" : l'identifiant EXACT d'un dossier de la liste fournie, ou null si aucun ne correspond.
- "target_name" : le nom de personne entendu, tel qu'Alexandre l'a prononce, ou null.
- "content" : l'information reformulee en francais clair, a la troisieme personne, sans perdre de detail chiffre.
- "due_date" : date au format AAAA-MM-JJ si une echeance est exprimee, sinon null.
- "contact" : pour un nouveau contact uniquement, l'objet {name, phone, email, city, property_type, budget}, sinon null.
- "confidence" : ta confiance dans le rattachement au dossier, entre 0 et 1.

Regles imperatives :
- La liste contient des VENDEURS et des ACQUEREURS. Cherche dans les deux avant de conclure a un nouveau contact.
- Si le nom mentionne figure deja dans la liste, l'intention est "note" ou "task" avec son target_id.
  N'utilise "contact_seller" ou "contact_buyer" QUE si la personne est absente de la liste.
- Ignore les civilites (Monsieur, Madame, M., Mme) pour comparer les noms : "Monsieur Martin" et "Martin"
  designent la meme personne.
- Ne devine jamais un target_id absent de la liste. En cas de doute entre deux dossiers, mets null et baisse confidence.
- Les montants sont en euros. "285" dans un contexte de prix signifie 285000.
- N'invente aucune information absente du message.`

/**
 * Transforme un message en intention structuree.
 * Une relance est prevue : le mode json renvoie parfois un contenu vide.
 */
export async function extractIntent(input: {
  text: string
  candidates: Candidate[]
}): Promise<{ extraction: Extraction; providerId: string; model: string }> {
  const userPrompt = [
    `Date du jour : ${todayInParis()} (fuseau Europe/Paris).`,
    '',
    'Dossiers existants (identifiant | role | nom | ville | etape) :',
    renderCandidates(input.candidates),
    '',
    "Message d'Alexandre :",
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

import type { LeadType } from './leads/compute-results'

type AttioLeadInput = {
  token: string
  type: LeadType
  email: string
  prenom?: string
  nom?: string
  telephone?: string
  formData: Record<string, unknown>
  results: Record<string, unknown>
  magicLinkUrl: string
}

type AttioSyncResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  mode?: AttioSyncMode
  entryMode?: AttioListEntryMode
  personRecordId?: string
  listEntryId?: string
  error?: string
}

type AttioJson = Record<string, unknown>
type AttioSyncMode = 'people_only' | 'people_and_lists'
type AttioListEntryMode = 'minimal' | 'full'

const ATTIO_API_BASE_URL = 'https://api.attio.com/v2'

const TYPE_BIEN_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  terrain: 'Terrain',
  immeuble: 'Immeuble',
  individuelle: 'Maison individuelle',
  mitoyenne: 'Maison mitoyenne',
  maison_village: 'Maison de village',
}

/**
 * Best-effort Attio CRM sync.
 *
 * Phase API/Vercel-first:
 * - ATTIO_API_KEY suffit pour créer/mettre à jour le contact People.
 * - Par défaut, aucune entrée de liste n'est créée pour éviter les erreurs tant
 *   que les attributs de listes Attio ne sont pas prêts.
 * - Pour activer les pipelines plus tard, définir ATTIO_SYNC_MODE=people_and_lists
 *   puis renseigner les listes vendeur/acheteur.
 */
export async function syncLeadToAttio(input: AttioLeadInput): Promise<AttioSyncResult> {
  const apiKey = process.env.ATTIO_API_KEY
  const mode = resolveSyncMode()
  const entryMode = resolveListEntryMode()
  if (!apiKey) return { ok: false, skipped: true, reason: 'missing_ATTIO_API_KEY', mode, entryMode }

  try {
    const person = await upsertPerson({ apiKey, input })
    const personRecordId = extractRecordId(person)

    if (!personRecordId) {
      return { ok: false, error: 'Attio person record id introuvable', mode, entryMode }
    }

    if (mode === 'people_only') {
      return {
        ok: true,
        skipped: true,
        reason: 'people_only_mode',
        mode,
        entryMode,
        personRecordId,
      }
    }

    const list = resolvePipelineList(input.type)
    if (!list) {
      return {
        ok: true,
        skipped: true,
        reason: 'missing_pipeline_list_env',
        mode,
        entryMode,
        personRecordId,
      }
    }

    const entry = await upsertListEntry({ apiKey, list, personRecordId, input, entryMode })
    return {
      ok: true,
      mode,
      entryMode,
      personRecordId,
      listEntryId: extractEntryId(entry),
    }
  } catch (err) {
    return {
      ok: false,
      mode,
      entryMode,
      error: err instanceof Error ? err.message : 'Unknown Attio error',
    }
  }
}

async function upsertPerson({ apiKey, input }: { apiKey: string; input: AttioLeadInput }) {
  const fullName = getContactName(input)
  const description = buildPersonDescription(input)
  const values: AttioJson = {
    email_addresses: [{ email_address: input.email }],
    name: [{
      first_name: input.prenom,
      last_name: input.nom,
      full_name: fullName || input.email,
    }],
    description,
  }

  if (input.telephone) {
    values.phone_numbers = [{
      original_phone_number: input.telephone,
      country_code: 'FR',
    }]
  }

  return attioFetch({
    apiKey,
    path: '/objects/people/records?matching_attribute=email_addresses',
    method: 'PUT',
    body: { data: { values } },
  })
}

async function upsertListEntry({
  apiKey,
  list,
  personRecordId,
  input,
  entryMode,
}: {
  apiKey: string
  list: string
  personRecordId: string
  input: AttioLeadInput
  entryMode: AttioListEntryMode
}) {
  return attioFetch({
    apiKey,
    path: `/lists/${encodeURIComponent(list)}/entries`,
    method: 'PUT',
    body: {
      data: {
        parent_record_id: personRecordId,
        parent_object: 'people',
        entry_values: buildEntryValues(input, entryMode),
      },
    },
  })
}

async function attioFetch({
  apiKey,
  path,
  method,
  body,
}: {
  apiKey: string
  path: string
  method: 'GET' | 'PUT' | 'POST'
  body?: unknown
}) {
  const res = await fetch(`${ATTIO_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  const json = await safeJson(res)
  if (!res.ok) {
    throw new Error(`Attio ${res.status}: ${JSON.stringify(json).slice(0, 600)}`)
  }
  return json
}

function resolveSyncMode(): AttioSyncMode {
  return process.env.ATTIO_SYNC_MODE === 'people_and_lists'
    ? 'people_and_lists'
    : 'people_only'
}

function resolveListEntryMode(): AttioListEntryMode {
  return process.env.ATTIO_LIST_ENTRY_MODE === 'full'
    ? 'full'
    : 'minimal'
}

function resolvePipelineList(type: LeadType): string | undefined {
  if (type === 'vendre') {
    return process.env.ATTIO_SELLER_LIST_ID || process.env.ATTIO_SELLER_LIST_SLUG
  }

  if (type === 'acheter') {
    return process.env.ATTIO_BUYER_LIST_ID || process.env.ATTIO_BUYER_LIST_SLUG
  }

  return process.env.ATTIO_AUDIT_LIST_ID || process.env.ATTIO_AUDIT_LIST_SLUG
}

function buildEntryValues(input: AttioLeadInput, entryMode: AttioListEntryMode): AttioJson {
  const stageAttribute = resolveStageAttribute(input.type)
  const stageValue = resolveStageValue(input.type, stageAttribute)

  if (entryMode === 'minimal') {
    return {
      [stageAttribute]: stageValue,
    }
  }

  const values: AttioJson = {
    [stageAttribute]: stageValue,
    nom_dossier: buildDossierName(input),
    source: 'Site web — ' + input.type,
    lead_type: input.type,
    token: input.token,
    magic_link: input.magicLinkUrl,
    rgpd: true,
    notes: buildEntryNotes(input),
  }

  setIfString(values, 'adresse', input.formData.adresse)
  setIfString(values, 'commune', getCommune(input))
  setIfString(values, 'communes', getCommunes(input))
  setIfString(values, 'type_bien', formatTypeBien(input.formData.type_bien))
  setIfString(values, 'criteres', getCriteres(input))
  setIfNumber(values, 'surface', input.formData.surface)
  setIfNumber(values, 'surface_terrain', input.formData.surface_terrain)
  setIfString(values, 'dpe', input.formData.dpe)
  setIfString(values, 'delai', input.formData.delai)
  setIfNumber(values, 'estimation_mediane', input.results.valeur_mediane)
  setIfNumber(values, 'estimation_basse', input.results.fourchette_basse)
  setIfNumber(values, 'estimation_haute', input.results.fourchette_haute)
  setIfNumber(values, 'budget_max', input.formData.budget_max)

  return values
}

function resolveStageAttribute(type: LeadType): string {
  if (type === 'acheter') {
    return process.env.ATTIO_BUYER_STAGE_ATTRIBUTE || 'stage'
  }

  if (type === 'audit') {
    return process.env.ATTIO_AUDIT_STAGE_ATTRIBUTE || 'stage'
  }

  return process.env.ATTIO_SELLER_STAGE_ATTRIBUTE || 'stage'
}

function resolveStageValue(type: LeadType, stageAttribute: string): string {
  if (type === 'acheter') {
    return process.env.ATTIO_BUYER_STAGE_VALUE || 'Recherche reçue'
  }

  if (type === 'audit') {
    return process.env.ATTIO_AUDIT_STAGE_VALUE || 'Audit reçu'
  }

  return process.env.ATTIO_SELLER_STAGE_VALUE || (stageAttribute === 'a_qualifier' ? 'à qualifier' : 'Estimation demandée')
}

function buildDossierName(input: AttioLeadInput): string {
  const contactName = getContactName(input) || input.email
  const commune = getCommune(input)
  const secteur = getCommunes(input)
  const typeBien = formatTypeBien(input.formData.type_bien) || 'Bien'

  if (input.type === 'acheter') {
    const budget = formatBudget(input.formData.budget_max)
    const location = secteur || commune || 'secteur à préciser'
    return ['Recherche', typeBien, budget, location, contactName]
      .filter(Boolean)
      .join(' — ')
  }

  if (input.type === 'audit') {
    return ['Audit', commune || 'secteur à préciser', contactName]
      .filter(Boolean)
      .join(' — ')
  }

  return ['Estimation', commune ? `${typeBien} à ${commune}` : typeBien, contactName]
    .filter(Boolean)
    .join(' — ')
}

function buildPersonDescription(input: AttioLeadInput): string {
  return [
    `Source : site web (${input.type})`,
    `Dossier : ${buildDossierName(input)}`,
    `Token : ${input.token}`,
    `Résultat : ${input.magicLinkUrl}`,
    input.formData.adresse ? `Adresse : ${input.formData.adresse}` : null,
  ].filter(Boolean).join('\n')
}

function buildEntryNotes(input: AttioLeadInput): string {
  const summary = {
    nom_dossier: buildDossierName(input),
    token: input.token,
    type: input.type,
    magicLinkUrl: input.magicLinkUrl,
    contact: {
      prenom: input.prenom ?? null,
      nom: input.nom ?? null,
      email: input.email,
      telephone: input.telephone ?? null,
    },
    formData: input.formData,
    results: input.results,
  }

  return JSON.stringify(summary, null, 2).slice(0, 9000)
}

function getContactName(input: AttioLeadInput): string {
  return [input.prenom, input.nom].filter(Boolean).join(' ').trim()
}

function getCommune(input: AttioLeadInput): string | undefined {
  const explicitCommune = toCleanString(input.formData.commune)
  if (explicitCommune) return explicitCommune

  const adresse = toCleanString(input.formData.adresse)
  if (!adresse) return undefined

  const parts = adresse
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const lastPart = parts.at(-1)
  if (!lastPart) return undefined

  return lastPart
    .replace(/^\d{5}\s+/, '')
    .trim() || undefined
}

function getCommunes(input: AttioLeadInput): string | undefined {
  const direct = toCleanString(input.formData.communes)
  if (direct) return direct

  const rawList = input.formData.communes_recherchees ?? input.formData.secteurs ?? input.formData.localisations
  if (Array.isArray(rawList)) {
    const values = rawList.map(toCleanString).filter(Boolean)
    return values.length > 0 ? values.join(', ') : undefined
  }

  return toCleanString(rawList)
}

function getCriteres(input: AttioLeadInput): string | undefined {
  const direct = toCleanString(input.formData.criteres)
  if (direct) return direct

  const equipements = input.formData.equipements
  if (Array.isArray(equipements)) {
    const values = equipements.map(toCleanString).filter(Boolean)
    if (values.length > 0) return values.join(', ')
  }

  return undefined
}

function formatTypeBien(value: unknown): string | undefined {
  const raw = toCleanString(value)
  if (!raw) return undefined
  return TYPE_BIEN_LABELS[raw] ?? raw
}

function formatBudget(value: unknown): string | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  if (parsed >= 1_000_000) return `${Math.round(parsed / 100_000) / 10}M€`
  if (parsed >= 1000) return `${Math.round(parsed / 1000)}k€`
  return `${parsed}€`
}

function toCleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function setIfString(target: AttioJson, key: string, value: unknown) {
  if (typeof value === 'string' && value.trim().length > 0) target[key] = value.trim()
}

function setIfNumber(target: AttioJson, key: string, value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (Number.isFinite(parsed)) target[key] = parsed
}

function extractRecordId(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return undefined
  const data = (json as { data?: unknown }).data
  if (!data || typeof data !== 'object') return undefined
  const direct = (data as { record_id?: unknown }).record_id
  if (typeof direct === 'string') return direct
  const id = (data as { id?: unknown }).id
  if (id && typeof id === 'object') {
    const recordId = (id as { record_id?: unknown }).record_id
    if (typeof recordId === 'string') return recordId
  }
  return undefined
}

function extractEntryId(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return undefined
  const data = (json as { data?: unknown }).data
  if (!data || typeof data !== 'object') return undefined
  const id = (data as { id?: unknown }).id
  if (id && typeof id === 'object') {
    const entryId = (id as { entry_id?: unknown }).entry_id
    if (typeof entryId === 'string') return entryId
  }
  return undefined
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

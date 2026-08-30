import { adminDb } from '@/lib/ai/db'
import { getSetting } from '@/lib/settings'
import type { Json } from '@/types/supabase'

import { GRANOLA_AI_SIGNATURE, GRANOLA_PROVIDER, type ProvenanceKey } from './types'

/**
 * Execution des actions proposees par l'extraction.
 *
 * Trois garde-fous, un par famille d'ecriture :
 *
 *   A. creer une entite  — aucune fiche sans point d'accroche identifiant, et
 *      une violation d'unicite est un succes deguise (l'entite existe deja),
 *      jamais une erreur ;
 *   B. ajouter un evenement — cle de provenance dans `metadata`, adossee a un
 *      index unique : retraiter deux fois le meme compte rendu ne recree rien ;
 *   C. modifier un champ — l'ancienne valeur part dans la timeline du dossier,
 *      pour qu'un dispatch fautif reste lisible et reversible six semaines plus tard.
 *
 * `high` ne s'execute jamais seul, quelle que soit la configuration.
 */

export const GRANOLA_AUTODISPATCH_KEY = 'granola_autodispatch_enabled'
export const GRANOLA_AUTODISPATCH_MEDIUM_KEY = 'granola_autodispatch_medium_enabled'

/** Code Postgres d'une violation de contrainte d'unicite. */
const UNIQUE_VIOLATION = '23505'

export type DispatchSummary = {
  enabled: boolean
  considered: number
  executed: number
  skipped: number
  failed: number
  results: Array<{ id: string; action_type: string; risk_level: string; status: string; detail: string }>
}

/**
 * Execute les actions Granola eligibles.
 *
 * Tant que `granola_autodispatch_enabled` est faux, rien n'est execute : le
 * brief demande de demarrer en proposition integrale, le temps de juger la
 * qualite d'extraction sur de vrais rendez-vous.
 */
export async function dispatchGranolaActions(options: { limit?: number } = {}): Promise<DispatchSummary> {
  const enabled = await getSetting<boolean>(GRANOLA_AUTODISPATCH_KEY, false)
  const mediumEnabled = await getSetting<boolean>(GRANOLA_AUTODISPATCH_MEDIUM_KEY, false)

  const summary: DispatchSummary = { enabled: enabled === true, considered: 0, executed: 0, skipped: 0, failed: 0, results: [] }
  if (enabled !== true) return summary

  const allowedRisks = mediumEnabled === true ? ['low', 'medium'] : ['low']

  const { data, error } = await adminDb()
    .from('ai_action_queue')
    .select('*')
    .eq('source', GRANOLA_PROVIDER)
    .eq('status', 'proposed')
    .in('risk_level', allowedRisks)
    .order('created_at', { ascending: true })
    .limit(options.limit ?? 50)

  if (error) throw new Error(error.message)

  const actions = data ?? []
  summary.considered = actions.length

  for (const action of actions) {
    const outcome = await runAction(action, 'ai:granola-autodispatch')
    summary.results.push({
      id: action.id,
      action_type: action.action_type,
      risk_level: action.risk_level,
      status: outcome.status,
      detail: outcome.detail,
    })
    if (outcome.status === 'executed') summary.executed += 1
    else if (outcome.status === 'failed') summary.failed += 1
    else summary.skipped += 1
  }

  return summary
}

/**
 * Execute une action apres validation humaine — seule voie pour un `high`.
 */
export async function executeGranolaActionById(id: string, actor = 'admin') {
  const { data: action, error } = await adminDb()
    .from('ai_action_queue')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!action) throw new Error('Action introuvable')
  if (!['proposed', 'approved', 'failed'].includes(action.status)) {
    throw new Error(`Action deja ${action.status}`)
  }

  return runAction(action, actor)
}

async function runAction(action: any, actor: string): Promise<{ status: 'executed' | 'failed' | 'skipped'; detail: string }> {
  // Filet de securite en profondeur : meme appelee directement, une action
  // `high` exige un acteur humain identifie.
  if (action.risk_level === 'high' && actor.startsWith('ai:')) {
    return { status: 'skipped', detail: 'Action a risque eleve : validation humaine requise.' }
  }

  try {
    const result = await executeAction(action, actor)
    const { error } = await adminDb()
      .from('ai_action_queue')
      .update({
        status: 'executed',
        result: result as Json,
        error: null,
        reviewed_by: actor,
        reviewed_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
      })
      .eq('id', action.id)

    if (error) throw new Error(error.message)
    return { status: 'executed', detail: JSON.stringify(result) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await adminDb().from('ai_action_queue').update({ status: 'failed', error: message }).eq('id', action.id)
    return { status: 'failed', detail: message }
  }
}

async function executeAction(action: any, actor: string): Promise<Record<string, unknown>> {
  const payload = asRecord(action.payload)
  const provenance = readProvenance(payload)
  const projectId = asText(payload.project_id)

  switch (action.action_type) {
    case 'create_activity':
      return createActivity({ payload, provenance, projectId, fallbackTitle: action.title })

    case 'update_project_field':
      return updateProjectField({ payload, provenance, projectId, actor })

    case 'create_contact':
      return createContact({ payload, provenance })

    // Actions sortantes : Mandat OS n'envoie pas d'e-mail ni ne publie
    // d'annonce a la place d'Alexandre. « Valider » signifie ici qu'il l'a fait
    // lui-meme ; la trace reste dans la file, avec qui l'a acquittee et quand.
    case 'draft_email':
    case 'publish_listing':
    case 'update_public_price':
      return {
        executed_outside_app: true,
        acknowledged_by: actor,
        acknowledged_at: new Date().toISOString(),
        note: "Action realisee hors de l'app et acquittee manuellement.",
      }

    default:
      throw new Error(`Type d'action sans executeur : ${action.action_type}`)
  }
}

/**
 * Garde-fou B — ajouter un evenement.
 *
 * L'insertion porte sa cle de provenance ; l'index unique partiel en base fait
 * le reste. Une violation d'unicite signifie « deja fait » : c'est un succes,
 * et c'est exactement ce qui rend le retraitement idempotent.
 */
async function createActivity(input: {
  payload: Record<string, unknown>
  provenance: ProvenanceKey
  projectId: string | null
  fallbackTitle: string
}): Promise<Record<string, unknown>> {
  if (!input.projectId) {
    throw new Error("Aucune affaire rattachee : impossible d'ecrire dans la timeline.")
  }

  const activityType = asText(input.payload.activity_type) ?? 'note'
  const { data, error } = await adminDb()
    .from('activities')
    .insert({
      opportunity_id: input.projectId,
      type: activityType,
      title: asText(input.payload.title) ?? input.fallbackTitle,
      content: asText(input.payload.content),
      created_by: GRANOLA_AI_SIGNATURE,
      metadata: { ...input.provenance, priority: asText(input.payload.priority) },
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { already_applied: true, reason: 'Activite deja creee pour cet element (cle de provenance).' }
    }
    throw new Error(error.message)
  }

  return { activity_id: data.id }
}

/**
 * Garde-fou C — modifier un champ existant.
 *
 * Remplir un champ vide est reversible et sans trace supplementaire. Ecraser
 * une valeur saisie a la main ne l'est pas : l'ancienne valeur est ecrite dans
 * la timeline AVANT la modification, sous la meme cle de provenance.
 */
async function updateProjectField(input: {
  payload: Record<string, unknown>
  provenance: ProvenanceKey
  projectId: string | null
  actor: string
}): Promise<Record<string, unknown>> {
  const field = asText(input.payload.field)
  const newValue = input.payload.new_value
  if (!input.projectId) throw new Error('Aucune affaire rattachee.')
  if (!field) throw new Error('Champ cible manquant.')

  const allowed = ['property_type', 'property_surface', 'property_rooms', 'property_city']
  if (!allowed.includes(field)) throw new Error(`Champ non modifiable par l'IA : ${field}`)

  const { data: project, error: readError } = await adminDb()
    .from('projects')
    .select(`id, ${field}`)
    .eq('id', input.projectId)
    .maybeSingle()

  if (readError) throw new Error(readError.message)
  if (!project) throw new Error('Affaire introuvable')

  const currentValue = (project as Record<string, unknown>)[field]
  const hadValue = currentValue !== null && currentValue !== undefined && String(currentValue).trim() !== ''

  if (hadValue) {
    const { error: traceError } = await adminDb()
      .from('activities')
      .insert({
        opportunity_id: input.projectId,
        type: 'system',
        title: `Champ « ${field} » modifie par l'IA`,
        content: `Ancienne valeur : ${String(currentValue)}\nNouvelle valeur : ${String(newValue)}\nSource : compte rendu Granola ${input.provenance.source_external_id}`,
        created_by: GRANOLA_AI_SIGNATURE,
        metadata: {
          ...input.provenance,
          source_item_key: `${input.provenance.source_item_key}:trace`,
          previous_value: currentValue as Json,
          new_value: newValue as Json,
          applied_by: input.actor,
        },
      })

    // Un doublon de trace signifie que l'ecrasement a deja ete applique :
    // on s'arrete la plutot que d'ecraser une seconde fois.
    if (traceError) {
      if (traceError.code === UNIQUE_VIOLATION) {
        return { already_applied: true, reason: 'Modification deja appliquee (trace de provenance presente).' }
      }
      throw new Error(traceError.message)
    }
  }

  const { error: writeError } = await adminDb()
    .from('projects')
    .update({ [field]: newValue, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)

  if (writeError) throw new Error(writeError.message)

  return { project_id: input.projectId, field, previous_value: currentValue ?? null, new_value: newValue }
}

/**
 * Garde-fou A — creer une entite.
 *
 * Les index uniques partiels sur l'e-mail et le telephone normalise rendent le
 * doublon impossible ; ici on transforme la collision en rattachement a la
 * fiche existante, pour que l'action ne finisse pas en `failed` alors que le
 * resultat attendu est atteint.
 */
async function createContact(input: {
  payload: Record<string, unknown>
  provenance: ProvenanceKey
}): Promise<Record<string, unknown>> {
  const email = asText(input.payload.email)
  const phone = asText(input.payload.phone)
  const firstName = asText(input.payload.first_name) ?? ''
  const lastName = asText(input.payload.last_name) ?? ''

  if (!email && !phone) {
    throw new Error("Aucun point d'accroche identifiant : la mention reste dans l'activite, aucune fiche creee.")
  }

  const types = Array.isArray(input.payload.types) && input.payload.types.length > 0
    ? (input.payload.types as string[])
    : ['reseau']

  const { data, error } = await adminDb()
    .from('contacts')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      relation: asText(input.payload.relation),
      types,
      source: GRANOLA_AI_SIGNATURE,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const existing = await findExistingContact({ email, phone })
      return {
        already_applied: true,
        contact_id: existing?.id ?? null,
        reason: 'Contact deja present (cle d\'identite e-mail ou telephone).',
      }
    }
    throw new Error(error.message)
  }

  return { contact_id: data.id }
}

async function findExistingContact(input: { email: string | null; phone: string | null }) {
  if (input.email) {
    const { data } = await adminDb().from('contacts').select('id').eq('email', input.email).maybeSingle()
    if (data) return data
  }
  if (input.phone) {
    const { data } = await adminDb().from('contacts').select('id').eq('phone', input.phone).maybeSingle()
    if (data) return data
  }
  return null
}

function readProvenance(payload: Record<string, unknown>): ProvenanceKey {
  const provenance = asRecord(payload.provenance)
  return {
    source_provider: asText(provenance.source_provider) ?? GRANOLA_PROVIDER,
    source_external_id: asText(provenance.source_external_id) ?? 'inconnu',
    source_item_key: asText(provenance.source_item_key) ?? 'item',
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

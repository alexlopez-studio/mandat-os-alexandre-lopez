import { adminDb } from '@/lib/ai/db'
import type { Candidate, Extraction } from '@/lib/telegram/extraction'
import { candidateLabel } from '@/lib/telegram/extraction'

/**
 * Journal reversible.
 *
 * Principe retenu avec Alexandre : on ecrit d'abord, on ne demande pas de
 * validation. Chaque ecriture depose donc son inverse dans `telegram_operations`,
 * et `/annuler` le rejoue. Les actions irreversibles (envoi vers un tiers)
 * ne passeront jamais par ici.
 */

type UndoStep =
  | { type: 'delete'; table: string; id: string }
  | { type: 'restore'; table: string; id: string; values: Record<string, unknown> }

export type AppliedOperation = {
  ref: number
  summary: string
}

async function recordOperation(input: {
  chatId: number
  intent: string
  summary: string
  sourceText: string
  targetTable: string | null
  targetId: string | null
  steps: UndoStep[]
}): Promise<AppliedOperation> {
  const { data, error } = await adminDb()
    .from('telegram_operations')
    .insert({
      chat_id: input.chatId,
      intent: input.intent,
      summary: input.summary,
      source_text: input.sourceText,
      target_table: input.targetTable,
      target_id: input.targetId,
      undo: { steps: input.steps },
    })
    .select('ref, summary')
    .single()

  if (error) throw new Error(error.message)
  return { ref: data.ref as number, summary: data.summary as string }
}

/** Applique une intention extraite et retourne le numero court a afficher. */
export async function applyExtraction(input: {
  chatId: number
  sourceText: string
  extraction: Extraction
  target: Candidate | null
}): Promise<AppliedOperation> {
  const { extraction, target } = input

  if (extraction.intent === 'note' || extraction.intent === 'task') {
    if (!target) throw new Error('Aucun dossier identifie')
    return target.kind === 'seller'
      ? applyToSeller(input, target)
      : applyToBuyer(input, target)
  }

  if (extraction.intent === 'contact_seller') return createSeller(input)
  if (extraction.intent === 'contact_buyer') return createBuyer(input)

  throw new Error('Intention non reconnue')
}

// ── Notes et taches ───────────────────────────────────────────

async function applyToSeller(
  input: { chatId: number; sourceText: string; extraction: Extraction },
  target: Candidate,
): Promise<AppliedOperation> {
  const { extraction } = input
  const isTask = extraction.intent === 'task'

  const { data, error } = await adminDb()
    .from('opportunity_events')
    .insert({
      opportunity_id: target.id,
      type: isTask ? 'task' : 'note',
      title: isTask ? 'Tache (Telegram)' : 'Note (Telegram)',
      content: extraction.content,
      due_at: extraction.due_date ? `${extraction.due_date}T09:00:00Z` : null,
      metadata: { source: 'telegram' },
      created_by: 'telegram',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  return recordOperation({
    chatId: input.chatId,
    intent: extraction.intent,
    summary: summaryFor(isTask, target, extraction.due_date),
    sourceText: input.sourceText,
    targetTable: 'opportunity_events',
    targetId: data.id as string,
    steps: [{ type: 'delete', table: 'opportunity_events', id: data.id as string }],
  })
}

/**
 * Les acquereurs n'ont pas de table d'evenements dediee : leur historique
 * passe par `lead_events`, rattache au lead. Pour une tache, on met aussi a
 * jour `next_action` / `due_date` sur la fiche — en memorisant les valeurs
 * precedentes pour que `/annuler` les restaure.
 */
async function applyToBuyer(
  input: { chatId: number; sourceText: string; extraction: Extraction },
  target: Candidate,
): Promise<AppliedOperation> {
  const { extraction } = input
  const isTask = extraction.intent === 'task'
  if (!target.leadId) throw new Error('Acquereur sans lead rattache')

  const { data, error } = await adminDb()
    .from('lead_events')
    .insert({
      lead_id: target.leadId,
      kind: 'note',
      payload: {
        source: 'telegram',
        type: isTask ? 'task' : 'note',
        content: extraction.content,
        due_date: extraction.due_date,
      },
      created_by: 'telegram',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  const steps: UndoStep[] = [{ type: 'delete', table: 'lead_events', id: data.id as string }]

  if (isTask) {
    const { data: before } = await adminDb()
      .from('buyer_criteria')
      .select('next_action, due_date')
      .eq('id', target.id)
      .maybeSingle()

    const { error: updateError } = await adminDb()
      .from('buyer_criteria')
      .update({ next_action: extraction.content, due_date: extraction.due_date })
      .eq('id', target.id)

    if (!updateError) {
      steps.push({
        type: 'restore',
        table: 'buyer_criteria',
        id: target.id,
        values: {
          next_action: before?.next_action ?? null,
          due_date: before?.due_date ?? null,
        },
      })
    }
  }

  return recordOperation({
    chatId: input.chatId,
    intent: extraction.intent,
    summary: summaryFor(isTask, target, extraction.due_date),
    sourceText: input.sourceText,
    targetTable: 'lead_events',
    targetId: data.id as string,
    steps,
  })
}

function summaryFor(isTask: boolean, target: Candidate, dueDate: string | null) {
  const suffix = dueDate ? ` — echeance ${dueDate}` : ''
  return `${isTask ? 'Tache' : 'Note'} — ${candidateLabel(target)}${suffix}`
}

// ── Creation de contacts ──────────────────────────────────────

async function createSeller(input: {
  chatId: number
  sourceText: string
  extraction: Extraction
}): Promise<AppliedOperation> {
  const { extraction } = input
  const contact = extraction.contact
  const name = contact?.name ?? extraction.target_name ?? 'Vendeur sans nom'
  const city = contact?.city ?? null

  const { data, error } = await adminDb()
    .from('opportunities')
    .insert({
      title: [name, city].filter(Boolean).join(' — '),
      description: extraction.content,
      stage: 'Nouveau contact',
      seller_name: name,
      seller_phone: contact?.phone ?? null,
      seller_email: contact?.email ?? null,
      property_city: city,
      property_type: contact?.property_type ?? null,
      source_channel: 'telegram',
      created_from: 'telegram',
      note: extraction.content,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  return recordOperation({
    chatId: input.chatId,
    intent: extraction.intent,
    summary: `Nouveau vendeur — ${[name, city].filter(Boolean).join(', ')}`,
    sourceText: input.sourceText,
    targetTable: 'opportunities',
    targetId: data.id as string,
    steps: [{ type: 'delete', table: 'opportunities', id: data.id as string }],
  })
}

async function createBuyer(input: {
  chatId: number
  sourceText: string
  extraction: Extraction
}): Promise<AppliedOperation> {
  const { extraction } = input
  const contact = extraction.contact
  const fullName = (contact?.name ?? extraction.target_name ?? 'Acquereur sans nom').trim()
  const [firstName, ...rest] = fullName.split(/\s+/)

  // Un acquereur se materialise par une chaine prospect → lead → criteres.
  const { data: prospect, error: prospectError } = await adminDb()
    .from('prospects')
    .insert({
      first_name: firstName ?? fullName,
      last_name: rest.join(' '),
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
    })
    .select('id')
    .single()
  if (prospectError) throw new Error(prospectError.message)

  const { data: lead, error: leadError } = await adminDb()
    .from('leads')
    .insert({
      prospect_id: prospect.id,
      tool: 'acheter',
      commune: contact?.city ?? null,
      source_channel: 'telegram',
      form_data: { origine: 'telegram', message: input.sourceText },
    })
    .select('id')
    .single()
  if (leadError) throw new Error(leadError.message)

  const { data: criteria, error: criteriaError } = await adminDb()
    .from('buyer_criteria')
    .insert({
      lead_id: lead.id,
      prospect_id: prospect.id,
      type_bien: contact?.property_type ?? null,
      communes: contact?.city ? [contact.city] : null,
      budget_max: contact?.budget ?? null,
      active: true,
    })
    .select('id')
    .single()
  if (criteriaError) throw new Error(criteriaError.message)

  return recordOperation({
    chatId: input.chatId,
    intent: extraction.intent,
    summary: `Nouvel acquereur — ${[fullName, contact?.city].filter(Boolean).join(', ')}`,
    sourceText: input.sourceText,
    targetTable: 'buyer_criteria',
    targetId: criteria.id as string,
    steps: [
      { type: 'delete', table: 'buyer_criteria', id: criteria.id as string },
      { type: 'delete', table: 'leads', id: lead.id as string },
      { type: 'delete', table: 'prospects', id: prospect.id as string },
    ],
  })
}

// ── Recap et annulation ───────────────────────────────────────

export type RecapEntry = {
  ref: number
  summary: string
  status: string
  created_at: string
}

/** Operations des `days` derniers jours, plus recentes d'abord. */
export async function listRecap(chatId: number, days: number): Promise<RecapEntry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await adminDb()
    .from('telegram_operations')
    .select('ref, summary, status, created_at')
    .eq('chat_id', chatId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? []) as RecapEntry[]
}

/**
 * Annule une operation. Sans `ref`, annule la derniere encore appliquee.
 * Retourne le resume de l'operation annulee.
 */
export async function undoOperation(chatId: number, ref?: number): Promise<string> {
  let query = adminDb()
    .from('telegram_operations')
    .select('id, ref, summary, undo, status')
    .eq('chat_id', chatId)
    .eq('status', 'applied')

  query = ref ? query.eq('ref', ref) : query.order('created_at', { ascending: false }).limit(1)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const operation = (data ?? [])[0]
  if (!operation) {
    throw new Error(ref ? `Operation #${ref} introuvable ou deja annulee` : 'Rien a annuler')
  }

  for (const step of (operation.undo?.steps ?? []) as UndoStep[]) {
    const { error: stepError } =
      step.type === 'restore'
        ? await adminDb().from(step.table).update(step.values).eq('id', step.id)
        : await adminDb().from(step.table).delete().eq('id', step.id)

    if (stepError) throw new Error(`Annulation partielle : ${stepError.message}`)
  }

  const { error: updateError } = await adminDb()
    .from('telegram_operations')
    .update({ status: 'undone', undone_at: new Date().toISOString() })
    .eq('id', operation.id)
  if (updateError) throw new Error(updateError.message)

  return operation.summary as string
}

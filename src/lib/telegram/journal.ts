import { adminDb } from '@/lib/ai/db'
import type { Extraction } from '@/lib/telegram/extraction'

/**
 * Journal reversible.
 *
 * Principe retenu avec Alexandre : on ecrit d'abord, on ne demande pas de
 * validation. Chaque ecriture depose donc son inverse dans `telegram_operations`,
 * et `/annuler` le rejoue. Les actions irreversibles (envoi vers un tiers)
 * ne passeront jamais par ici — elles resteront soumises a confirmation.
 */

type UndoStep = { table: string; id: string }

export type AppliedOperation = {
  ref: number
  summary: string
}

/** Etapes de suppression, enfants d'abord pour ne pas casser les references. */
function undoPayload(steps: UndoStep[]) {
  return { type: 'delete', steps }
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
      undo: undoPayload(input.steps),
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
  candidateLabel: string | null
}): Promise<AppliedOperation> {
  const { extraction } = input

  if (extraction.intent === 'note' || extraction.intent === 'task') {
    if (!extraction.target_id) throw new Error('Aucun dossier identifie')

    const { data, error } = await adminDb()
      .from('opportunity_events')
      .insert({
        opportunity_id: extraction.target_id,
        type: extraction.intent === 'task' ? 'task' : 'note',
        title: extraction.intent === 'task' ? 'Tache (Telegram)' : 'Note (Telegram)',
        content: extraction.content,
        due_at: extraction.due_date ? `${extraction.due_date}T09:00:00Z` : null,
        metadata: { source: 'telegram' },
        created_by: 'telegram',
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    const label = input.candidateLabel ?? 'dossier'
    const suffix = extraction.due_date ? ` — echeance ${extraction.due_date}` : ''
    return recordOperation({
      chatId: input.chatId,
      intent: extraction.intent,
      summary: `${extraction.intent === 'task' ? 'Tache' : 'Note'} — ${label}${suffix}`,
      sourceText: input.sourceText,
      targetTable: 'opportunity_events',
      targetId: data.id as string,
      steps: [{ table: 'opportunity_events', id: data.id as string }],
    })
  }

  if (extraction.intent === 'contact_seller') {
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
      steps: [{ table: 'opportunities', id: data.id as string }],
    })
  }

  if (extraction.intent === 'contact_buyer') {
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
        { table: 'buyer_criteria', id: criteria.id as string },
        { table: 'leads', id: lead.id as string },
        { table: 'prospects', id: prospect.id as string },
      ],
    })
  }

  throw new Error('Intention non reconnue')
}

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

  const steps = (operation.undo?.steps ?? []) as UndoStep[]
  for (const step of steps) {
    const { error: deleteError } = await adminDb().from(step.table).delete().eq('id', step.id)
    if (deleteError) throw new Error(`Annulation partielle : ${deleteError.message}`)
  }

  const { error: updateError } = await adminDb()
    .from('telegram_operations')
    .update({ status: 'undone', undone_at: new Date().toISOString() })
    .eq('id', operation.id)
  if (updateError) throw new Error(updateError.message)

  return operation.summary as string
}

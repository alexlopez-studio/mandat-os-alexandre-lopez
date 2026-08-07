import { adminDb } from '@/lib/ai/db'

/**
 * Accès CRM pour l'agent Telegram : recherche, lecture, écriture.
 *
 * Toute écriture dépose son inverse dans `telegram_operations` : c'est ce qui
 * rend `/annuler` possible. Les lectures, elles, sont ce qui donne des yeux à
 * l'agent — il interroge cette base au lieu de recevoir une liste figée.
 */

export type Dossier = {
  id: string
  kind: 'vendeur' | 'acquereur'
  name: string
  city: string | null
  stage: string
  /** Renseigné pour les acquéreurs : cible des notes dans `lead_events`. */
  leadId: string | null
}

type UndoStep =
  | { type: 'delete'; table: string; id: string }
  | { type: 'restore'; table: string; id: string; values: Record<string, unknown> }

export type AppliedOperation = { ref: number; summary: string }

// ── Recherche et lecture ──────────────────────────────────────

/** Normalise un nom : sans accents, sans civilité, comparable. */
export function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(m|mr|mme|monsieur|madame|les|la|le|famille)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function allDossiers(): Promise<Dossier[]> {
  const [sellers, buyers] = await Promise.all([
    adminDb()
      .from('opportunities')
      .select('id, title, seller_name, property_city, stage')
      .order('updated_at', { ascending: false })
      .limit(200),
    adminDb()
      .from('buyer_criteria')
      .select('id, lead_id, prospect_id, communes, stage')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(200),
  ])

  if (sellers.error) throw new Error(sellers.error.message)
  if (buyers.error) throw new Error(buyers.error.message)

  const result: Dossier[] = (sellers.data ?? []).map((row: Record<string, string | null>) => ({
    id: row.id as string,
    kind: 'vendeur' as const,
    name: row.seller_name || row.title || 'Sans nom',
    city: row.property_city ?? null,
    stage: row.stage || 'Nouveau contact',
    leadId: null,
  }))

  const buyerRows = (buyers.data ?? []) as Array<Record<string, unknown>>
  if (buyerRows.length > 0) {
    // `buyer_criteria.prospect_id` n'a pas de clé étrangère vers `prospects`
    // (colonne TEXT héritée de la migration 004) : jointure faite ici.
    const ids = buyerRows.map((row) => row.prospect_id).filter(Boolean) as string[]
    const names = new Map<string, string>()

    if (ids.length > 0) {
      const { data: prospects } = await adminDb()
        .from('prospects')
        .select('id, first_name, last_name')
        .in('id', ids)

      for (const p of (prospects ?? []) as Array<Record<string, string | null>>) {
        const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
        if (p.id) names.set(p.id, full || 'Sans nom')
      }
    }

    for (const row of buyerRows) {
      result.push({
        id: row.id as string,
        kind: 'acquereur',
        name: names.get(row.prospect_id as string) ?? 'Sans nom',
        city: Array.isArray(row.communes) && row.communes.length ? String(row.communes[0]) : null,
        stage: (row.stage as string) || 'Nouveau contact',
        leadId: (row.lead_id as string) ?? null,
      })
    }
  }

  return result
}

/** Cherche un dossier par nom, insensible aux accents et aux civilités. */
export async function searchDossiers(query: string): Promise<Dossier[]> {
  const needle = normalizeName(query)
  const dossiers = await allDossiers()
  if (needle.length < 2) return dossiers.slice(0, 10)

  return dossiers
    .filter((dossier) => {
      const hay = normalizeName(dossier.name)
      const city = normalizeName(dossier.city ?? '')
      return hay.includes(needle) || needle.includes(hay) || city.includes(needle)
    })
    .slice(0, 10)
}

export async function getDossier(id: string): Promise<Dossier | null> {
  const dossiers = await allDossiers()
  return dossiers.find((dossier) => dossier.id === id) ?? null
}

/** Détail complet d'un dossier, pour que l'agent sache ce qui est déjà connu. */
export async function readDossierDetail(id: string): Promise<Record<string, unknown> | null> {
  const dossier = await getDossier(id)
  if (!dossier) return null

  if (dossier.kind === 'vendeur') {
    const { data } = await adminDb()
      .from('opportunities')
      .select('seller_name, seller_phone, seller_email, property_city, property_type, property_surface, estimated_price_min, estimated_price_max, stage, note')
      .eq('id', id)
      .maybeSingle()

    const { data: events } = await adminDb()
      .from('opportunity_events')
      .select('type, content, due_at, occurred_at')
      .eq('opportunity_id', id)
      .order('occurred_at', { ascending: false })
      .limit(8)

    return { ...dossier, fiche: data ?? {}, historique: events ?? [] }
  }

  const { data } = await adminDb()
    .from('buyer_criteria')
    .select('type_bien, communes, budget_max, surface_min, pieces_min, stage, next_action, due_date')
    .eq('id', id)
    .maybeSingle()

  const { data: events } = dossier.leadId
    ? await adminDb()
        .from('lead_events')
        .select('kind, payload, created_at')
        .eq('lead_id', dossier.leadId)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] }

  return { ...dossier, fiche: data ?? {}, historique: events ?? [] }
}

// ── Journal ───────────────────────────────────────────────────

async function record(input: {
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

export function dossierLabel(dossier: Dossier) {
  return [dossier.name, dossier.city].filter(Boolean).join(' — ') + ` (${dossier.kind})`
}

// ── Écritures ─────────────────────────────────────────────────

export async function addNoteOrTask(input: {
  chatId: number
  sourceText: string
  dossierId: string
  content: string
  dueDate?: string | null
  isTask: boolean
}): Promise<AppliedOperation> {
  const dossier = await getDossier(input.dossierId)
  if (!dossier) throw new Error('Dossier introuvable')

  const suffix = input.dueDate ? ` — échéance ${input.dueDate}` : ''
  const summary = `${input.isTask ? 'Tâche' : 'Note'} — ${dossierLabel(dossier)}${suffix}`

  if (dossier.kind === 'vendeur') {
    const { data, error } = await adminDb()
      .from('opportunity_events')
      .insert({
        opportunity_id: dossier.id,
        type: input.isTask ? 'task' : 'note',
        title: input.isTask ? 'Tâche (Telegram)' : 'Note (Telegram)',
        content: input.content,
        due_at: input.dueDate ? `${input.dueDate}T09:00:00Z` : null,
        metadata: { source: 'telegram' },
        created_by: 'telegram',
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return record({
      chatId: input.chatId,
      intent: input.isTask ? 'task' : 'note',
      summary,
      sourceText: input.sourceText,
      targetTable: 'opportunity_events',
      targetId: data.id as string,
      steps: [{ type: 'delete', table: 'opportunity_events', id: data.id as string }],
    })
  }

  if (!dossier.leadId) throw new Error('Acquéreur sans lead rattaché')

  const { data, error } = await adminDb()
    .from('lead_events')
    .insert({
      lead_id: dossier.leadId,
      kind: 'note',
      payload: {
        source: 'telegram',
        type: input.isTask ? 'task' : 'note',
        content: input.content,
        due_date: input.dueDate ?? null,
      },
      created_by: 'telegram',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  const steps: UndoStep[] = [{ type: 'delete', table: 'lead_events', id: data.id as string }]

  if (input.isTask) {
    const { data: before } = await adminDb()
      .from('buyer_criteria')
      .select('next_action, due_date')
      .eq('id', dossier.id)
      .maybeSingle()

    const { error: updateError } = await adminDb()
      .from('buyer_criteria')
      .update({ next_action: input.content, due_date: input.dueDate ?? null })
      .eq('id', dossier.id)

    if (!updateError) {
      steps.push({
        type: 'restore',
        table: 'buyer_criteria',
        id: dossier.id,
        values: { next_action: before?.next_action ?? null, due_date: before?.due_date ?? null },
      })
    }
  }

  return record({
    chatId: input.chatId,
    intent: input.isTask ? 'task' : 'note',
    summary,
    sourceText: input.sourceText,
    targetTable: 'lead_events',
    targetId: data.id as string,
    steps,
  })
}

export type ContactInput = {
  chatId: number
  sourceText: string
  name: string
  city?: string | null
  phone?: string | null
  email?: string | null
  propertyType?: string | null
  amount?: number | null
  note?: string | null
}

export async function createSeller(input: ContactInput): Promise<AppliedOperation> {
  const { data, error } = await adminDb()
    .from('opportunities')
    .insert({
      title: [input.name, input.city].filter(Boolean).join(' — '),
      description: input.note ?? input.sourceText,
      stage: 'Nouveau contact',
      seller_name: input.name,
      seller_phone: input.phone ?? null,
      seller_email: input.email ?? null,
      property_city: input.city ?? null,
      property_type: input.propertyType ?? null,
      estimated_price_min: input.amount ?? null,
      source_channel: 'telegram',
      created_from: 'telegram',
      note: input.note ?? input.sourceText,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  return record({
    chatId: input.chatId,
    intent: 'contact_seller',
    summary: `Nouveau vendeur — ${[input.name, input.city].filter(Boolean).join(', ')}`,
    sourceText: input.sourceText,
    targetTable: 'opportunities',
    targetId: data.id as string,
    steps: [{ type: 'delete', table: 'opportunities', id: data.id as string }],
  })
}

export async function createBuyer(input: ContactInput): Promise<AppliedOperation> {
  const [firstName, ...rest] = input.name.trim().split(/\s+/)

  // Un acquéreur se matérialise par une chaîne prospect → lead → critères.
  const { data: prospect, error: prospectError } = await adminDb()
    .from('prospects')
    .insert({
      first_name: firstName ?? input.name,
      last_name: rest.join(' '),
      phone: input.phone ?? null,
      email: input.email ?? null,
    })
    .select('id')
    .single()
  if (prospectError) throw new Error(prospectError.message)

  const { data: lead, error: leadError } = await adminDb()
    .from('leads')
    .insert({
      prospect_id: prospect.id,
      tool: 'acheter',
      commune: input.city ?? null,
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
      type_bien: input.propertyType ?? null,
      communes: input.city ? [input.city] : null,
      budget_max: input.amount ?? null,
      active: true,
    })
    .select('id')
    .single()
  if (criteriaError) throw new Error(criteriaError.message)

  return record({
    chatId: input.chatId,
    intent: 'contact_buyer',
    summary: `Nouvel acquéreur — ${[input.name, input.city].filter(Boolean).join(', ')}`,
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

// ── Récap et annulation ───────────────────────────────────────

export type RecapEntry = { ref: number; summary: string; status: string; created_at: string }

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
    throw new Error(ref ? `Opération #${ref} introuvable ou déjà annulée` : 'Rien à annuler')
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

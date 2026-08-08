import { adminDb } from '@/lib/ai/db'
import { formatFrenchDate, parseFrenchDate } from '@/lib/telegram/dates'

export type Projet = {
  id: string
  kind: 'vente' | 'achat'
  title: string
  city: string | null
  stage: string
}

type UndoStep =
  | { type: 'delete'; table: string; id: string }
  | { type: 'restore'; table: string; id: string; values: Record<string, unknown> }

export type AppliedOperation = { ref: number; summary: string }

// ── Recherche et lecture ──────────────────────────────────────

export function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(m|mr|mme|monsieur|madame|les|la|le|famille)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export async function searchContacts(query: string) {
  const needle = normalizeName(query)
  if (needle.length < 2) return []

  const { data, error } = await adminDb()
    .from('contacts')
    .select('id, first_name, last_name, email, phone')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)

  return (data || []).filter((c: any) => {
    const hay = normalizeName(`${c.first_name} ${c.last_name}`)
    return hay.includes(needle) || needle.includes(hay)
  }).slice(0, 10)
}

export async function searchProjects(query: string): Promise<Projet[]> {
  const needle = normalizeName(query)
  if (needle.length < 2) return []

  // We query projects and join contacts through project_contacts
  const { data, error } = await adminDb()
    .from('projects')
    .select(`
      id, kind, title, property_city, communes, stage,
      project_contacts ( contact_id, role, contacts ( first_name, last_name ) )
    `)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)

  return (data || [])
    .map((p: any) => {
      // Find main contact names to match against
      const contactNames = (p.project_contacts || []).map((pc: any) => 
        normalizeName(`${pc.contacts?.first_name || ''} ${pc.contacts?.last_name || ''}`)
      ).join(' ')
      const title = p.title || 'Projet sans titre'
      const city = p.kind === 'vente' ? p.property_city : (p.communes?.[0] || null)
      const hay = normalizeName(`${title} ${contactNames} ${city || ''}`)

      return {
        id: p.id,
        kind: p.kind,
        title,
        city,
        stage: p.stage,
        _hay: hay
      }
    })
    .filter((p: any) => p._hay.includes(needle) || needle.includes(p._hay))
    .map(({ _hay, ...p }: any) => p)
    .slice(0, 10)
}

export async function getProject(id: string): Promise<Projet | null> {
  const { data, error } = await adminDb()
    .from('projects')
    .select('id, kind, title, property_city, communes, stage')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    kind: data.kind,
    title: data.title || 'Projet sans titre',
    city: data.kind === 'vente' ? data.property_city : (data.communes?.[0] || null),
    stage: data.stage
  }
}

export async function readProjectDetail(id: string): Promise<Record<string, unknown> | null> {
  const projet = await getProject(id)
  if (!projet) return null

  let fiche: any = {}
  if (projet.kind === 'vente') {
    const { data } = await adminDb()
      .from('projects')
      .select('seller_name, seller_phone, seller_email, property_city, property_type, property_surface, estimated_price_min, estimated_price_max, stage, note')
      .eq('id', id)
      .maybeSingle()
    fiche = data ?? {}
  } else {
    const { data } = await adminDb()
      .from('projects')
      .select('type_bien, communes, budget_max, surface_min, pieces_min, stage, next_action, due_date')
      .eq('id', id)
      .maybeSingle()
    fiche = data ?? {}
  }

  const { data: events } = await adminDb()
    .from('activities')
    .select('id, type, content, due_at, completed_at, occurred_at')
    .eq('project_id', id)
    .order('occurred_at', { ascending: false })
    .limit(8)

  return { ...projet, fiche, historique: events ?? [] }
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

export function projetLabel(projet: Projet) {
  return [projet.title, projet.city].filter(Boolean).join(' — ') + ` (${projet.kind})`
}

// ── Rapprochement de libellés ─────────────────────────────────

const STOP_WORDS = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'au', 'aux', 'et', 'pour', 'avec', 'son', 'sa'])

function stems(value: string) {
  return Array.from(
    new Set(
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
        .map((token) => token.slice(0, 5)),
    ),
  )
}

export function isSimilarContent(a: string, b: string) {
  const left = stems(a)
  const right = stems(b)
  if (left.length === 0 || right.length === 0) return false

  const shared = left.filter((token) => right.includes(token)).length
  return shared / Math.min(left.length, right.length) >= 0.6
}

export type OpenTask = { id: string; content: string; dueDate: string | null }

export async function findSimilarOpenTask(projet: Projet, content: string): Promise<OpenTask | null> {
  const { data } = await adminDb()
    .from('activities')
    .select('id, title, content, due_at')
    .eq('type', 'task')
    .is('completed_at', null)
    .eq('project_id', projet.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const match = (data ?? []).find((row: Record<string, string | null>) =>
    isSimilarContent(content, row.title || row.content || ''))

  return match ? { id: match.id as string, content: match.title || match.content || '', dueDate: match.due_at ?? null } : null
}

function resolveDueDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  const parsed = parseFrenchDate(value, new Date())
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.iso
}

// ── Écritures ─────────────────────────────────────────────────

export async function addNoteOrTask(input: {
  chatId: number
  sourceText: string
  projetId: string
  content: string
  dueDate?: string | null
  isTask: boolean
}): Promise<AppliedOperation> {
  const projet = await getProject(input.projetId)
  if (!projet) throw new Error('Projet introuvable')

  const dueDate = input.isTask ? resolveDueDate(input.dueDate) : null
  const suffix = dueDate ? ` — échéance ${formatFrenchDate(dueDate)}` : ''
  const summary = `${input.isTask ? 'Tâche' : 'Note'} — ${projetLabel(projet)}${suffix}`

  const payload: any = {
    type: input.isTask ? 'task' : 'note',
    title: input.isTask ? 'Tâche' : 'Note',
    content: input.content,
    due_at: dueDate ? `${dueDate}T09:00:00Z` : null,
    metadata: { source: 'telegram' },
    created_by: 'telegram',
    project_id: projet.id,
  }

  const { data, error } = await adminDb()
    .from('activities')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  const steps: UndoStep[] = [{ type: 'delete', table: 'activities', id: data.id as string }]

  if (input.isTask && projet.kind === 'achat') {
    const { data: before } = await adminDb()
      .from('projects')
      .select('next_action, due_date')
      .eq('id', projet.id)
      .maybeSingle()

    const { error: updateError } = await adminDb()
      .from('projects')
      .update({ next_action: input.content, due_date: dueDate })
      .eq('id', projet.id)

    if (!updateError) {
      steps.push({
        type: 'restore',
        table: 'projects',
        id: projet.id,
        values: { next_action: before?.next_action ?? null, due_date: before?.due_date ?? null },
      })
    }
  }

  return record({
    chatId: input.chatId,
    intent: input.isTask ? 'task' : 'note',
    summary,
    sourceText: input.sourceText,
    targetTable: 'activities',
    targetId: data.id as string,
    steps,
  })
}

export type ProjectInput = {
  chatId: number
  sourceText: string
  type: 'vente' | 'achat'
  name: string
  city?: string | null
  phone?: string | null
  email?: string | null
  propertyType?: string | null
  amount?: number | null
  note?: string | null
  contactId?: string | null
}

export async function createProject(input: ProjectInput): Promise<AppliedOperation> {
  const steps: UndoStep[] = []
  let contactId = input.contactId

  if (!contactId) {
    const [firstName, ...rest] = input.name.trim().split(/\s+/)
    const { data: contact, error: contactError } = await adminDb()
      .from('contacts')
      .insert({
        first_name: firstName ?? input.name,
        last_name: rest.join(' '),
        phone: input.phone ?? null,
        email: input.email ?? null,
        source: 'telegram'
      })
      .select('id')
      .single()

    if (contactError) throw new Error(contactError.message)
    contactId = contact.id as string
    steps.push({ type: 'delete', table: 'contacts', id: contactId })
  }

  const projectPayload: any = {
    kind: input.type,
    title: [input.name, input.city].filter(Boolean).join(' — '),
    stage: 'Nouveau contact',
    created_from: 'telegram',
  }

  if (input.type === 'vente') {
    projectPayload.property_city = input.city ?? null
    projectPayload.property_type = input.propertyType ?? null
    projectPayload.estimated_price_min = input.amount ?? null
    projectPayload.note = input.note ?? input.sourceText
    projectPayload.seller_name = input.name
    projectPayload.seller_phone = input.phone ?? null
    projectPayload.seller_email = input.email ?? null
  } else {
    projectPayload.communes = input.city ? [input.city] : null
    projectPayload.type_bien = input.propertyType ?? null
    projectPayload.budget_max = input.amount ?? null
  }

  const { data: project, error: projectError } = await adminDb()
    .from('projects')
    .insert(projectPayload)
    .select('id')
    .single()

  if (projectError) throw new Error(projectError.message)
  steps.push({ type: 'delete', table: 'projects', id: project.id as string })

  const { data: pc, error: pcError } = await adminDb()
    .from('project_contacts')
    .insert({
      contact_id: contactId,
      project_id: project.id,
      role: input.type === 'vente' ? 'Vendeur' : 'Acquéreur'
    })
    .select('id')
    .single()

  if (pcError) throw new Error(pcError.message)
  steps.push({ type: 'delete', table: 'project_contacts', id: pc.id as string })

  return record({
    chatId: input.chatId,
    intent: 'create_project',
    summary: `Nouveau projet (${input.type}) — ${[input.name, input.city].filter(Boolean).join(', ')}`,
    sourceText: input.sourceText,
    targetTable: 'projects',
    targetId: project.id as string,
    steps: steps.reverse(),
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

export async function updateTask(input: {
  chatId: number
  sourceText: string
  taskId: string
  content?: string | null
  dueDate?: string | null
  done?: boolean
}): Promise<AppliedOperation> {
  const dueDate = input.dueDate === undefined ? undefined : resolveDueDate(input.dueDate)
  const content = input.content?.trim() || undefined

  if (dueDate === undefined && content === undefined && input.done === undefined) {
    throw new Error('Rien à modifier : précise une échéance, un libellé ou le marquage « faite ».')
  }

  const { data: before } = await adminDb()
    .from('activities')
    .select('id, project_id, content, title, due_at, completed_at')
    .eq('id', input.taskId)
    .eq('type', 'task')
    .maybeSingle()

  if (!before) {
    throw new Error(
      "Tâche introuvable. Récupère son identifiant via lire_projet avant de la modifier — n'en crée pas une nouvelle.",
    )
  }

  const patch: Record<string, unknown> = {}
  if (dueDate !== undefined) patch.due_at = dueDate ? `${dueDate}T09:00:00Z` : null
  if (content !== undefined) patch.content = content
  if (input.done !== undefined) patch.completed_at = input.done ? new Date().toISOString() : null

  const { error } = await adminDb().from('activities').update(patch).eq('id', input.taskId)
  if (error) throw new Error(error.message)

  let projet: Projet | null = null
  if (before.project_id) {
    projet = await getProject(before.project_id as string)
  }

  const parts = [
    content !== undefined ? `libellé « ${content} »` : null,
    dueDate !== undefined ? (dueDate ? `échéance ${formatFrenchDate(dueDate)}` : 'échéance retirée') : null,
    input.done !== undefined ? (input.done ? 'marquée faite' : 'rouverte') : null,
  ].filter(Boolean)

  return record({
    chatId: input.chatId,
    intent: 'task_update',
    summary: `Tâche mise à jour — ${projet ? projetLabel(projet) : 'projet'} : ${parts.join(', ')}`,
    sourceText: input.sourceText,
    targetTable: 'activities',
    targetId: input.taskId,
    steps: [
      {
        type: 'restore',
        table: 'activities',
        id: input.taskId,
        values: {
          content: before.content ?? null,
          title: before.title ?? null,
          due_at: before.due_at ?? null,
          completed_at: before.completed_at ?? null,
        },
      },
    ],
  })
}

/**
 * Repository Phase B — accès typé aux tables prospects / leads / lead_events.
 *
 * Toutes les écritures passent par le client service_role (supabaseAdmin) :
 * RLS bypass automatique, jamais exposé au navigateur.
 *
 * Pattern `as never` sur les INSERT/UPDATE : tant que le générique `Database`
 * n'est pas pleinement câblé dans `createClient()`, le typage strict des
 * payloads se fait au niveau des fonctions du repo (paramètres et retours),
 * pas au niveau du builder Supabase.
 */
import { supabaseAdmin } from '@/lib/supabase'
import type {
  Database,
  LeadTool,
  LeadStatus,
  LeadEventKind,
  Json,
} from '@/types/supabase'

type ProspectRow = Database['public']['Tables']['prospects']['Row']
type LeadRow = Database['public']['Tables']['leads']['Row']
type LeadEventRow = Database['public']['Tables']['lead_events']['Row']

export type UpsertProspectInput = {
  email: string
  firstName?: string
  lastName?: string
  phone?: string | null
  /** ISO 8601, défaut now() côté DB. */
  rgpdConsentAt?: string
}

export type CreateLeadInput = {
  id?: string
  prospectId: string
  tool: LeadTool
  formData?: Record<string, unknown> | null
  results?: Record<string, unknown> | null
  commune?: string | null
  sourceChannel?: string | null
  priority?: string | null
  nextAction?: string | null
  dueDate?: string | null
  followUpAt?: string | null
  /** Override expiration ISO 8601. Défaut = now() + 30 jours côté DB. */
  magicLinkExpiresAt?: string
}

export type AppendEventInput = {
  leadId: string
  kind: LeadEventKind
  payload?: Record<string, unknown>
  /** Email de l'admin pour audit trail. */
  createdBy?: string | null
}

export type UpdateLeadStatusInput = {
  leadId: string
  status: LeadStatus
  changedBy?: string | null
}

export type LeadWithProspect = LeadRow & {
  prospect: Pick<
    ProspectRow,
    'id' | 'email' | 'first_name' | 'last_name' | 'phone'
  >
}

/**
 * Insère un nouveau prospect ou récupère le prospect existant si l'email
 * est déjà présent. Retourne la ligne (id + champs).
 *
 * Atomique grâce à `upsert(..., { onConflict: 'email' })`.
 */
export async function upsertProspect(
  input: UpsertProspectInput,
): Promise<ProspectRow> {
  const payload = {
    email: input.email,
    first_name: input.firstName ?? '',
    last_name: input.lastName ?? '',
    phone: input.phone ?? null,
    rgpd_consent_at: input.rgpdConsentAt ?? new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('prospects')
    .upsert(payload as never, {
      onConflict: 'email',
      ignoreDuplicates: false,
    })
    .select('*')
    .single()

  if (error) {
    throw new RepoError('upsertProspect', error.message, error)
  }
  if (!data) {
    throw new RepoError(
      'upsertProspect',
      'Aucune ligne retournée après upsert.',
    )
  }
  return data as ProspectRow
}

/**
 * Crée une nouvelle ligne `leads` reliée à un prospect.
 * L'`id` généré côté DB sert de token magic link.
 */
export async function createLead(input: CreateLeadInput): Promise<LeadRow> {
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    prospect_id: input.prospectId,
    tool: input.tool,
    form_data: (input.formData ?? {}) as Json,
    results: (input.results ?? {}) as Json,
    commune: input.commune ?? null,
    source_channel: input.sourceChannel ?? null,
    priority: input.priority ?? 'medium',
    next_action: input.nextAction ?? null,
    due_date: input.dueDate ?? null,
    follow_up_at: input.followUpAt ?? null,
    ...(input.magicLinkExpiresAt
      ? { magic_link_expires_at: input.magicLinkExpiresAt }
      : {}),
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert(payload as never)
    .select('*')
    .single()

  if (error) {
    throw new RepoError('createLead', error.message, error)
  }
  if (!data) {
    throw new RepoError('createLead', 'Aucune ligne retournée après insert.')
  }
  return data as LeadRow
}

/**
 * Récupère un lead par son id (= token magic link), avec les données prospect
 * jointes. Retourne null si le lead n'existe pas ou s'il est soft-deleted.
 */
export async function getLeadById(
  id: string,
): Promise<LeadWithProspect | null> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select(
      `
        *,
        prospect:prospects!leads_prospect_id_fkey (
          id,
          email,
          first_name,
          last_name,
          phone
        )
      `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new RepoError('getLeadById', error.message, error)
  }
  return (data as LeadWithProspect | null) ?? null
}

/**
 * Marque un lead avec un nouveau statut + log dans `lead_events`.
 * Effectue 2 requêtes séquentielles : update + insert event.
 * Pas atomique — si l'insert event échoue, le statut reste changé.
 * Acceptable pour le MVP. Step 11 pourra passer par un RPC Postgres.
 */
export async function updateLeadStatus(
  input: UpdateLeadStatusInput,
): Promise<LeadRow> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .update({ status: input.status } as never)
    .eq('id', input.leadId)
    .select('*')
    .single()

  if (error) {
    throw new RepoError('updateLeadStatus', error.message, error)
  }
  if (!data) {
    throw new RepoError(
      'updateLeadStatus',
      'Aucune ligne retournée après update.',
    )
  }

  await appendEvent({
    leadId: input.leadId,
    kind: 'status_change',
    payload: { status: input.status },
    createdBy: input.changedBy ?? null,
  })

  return data as LeadRow
}

/**
 * Ajoute un événement dans le journal d'audit du lead.
 */
export async function appendEvent(
  input: AppendEventInput,
): Promise<LeadEventRow> {
  const payload = {
    lead_id: input.leadId,
    kind: input.kind,
    payload: (input.payload ?? {}) as Json,
    created_by: input.createdBy ?? null,
  }

  const { data, error } = await supabaseAdmin
    .from('lead_events')
    .insert(payload as never)
    .select('*')
    .single()

  if (error) {
    throw new RepoError('appendEvent', error.message, error)
  }
  if (!data) {
    throw new RepoError('appendEvent', 'Aucune ligne retournée après insert.')
  }
  return data as LeadEventRow
}

/**
 * Marque la colonne `magic_link_sent_at` du lead comme envoyé maintenant.
 * Audit trail — utilisé par /api/leads (premier envoi) et la future action
 * "renvoyer le magic link" du dashboard admin.
 */
export async function markMagicLinkSent(leadId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('leads')
    .update({ magic_link_sent_at: new Date().toISOString() } as never)
    .eq('id', leadId)

  if (error) {
    throw new RepoError('markMagicLinkSent', error.message, error)
  }
}

/**
 * Erreur spécifique du repo, qui conserve la cause d'origine pour debug.
 */
export class RepoError extends Error {
  readonly fn: string
  readonly cause: unknown

  constructor(fn: string, message: string, cause?: unknown) {
    super(`[leads-repo:${fn}] ${message}`)
    this.name = 'RepoError'
    this.fn = fn
    this.cause = cause
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

type Opportunity = Pick<
  Database['public']['Tables']['opportunities']['Row'],
  'id' | 'title' | 'stage' | 'priority' | 'next_action' | 'due_date' | 'follow_up_at' | 'created_at' | 'updated_at'
>
type BuyerCriteria = Pick<
  Database['public']['Tables']['buyer_criteria']['Row'],
  | 'id'
  | 'lead_id'
  | 'type_bien'
  | 'communes'
  | 'budget_max'
  | 'surface_min'
  | 'pieces_min'
  | 'active'
  | 'stage'
  | 'next_action'
  | 'due_date'
  | 'matched_at'
  | 'created_at'
  | 'updated_at'
>
type OpportunityEvent = Pick<
  Database['public']['Tables']['opportunity_events']['Row'],
  'id' | 'opportunity_id' | 'type' | 'title' | 'content' | 'due_at' | 'completed_at' | 'created_at'
>
type ClientDossier = Pick<
  Database['public']['Tables']['client_dossiers']['Row'],
  'id' | 'title' | 'client_type' | 'status' | 'created_at' | 'updated_at'
>
type ClientDossierEvent = Pick<
  Database['public']['Tables']['client_dossier_events']['Row'],
  'id' | 'dossier_id' | 'type' | 'title' | 'description' | 'status' | 'event_date' | 'created_at'
>
type Lead = Pick<
  Database['public']['Tables']['leads']['Row'],
  'id' | 'tool' | 'status' | 'priority' | 'next_action' | 'due_date' | 'follow_up_at' | 'commune' | 'created_at'
>
type WarmContact = Pick<
  Database['public']['Tables']['warm_contacts']['Row'],
  'id' | 'full_name' | 'relation' | 'status' | 'follow_up_date' | 'created_at' | 'last_contacted_at'
>
type MarketProperty = Pick<
  Database['public']['Tables']['market_properties']['Row'],
  'id' | 'title' | 'city' | 'mandate_phase' | 'status' | 'created_at'
>

type DashboardActionSource =
  | 'opportunity'
  | 'buyer'
  | 'opportunity_event'
  | 'client_event'
  | 'lead'
  | 'warm_contact'

type DashboardAction = {
  id: string
  source: DashboardActionSource
  source_label: string
  title: string
  object_label: string
  due_date: string | null
  bucket: 'overdue' | 'today' | 'week' | 'later' | 'no_due'
  priority: string
  href: string
  can_complete: boolean
  can_postpone: boolean
  created_at: string | null
}

const SELLER_CLOSED_STAGES = new Set(['Mandat signé', 'Perdu / Écarté'])
const BUYER_CLOSED_STAGES = new Set(['Achat conclu', 'Pause / Perdu'])

export async function GET() {
  try {
    const [
      opportunitiesResult,
      buyersResult,
      opportunityEventsResult,
      clientsResult,
      clientEventsResult,
      leadsResult,
      warmContactsResult,
      propertiesResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('opportunities')
        .select('id,title,stage,priority,next_action,due_date,follow_up_at,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('buyer_criteria')
        .select('id,lead_id,type_bien,communes,budget_max,surface_min,pieces_min,active,stage,next_action,due_date,matched_at,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('opportunity_events')
        .select('id,opportunity_id,type,title,content,due_at,completed_at,created_at')
        .is('completed_at', null)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(500),
      supabaseAdmin
        .from('client_dossiers')
        .select('id,title,client_type,status,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('client_dossier_events')
        .select('id,dossier_id,type,title,description,status,event_date,created_at')
        .in('status', ['todo', 'blocked'])
        .order('event_date', { ascending: true, nullsFirst: false })
        .limit(500),
      supabaseAdmin
        .from('leads')
        .select('id,tool,status,priority,next_action,due_date,follow_up_at,commune,created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('warm_contacts')
        .select('id,full_name,relation,status,follow_up_date,created_at,last_contacted_at')
        .order('follow_up_date', { ascending: true, nullsFirst: false })
        .limit(500),
      supabaseAdmin
        .from('market_properties')
        .select('id,title,city,mandate_phase,status,created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    const opportunities = dataOrEmpty<Opportunity>(opportunitiesResult)
    const buyers = dataOrEmpty<BuyerCriteria>(buyersResult)
    const opportunityEvents = dataOrEmpty<OpportunityEvent>(opportunityEventsResult)
    const clientDossiers = dataOrEmpty<ClientDossier>(clientsResult)
    const clientEvents = dataOrEmpty<ClientDossierEvent>(clientEventsResult)
    const leads = dataOrEmpty<Lead>(leadsResult)
    const warmContacts = dataOrEmpty<WarmContact>(warmContactsResult)
    const marketProperties = dataOrEmpty<MarketProperty>(propertiesResult)

    const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]))
    const dossierById = new Map(clientDossiers.map((dossier) => [dossier.id, dossier]))

    const actions = [
      ...opportunities
        .filter((opportunity) => Boolean(opportunity.next_action))
        .map((opportunity) => actionFromOpportunity(opportunity)),
      ...buyers
        .filter((buyer) => Boolean(buyer.next_action))
        .map((buyer) => actionFromBuyer(buyer)),
      ...opportunityEvents
        .filter((event) => Boolean(event.due_at))
        .map((event) => actionFromOpportunityEvent(event, opportunityById.get(event.opportunity_id))),
      ...clientEvents.map((event) => actionFromClientEvent(event, dossierById.get(event.dossier_id))),
      ...leads
        .filter((lead) => Boolean(lead.next_action))
        .map((lead) => actionFromLead(lead)),
      ...warmContacts
        .filter((contact) => contact.status !== 'termine' && Boolean(contact.follow_up_date))
        .map((contact) => actionFromWarmContact(contact)),
    ].sort(compareActions)

    const activeSellerOpportunities = opportunities.filter((opportunity) => !SELLER_CLOSED_STAGES.has(opportunity.stage))
    const activeBuyers = buyers.filter((buyer) => buyer.active && !BUYER_CLOSED_STAGES.has(buyer.stage))
    const signedMandates =
      opportunities.filter((opportunity) => opportunity.stage === 'Mandat signé').length +
      buyers.filter((buyer) => buyer.stage === 'Mandat de recherche signé').length
    const dueActions = actions.filter((action) => action.bucket === 'overdue' || action.bucket === 'today')
    const hotProperties = marketProperties.filter((property) => ['hot', 'golden'].includes(property.mandate_phase ?? ''))
    const networkToRelaunch = warmContacts.filter((contact) => {
      if (contact.status === 'termine' || !contact.follow_up_date) return false
      return bucketFor(contact.follow_up_date) === 'overdue' || bucketFor(contact.follow_up_date) === 'today'
    })

    const datedActions = actions.filter((action) => action.due_date)
    const overdueActions = actions.filter((action) => action.bucket === 'overdue')

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      kpis: {
        actions_due: dueActions.length,
        opportunities_active: activeSellerOpportunities.length + activeBuyers.length,
        signed_mandates: signedMandates,
        network_to_relaunch: networkToRelaunch.length,
        hot_properties: hotProperties.length,
      },
      actions: actions.slice(0, 80),
      pipeline: {
        sellers: countBy(opportunities, (opportunity) => opportunity.stage || 'Sans statut'),
        buyers: countBy(buyers, (buyer) => buyer.stage || 'Sans statut'),
      },
      activity_30d: buildActivity30d(opportunities, buyers, actions),
      quality: {
        overdue_rate: datedActions.length > 0 ? Math.round((overdueActions.length / datedActions.length) * 100) : 0,
        actions_without_due_date: actions.filter((action) => action.bucket === 'no_due').length,
        opportunities_without_next_action:
          activeSellerOpportunities.filter((opportunity) => !opportunity.next_action).length +
          activeBuyers.filter((buyer) => !buyer.next_action).length,
        network_to_relaunch: networkToRelaunch.length,
      },
    })
  } catch (e) {
    console.error('[API /market/dashboard]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function dataOrEmpty<T>(result: { data: unknown; error: unknown }): T[] {
  if (result.error) return []
  return Array.isArray(result.data) ? (result.data as T[]) : []
}

function actionFromOpportunity(opportunity: Opportunity): DashboardAction {
  const dueDate = opportunity.due_date ?? opportunity.follow_up_at
  return {
    id: opportunity.id,
    source: 'opportunity',
    source_label: 'Opportunité vendeur',
    title: opportunity.next_action ?? 'Action opportunité',
    object_label: opportunity.title,
    due_date: dueDate,
    bucket: bucketFor(dueDate),
    priority: opportunity.priority || 'normal',
    href: `/app/opportunities/${opportunity.id}`,
    can_complete: false,
    can_postpone: true,
    created_at: opportunity.created_at,
  }
}

function actionFromBuyer(buyer: BuyerCriteria): DashboardAction {
  const objectLabel = [
    buyer.type_bien ?? 'Recherche acquéreur',
    buyer.communes?.slice(0, 2).join(', '),
    buyer.budget_max ? formatCompactEuro(buyer.budget_max) : null,
  ].filter(Boolean).join(' · ')

  return {
    id: buyer.lead_id,
    source: 'buyer',
    source_label: 'Opportunité acquéreur',
    title: buyer.next_action ?? 'Action acquéreur',
    object_label: objectLabel || 'Recherche acquéreur',
    due_date: buyer.due_date,
    bucket: bucketFor(buyer.due_date),
    priority: buyer.active ? 'active' : 'pause',
    href: `/app/acheteurs/${buyer.lead_id}`,
    can_complete: false,
    can_postpone: true,
    created_at: buyer.created_at,
  }
}

function actionFromOpportunityEvent(event: OpportunityEvent, opportunity?: Opportunity): DashboardAction {
  return {
    id: event.id,
    source: 'opportunity_event',
    source_label: 'Timeline vendeur',
    title: event.title ?? event.content ?? 'Activité à réaliser',
    object_label: opportunity?.title ?? 'Opportunité vendeur',
    due_date: event.due_at,
    bucket: bucketFor(event.due_at),
    priority: event.type,
    href: opportunity ? `/app/opportunities/${opportunity.id}` : '/app/opportunities',
    can_complete: true,
    can_postpone: true,
    created_at: event.created_at,
  }
}

function actionFromClientEvent(event: ClientDossierEvent, dossier?: ClientDossier): DashboardAction {
  return {
    id: event.id,
    source: 'client_event',
    source_label: dossier?.client_type === 'buyer' ? 'Client acquéreur' : 'Client vendeur',
    title: event.title || event.description || 'Jalon client',
    object_label: dossier?.title ?? 'Dossier client',
    due_date: event.event_date,
    bucket: bucketFor(event.event_date),
    priority: event.status === 'blocked' ? 'bloqué' : event.type,
    href: dossier ? `/app/clients/${dossier.id}` : '/app/clients',
    can_complete: true,
    can_postpone: true,
    created_at: event.created_at,
  }
}

function actionFromLead(lead: Lead): DashboardAction {
  const dueDate = lead.due_date ?? lead.follow_up_at
  return {
    id: lead.id,
    source: 'lead',
    source_label: 'Contact',
    title: lead.next_action ?? 'Relancer le contact',
    object_label: lead.commune ? `${lead.tool} · ${lead.commune}` : lead.tool,
    due_date: dueDate,
    bucket: bucketFor(dueDate),
    priority: lead.priority || lead.status,
    href: `/app/leads/${lead.id}`,
    can_complete: false,
    can_postpone: true,
    created_at: lead.created_at,
  }
}

function actionFromWarmContact(contact: WarmContact): DashboardAction {
  return {
    id: contact.id,
    source: 'warm_contact',
    source_label: 'Réseau',
    title: 'Relancer le contact réseau',
    object_label: contact.relation ? `${contact.full_name} · ${contact.relation}` : contact.full_name,
    due_date: contact.follow_up_date,
    bucket: bucketFor(contact.follow_up_date),
    priority: contact.status,
    href: `/app/liste-chaude/${contact.id}`,
    can_complete: true,
    can_postpone: true,
    created_at: contact.created_at,
  }
}

function bucketFor(value: string | null | undefined): DashboardAction['bucket'] {
  if (!value) return 'no_due'
  const date = startOfDay(new Date(value))
  if (Number.isNaN(date.getTime())) return 'no_due'
  const today = startOfDay(new Date())
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'later'
}

function compareActions(a: DashboardAction, b: DashboardAction) {
  const bucketOrder: Record<DashboardAction['bucket'], number> = {
    overdue: 0,
    today: 1,
    week: 2,
    later: 3,
    no_due: 4,
  }
  const bucketDiff = bucketOrder[a.bucket] - bucketOrder[b.bucket]
  if (bucketDiff !== 0) return bucketDiff
  const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
  const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
  return aTime - bTime
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      const key = getKey(item)
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  ).map(([name, value]) => ({ name, value }))
}

function buildActivity30d(opportunities: Opportunity[], buyers: BuyerCriteria[], actions: DashboardAction[]) {
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = startOfDay(new Date())
    date.setDate(date.getDate() - (29 - index))
    const key = toDateKey(date)
    return { date: key, label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), opportunities: 0, actions: 0 }
  })
  const byDate = new Map(days.map((day) => [day.date, day]))

  for (const item of [...opportunities, ...buyers]) {
    const key = toDateKey(new Date(item.created_at))
    const day = byDate.get(key)
    if (day) day.opportunities += 1
  }
  for (const action of actions) {
    const key = toDateKey(new Date(action.due_date ?? action.created_at ?? ''))
    const day = byDate.get(key)
    if (day) day.actions += 1
  }

  return days
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDateKey(date: Date) {
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatCompactEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(value)
}

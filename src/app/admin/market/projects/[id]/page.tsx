'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  Building2,
  Calculator,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,

  Clock,
  Copy,
  Edit,
  ExternalLink,
  FileCheck,
  FileSignature,
  FileText,
  FolderOpen,
  Globe,
  History,
  Home,
  LayoutDashboard,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  PenTool,
  Phone,
  Plus,
  Rocket,
  Ruler,
  Save,
  Scale,
  Search,
  Sparkles,
  StickyNote,
  Target,
  Trash2,
  Trees,
  TrendingUp,

  UserPlus,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react'

import { toast } from 'sonner'
import { DeadlineCalendar, LiquidTemplateEditor, MandateActionsPanel, MandateFilePanel, ProjectContactDialog, PropertyRisksPanel, SaleContextPanel, StatusPill, ToggleChip, type DeadlineItem } from '@/components/pro'
import type { BonDeVisite } from '@/lib/bon-de-visite/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_RDV_TEMPLATES,
  MEETING_TYPES,
  parseRdvTemplates,
  renderLiquidTemplate,
  roundToNext5Minutes,
  type RdvTemplatesMap,
} from '@/lib/rdv-templates'



import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ADMIN_INPUT_CLASS = 'h-10 rounded-xl px-3 text-xs font-semibold'
const ADMIN_TEXTAREA_CLASS = 'rounded-xl p-3 text-xs font-semibold'

import { cn } from '@/lib/utils'
import { DossierWorkspace } from '../../clients/DossierWorkspace'
import { buildProjectTitle } from '@/lib/project-stages'
import { isPortalEligibleStage } from '@/lib/market/seller-stages'
import type { ActivityType } from '@/types/supabase'

type Priority = 'low' | 'medium' | 'high' | 'critical'

interface OpportunityEvent {
  id: string
  opportunity_id: string
  type: ActivityType
  title: string | null
  content: string | null
  due_at: string | null
  occurred_at: string
  completed_at: string | null
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

interface Opportunity {
  id: string
  lead_id: string | null
  market_property_id: string | null
  title: string | null
  description: string | null
  stage: string | null
  priority: string | null
  next_action: string | null
  due_date: string | null
  note: string | null
  seller_name: string | null
  seller_phone: string | null
  seller_email: string | null
  source_channel: string | null
  property_address: string | null
  property_city: string | null
  property_type: string | null
  project_contacts?: any[]
  display_title?: string | null
  estimated_price_min: number | null
  estimated_price_max: number | null
  selling_timeline: string | null
  pre_estimation_done_at: string | null
  visit_at: string | null
  report_delivered_at: string | null
  follow_up_at: string | null
  property_snapshot: Record<string, unknown>
  professional_opinion: Record<string, unknown>
  created_at: string
  updated_at: string
  lead: LeadInfo | null
  property: PropertyInfo | null
  events: OpportunityEvent[]
  client_dossier: ClientDossierLink | null
  latest_pending_estimation_import: PendingEstimationImport | null
}

interface PendingEstimationImport {
  id: string
  kind: string
  source: string
  price_low: number | null
  price_high: number | null
  price_m2: number | null
  confidence: number | null
  summary: string | null
  created_at: string
  payload: Record<string, unknown>
}

interface ClientDossierLink {
  id: string
  public_token: string
  status: string
  documents_total: number
  documents_validated: number
  documents_missing: number
}

interface LeadInfo {
  id: string
  commune: string | null
  source_channel: string | null
  priority: string | null
  next_action: string | null
  due_date: string | null
  follow_up_at: string | null
  prospect: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
  } | null
  seller_property: {
    adresse: string | null
    type_bien: string | null
    surface: number | null
    surface_terrain: number | null
    nb_pieces: number | null
    delai: string | null
    prix_estime: number | null
  } | null
}

interface PropertyInfo {
  id: string
  external_id: string | null
  title: string | null
  description: string | null
  price: number | null
  surface: number | null
  land_surface: number | null
  rooms: number | null
  bedrooms: number | null
  price_per_m2: number | null
  city: string | null
  zipcode: string | null
  property_type: string | null
  status: string | null
  source: string | null
  url: string | null
  seller_type: string | null
  published_at: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  thumbnail_url: string | null
}

interface PropertySearchRow extends PropertyInfo {
  opportunity?: { id: string; title: string; stage: string | null; priority: string | null } | null
}

interface LeadSearchRow {
  id: string
  commune: string | null
  source_channel: string | null
  priority: Priority
  next_action: string | null
  prospect: {
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
  }
  seller_property: {
    type_bien: string | null
    surface: number | null
    prix_estime: number | null
  } | null
  opportunity: { id: string; title: string; stage: string | null } | null
}





interface EventDraft {
  type: ActivityType
  title: string
  content: string
  due_at: string
  occurred_at: string
  milestone: string
  meeting_type?: string
  send_sms_reminder?: boolean
  sms_reminder_hours?: number
  sms_body?: string
}



interface PropertyDraft {
  mandate_number: string
  mandate_type: string
  type_bien: string
  adresse: string
  commune: string
  surface: string
  surface_terrain: string
  nb_pieces: string
  dpe: string
  etat: string
  equipements: string
  contexte: string
  points_vigilance: string
}

interface ProfessionalDraft {
  price: string
  price_low: string
  price_high: string
  summary: string
  arguments: string
  comparables_json: string
  report_title: string
  report_subtitle: string
  report_date: string
  report_reference: string
  report_recipient: string
  report_context: string
  advisor_name: string
  advisor_phone: string
  advisor_email: string
  situation_commune: string
  situation_plan_note: string
  cadastral_rows_json: string
  cadastral_total: string
  property_presentation_title: string
  property_stats_json: string
  strengths: string
  objections: string
  market_basis: string
  market_price_per_sqm_low: string
  market_price_per_sqm_median: string
  market_price_per_sqm_high: string
  market_price_filter: string
  market_evolution_json: string
  sale_delay_fast: string
  sale_delay_median: string
  sale_delay_slow: string
  competition_criteria: string
  competition_methodology: string
  competition_retained_count: string
  active_average_price: string
  active_average_price_per_sqm: string
  sold_average_price: string
  sold_average_price_per_sqm: string
  comparables_summary_average_per_sqm: string
  comparables_summary_low_per_sqm: string
  comparables_summary_high_per_sqm: string
  positioning_reference_price: string
  positioning_reference_price_per_sqm: string
  positioning_cheaper_percent: string
  positioning_larger_percent: string
  positioning_cheaper_larger_percent: string
  positioning_competition_average_per_sqm: string
  positioning_low_per_sqm: string
  positioning_median_per_sqm: string
  positioning_high_per_sqm: string
  positioning_rank: string
  positioning_rank_total: string
  positioning_threshold_low_price: string
  positioning_threshold_median_price: string
  positioning_threshold_high_price: string
  recommendations: string
  conclusion_text: string
  legal_notice: string
  iad_sold_properties_json: string
  client_reviews_json: string
  iad_advantages: string
  iad_services: string
  socio_economic_json: string
  market_distribution_json: string
  market_trend_json: string
  market_tension_json: string
  comparables_competing_json: string
  comparables_unsold_json: string
  positioning_extended_json: string
  synthesis_json: string
  track_record_json: string
}

const STAGES = [
  'Nouveau contact',
  "Visite d'estimation",
  "Remise de l'estimation",
  'Mandat signé',
  'Commercialisation & Visites',
  'Compromis signé',
  'Vendu',
]

function getStageTheme(stageName: string) {
  switch (stageName) {
    case 'Nouveau contact':
      return { icon: UserPlus, colorClass: 'border-blue-500/30 bg-blue-500/10 text-blue-600' }
    case "Visite d'estimation":
      return { icon: Home, colorClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600' }
    case "Remise de l'estimation":
      return { icon: BarChart3, colorClass: 'border-purple-500/30 bg-purple-500/10 text-purple-600' }
    case 'Mandat signé':
      return { icon: PenTool, colorClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 font-bold' }
    case 'Commercialisation & Visites':
      return { icon: Rocket, colorClass: 'border-sky-500/30 bg-sky-500/10 text-sky-600 font-bold' }
    case 'Compromis signé':
      return { icon: FileCheck, colorClass: 'border-teal-500/30 bg-teal-500/10 text-teal-600 font-bold' }
    case 'Vendu':
      return { icon: Sparkles, colorClass: 'border-emerald-600/40 bg-emerald-600/15 text-emerald-700 font-bold' }
    case 'Perdu / Écarté':
      return { icon: AlertCircle, colorClass: 'border-rose-500/30 bg-rose-500/10 text-rose-600' }
    default:
      return { icon: Rocket, colorClass: 'border-primary/30 bg-primary/10 text-primary' }
  }
}

const CLIENT_DOSSIER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

const EVENT_CONFIG: Record<ActivityType, { label: string; icon: typeof StickyNote; className: string }> = {
  note: { label: 'Note', icon: StickyNote, className: 'bg-slate-50 text-slate-700 border-slate-200' },
  task: { label: 'Tâche', icon: CheckCircle2, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  call: { label: 'Appel', icon: Phone, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  meeting: { label: 'Rendez-vous', icon: Calendar, className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },

  email: { label: 'Email', icon: Mail, className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  stage_change: { label: 'Étape', icon: ChevronDown, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  estimation: { label: 'Estimation', icon: Building2, className: 'bg-purple-50 text-purple-700 border-purple-200' },
  system: { label: 'Système', icon: MoreHorizontal, className: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const PROPERTY_TYPES = [
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'autre', label: 'Autre' },
]

const ESTIMATION_MILESTONES = [
  { value: 'estimation_done', label: 'Estimation réalisée' },
]

const EMPTY_PROPERTY_DRAFT: PropertyDraft = {
  mandate_number: '',
  mandate_type: '',
  type_bien: '',
  adresse: '',
  commune: '',
  surface: '',
  surface_terrain: '',
  nb_pieces: '',
  dpe: '',
  etat: '',
  equipements: '',
  contexte: '',
  points_vigilance: '',
}

const EMPTY_PROFESSIONAL_DRAFT: ProfessionalDraft = {
  price: '',
  price_low: '',
  price_high: '',
  summary: '',
  arguments: '',
  comparables_json: '[]',
  report_title: '',
  report_subtitle: '',
  report_date: '',
  report_reference: '',
  report_recipient: '',
  report_context: '',
  advisor_name: '',
  advisor_phone: '',
  advisor_email: '',
  situation_commune: '',
  situation_plan_note: '',
  cadastral_rows_json: '[]',
  cadastral_total: '',
  property_presentation_title: '',
  property_stats_json: '[]',
  strengths: '',
  objections: '',
  market_basis: '',
  market_price_per_sqm_low: '',
  market_price_per_sqm_median: '',
  market_price_per_sqm_high: '',
  market_price_filter: '',
  market_evolution_json: '[]',
  sale_delay_fast: '',
  sale_delay_median: '',
  sale_delay_slow: '',
  competition_criteria: '',
  competition_methodology: '',
  competition_retained_count: '',
  active_average_price: '',
  active_average_price_per_sqm: '',
  sold_average_price: '',
  sold_average_price_per_sqm: '',
  comparables_summary_average_per_sqm: '',
  comparables_summary_low_per_sqm: '',
  comparables_summary_high_per_sqm: '',
  positioning_reference_price: '',
  positioning_reference_price_per_sqm: '',
  positioning_cheaper_percent: '',
  positioning_larger_percent: '',
  positioning_cheaper_larger_percent: '',
  positioning_competition_average_per_sqm: '',
  positioning_low_per_sqm: '',
  positioning_median_per_sqm: '',
  positioning_high_per_sqm: '',
  positioning_rank: '',
  positioning_rank_total: '',
  positioning_threshold_low_price: '',
  positioning_threshold_median_price: '',
  positioning_threshold_high_price: '',
  recommendations: '',
  conclusion_text: '',
  legal_notice: '',
  iad_sold_properties_json: '[]',
  client_reviews_json: '[]',
  iad_advantages: '',
  iad_services: '',
  socio_economic_json: '{}',
  market_distribution_json: '{}',
  market_trend_json: '{}',
  market_tension_json: '{}',
  comparables_competing_json: '[]',
  comparables_unsold_json: '[]',
  positioning_extended_json: '{}',
  synthesis_json: '{}',
  track_record_json: '[]',
}

function emptyEventDraft(type: ActivityType): EventDraft {
  const roundedNow = roundToNext5Minutes()
  const defaultTpl = DEFAULT_RDV_TEMPLATES['rendez_vous_r1']
  return {
    type,
    title: type === 'task' ? 'Nouvelle tâche' : type === 'meeting' ? defaultTpl.title : '',
    content: '',
    due_at: '',
    occurred_at: roundedNow,
    milestone: 'pre_estimation',
    meeting_type: 'rendez_vous_r1',
    send_sms_reminder: true,
    sms_reminder_hours: defaultTpl.sms_reminder_hours ?? 24,
    sms_body: defaultTpl.sms_template,
  }
}





function leadName(lead: LeadInfo | null) {
  const name = [lead?.prospect?.first_name, lead?.prospect?.last_name].filter(Boolean).join(' ').trim()
  return name || 'Contact vendeur'
}

function leadOptionName(lead: LeadSearchRow) {
  return [lead.prospect.first_name, lead.prospect.last_name].filter(Boolean).join(' ').trim() || 'Contact vendeur'
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('fr-FR').format(value)}${suffix}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Horodatage complet `dd/mm/yyyy hh:mm`, pour tracer l'historique du journal. */
function formatStamp(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isClientPortalEstimationPublished(opportunity: Opportunity | null) {
  return asRecord(opportunity?.professional_opinion).client_portal_published === true
}

/** Date d'échéance : sert à ordonner ce qui est *à venir*. */
function eventDate(event: OpportunityEvent) {
  return event.due_at ?? event.occurred_at ?? event.created_at
}

/**
 * Date de saisie : sert à ordonner le journal, du plus récent au plus ancien.
 * On ne passe jamais par `due_at`, sinon une tâche datée dans le futur
 * remonterait en tête alors qu'elle a été saisie il y a longtemps.
 */
function eventRecency(event: OpportunityEvent) {
  return event.created_at ?? event.occurred_at
}

function isUserEditableProperty(property: PropertyInfo | null) {
  return property?.source === 'manual' || property?.source === 'user'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringify(value: unknown) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(stringify).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return value.split('\n').map((line) => line.trim()).filter(Boolean)
  return []
}

function nullableNumber(value: string) {
  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null
}

function parseComparables(value: string) {
  if (!value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    toast.error('JSON comparables invalide, les comparables ne sont pas sauvegardés')
    return []
  }
}

function parseJsonArray(value: string, label: string) {
  if (!value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
    toast.error(`${label} doit être un tableau JSON`)
    return []
  } catch {
    toast.error(`${label} JSON invalide`)
    return []
  }
}

function jsonArrayString(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2)
}

function parseJsonObject(value: string, label: string) {
  if (!value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    toast.error(`${label} doit être un objet JSON`)
    return {}
  } catch {
    toast.error(`${label} JSON invalide`)
    return {}
  }
}

function jsonObjectString(value: unknown) {
  return JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? value : {}, null, 2)
}

function propertyDraftFromOpportunity(opportunity: Opportunity): PropertyDraft {
  const snapshot = asRecord(opportunity.property_snapshot)
  const leadProperty = opportunity.lead?.seller_property
  return {
    mandate_number: stringify(snapshot.mandate_number),
    mandate_type: stringify(snapshot.mandate_type),
    type_bien: stringify(snapshot.type_bien ?? leadProperty?.type_bien ?? opportunity.property_type ?? opportunity.property?.property_type),
    adresse: stringify(snapshot.adresse ?? leadProperty?.adresse ?? opportunity.property?.title),
    commune: stringify(snapshot.commune ?? opportunity.property_city ?? opportunity.lead?.commune ?? opportunity.property?.city),
    surface: stringify(snapshot.surface ?? leadProperty?.surface ?? opportunity.property?.surface),
    surface_terrain: stringify(snapshot.surface_terrain ?? leadProperty?.surface_terrain ?? opportunity.property?.land_surface),
    nb_pieces: stringify(snapshot.nb_pieces ?? leadProperty?.nb_pieces ?? opportunity.property?.rooms),
    dpe: stringify(snapshot.dpe),
    etat: stringify(snapshot.etat),
    equipements: stringify(snapshot.equipements),
    contexte: stringify(snapshot.contexte ?? opportunity.selling_timeline),
    points_vigilance: stringify(snapshot.points_vigilance),
  }
}

function professionalDraftFromOpportunity(opportunity: Opportunity): ProfessionalDraft {
  const opinion = asRecord(opportunity.professional_opinion)
  const report = asRecord(opinion.iad_report)
  const cover = asRecord(report.cover)
  const advisor = asRecord(report.advisor)
  const situation = asRecord(report.situation)
  const property = asRecord(report.property)
  const market = asRecord(report.market)
  const competition = asRecord(report.competition)
  const comparables = asRecord(report.comparables)
  const positioning = asRecord(report.positioning)
  const conclusion = asRecord(report.conclusion)
  const iadProof = asRecord(report.iad_proof)
  const services = asRecord(report.services)
  return {
    price: stringify(opinion.price ?? opinion.price_suggested ?? opportunity.estimated_price_min),
    price_low: stringify(opinion.price_low ?? opportunity.estimated_price_min),
    price_high: stringify(opinion.price_high ?? opportunity.estimated_price_max),
    summary: stringify(opinion.summary),
    arguments: Array.isArray(opinion.arguments) ? opinion.arguments.map(stringify).filter(Boolean).join('\n') : stringify(opinion.arguments),
    comparables_json: JSON.stringify(Array.isArray(opinion.comparables) ? opinion.comparables : [], null, 2),
    report_title: stringify(cover.title),
    report_subtitle: stringify(cover.subtitle),
    report_date: stringify(cover.date),
    report_reference: stringify(cover.reference),
    report_recipient: stringify(cover.recipient),
    report_context: stringify(cover.context),
    advisor_name: stringify(advisor.name),
    advisor_phone: stringify(advisor.phone),
    advisor_email: stringify(advisor.email),
    situation_commune: stringify(situation.commune),
    situation_plan_note: stringify(situation.plan_note),
    cadastral_rows_json: jsonArrayString(situation.cadastral_rows),
    cadastral_total: stringify(situation.cadastral_total),
    property_presentation_title: stringify(property.title),
    property_stats_json: jsonArrayString(property.stats),
    strengths: listValue(property.strengths).join('\n'),
    objections: listValue(property.objections).join('\n'),
    market_basis: stringify(market.basis),
    market_price_per_sqm_low: stringify(market.price_per_sqm_low),
    market_price_per_sqm_median: stringify(market.price_per_sqm_median),
    market_price_per_sqm_high: stringify(market.price_per_sqm_high),
    market_price_filter: stringify(market.price_filter),
    market_evolution_json: jsonArrayString(market.evolution),
    sale_delay_fast: stringify(market.sale_delay_fast),
    sale_delay_median: stringify(market.sale_delay_median),
    sale_delay_slow: stringify(market.sale_delay_slow),
    competition_criteria: listValue(competition.criteria).join('\n'),
    competition_methodology: stringify(competition.methodology),
    competition_retained_count: stringify(competition.retained_count),
    active_average_price: stringify(competition.active_average_price),
    active_average_price_per_sqm: stringify(competition.active_average_price_per_sqm),
    sold_average_price: stringify(competition.sold_average_price),
    sold_average_price_per_sqm: stringify(competition.sold_average_price_per_sqm),
    comparables_summary_average_per_sqm: stringify(comparables.average_per_sqm),
    comparables_summary_low_per_sqm: stringify(comparables.low_per_sqm),
    comparables_summary_high_per_sqm: stringify(comparables.high_per_sqm),
    positioning_reference_price: stringify(positioning.reference_price),
    positioning_reference_price_per_sqm: stringify(positioning.reference_price_per_sqm),
    positioning_cheaper_percent: stringify(positioning.cheaper_percent),
    positioning_larger_percent: stringify(positioning.larger_percent),
    positioning_cheaper_larger_percent: stringify(positioning.cheaper_larger_percent),
    positioning_competition_average_per_sqm: stringify(positioning.competition_average_per_sqm),
    positioning_low_per_sqm: stringify(positioning.low_per_sqm),
    positioning_median_per_sqm: stringify(positioning.median_per_sqm),
    positioning_high_per_sqm: stringify(positioning.high_per_sqm),
    positioning_rank: stringify(positioning.rank),
    positioning_rank_total: stringify(positioning.rank_total),
    positioning_threshold_low_price: stringify(positioning.threshold_low_price),
    positioning_threshold_median_price: stringify(positioning.threshold_median_price),
    positioning_threshold_high_price: stringify(positioning.threshold_high_price),
    recommendations: listValue(conclusion.recommendations).join('\n'),
    conclusion_text: stringify(conclusion.text),
    legal_notice: stringify(conclusion.legal_notice),
    iad_sold_properties_json: jsonArrayString(iadProof.sold_properties),
    client_reviews_json: jsonArrayString(iadProof.client_reviews),
    iad_advantages: listValue(services.advantages).join('\n'),
    iad_services: listValue(services.services).join('\n'),
    socio_economic_json: jsonObjectString(report.socio_economic),
    market_distribution_json: jsonObjectString(market.distribution),
    market_trend_json: jsonObjectString(market.trend),
    market_tension_json: jsonObjectString(market.tension),
    comparables_competing_json: jsonArrayString(comparables.competing),
    comparables_unsold_json: jsonArrayString(comparables.unsold),
    positioning_extended_json: jsonObjectString({
      price_per_sqm_rank: positioning.price_per_sqm_rank,
      total_competitors: positioning.total_competitors,
      cheaper_and_larger_percent: positioning.cheaper_and_larger_percent,
      thresholds: positioning.thresholds,
      average_competitor_price_per_sqm: positioning.average_competitor_price_per_sqm,
    }),
    synthesis_json: jsonObjectString(report.synthesis),
    track_record_json: jsonArrayString(report.track_record),
  }
}

function normalizePropertyDraft(draft: PropertyDraft) {
  return {
    mandate_number: draft.mandate_number.trim() || null,
    mandate_type: draft.mandate_type.trim() || null,
    type_bien: draft.type_bien.trim() || null,
    type_label: draft.type_bien.trim() || null,
    adresse: draft.adresse.trim() || null,
    commune: draft.commune.trim() || null,
    surface: nullableNumber(draft.surface),
    surface_terrain: nullableNumber(draft.surface_terrain),
    nb_pieces: nullableNumber(draft.nb_pieces),
    dpe: draft.dpe.trim() || null,
    etat: draft.etat.trim() || null,
    equipements: draft.equipements.trim() || null,
    contexte: draft.contexte.trim() || null,
    points_vigilance: draft.points_vigilance.trim() || null,
  }
}

function normalizeProfessionalDraft(draft: ProfessionalDraft) {
  const comparables = parseComparables(draft.comparables_json)
  const argumentsList = draft.arguments.split('\n').map((line) => line.trim()).filter(Boolean)
  const recommendations = draft.recommendations.split('\n').map((line) => line.trim()).filter(Boolean)
  const trackRecord = parseJsonArray(draft.track_record_json, 'Biens vendus par iad')
  return {
    price: nullableNumber(draft.price),
    price_suggested: nullableNumber(draft.price),
    price_low: nullableNumber(draft.price_low),
    price_high: nullableNumber(draft.price_high),
    summary: draft.summary.trim() || null,
    arguments: argumentsList,
    comparables,
    iad_report: {
      cover: {
        title: draft.report_title.trim() || null,
        subtitle: draft.report_subtitle.trim() || null,
        date: draft.report_date.trim() || null,
        reference: draft.report_reference.trim() || null,
        recipient: draft.report_recipient.trim() || null,
        context: draft.report_context.trim() || null,
      },
      advisor: {
        name: draft.advisor_name.trim() || null,
        phone: draft.advisor_phone.trim() || null,
        email: draft.advisor_email.trim() || null,
      },
      situation: {
        commune: draft.situation_commune.trim() || null,
        plan_note: draft.situation_plan_note.trim() || null,
        cadastral_rows: parseJsonArray(draft.cadastral_rows_json, 'Informations cadastrales'),
        cadastral_total: draft.cadastral_total.trim() || null,
      },
      property: {
        title: draft.property_presentation_title.trim() || null,
        stats: parseJsonArray(draft.property_stats_json, 'Caractéristiques du bien'),
        strengths: draft.strengths.split('\n').map((line) => line.trim()).filter(Boolean),
        objections: draft.objections.split('\n').map((line) => line.trim()).filter(Boolean),
      },
      market: {
        basis: draft.market_basis.trim() || null,
        price_per_sqm_low: nullableNumber(draft.market_price_per_sqm_low),
        price_per_sqm_median: nullableNumber(draft.market_price_per_sqm_median),
        price_per_sqm_high: nullableNumber(draft.market_price_per_sqm_high),
        price_filter: draft.market_price_filter.trim() || null,
        evolution: parseJsonArray(draft.market_evolution_json, 'Évolution du marché'),
        sale_delay_fast: nullableNumber(draft.sale_delay_fast),
        sale_delay_median: nullableNumber(draft.sale_delay_median),
        sale_delay_slow: nullableNumber(draft.sale_delay_slow),
        distribution: parseJsonObject(draft.market_distribution_json, 'Répartition du marché'),
        trend: parseJsonObject(draft.market_trend_json, 'Tendance du marché'),
        tension: parseJsonObject(draft.market_tension_json, 'Tension du marché'),
      },
      competition: {
        criteria: draft.competition_criteria.split('\n').map((line) => line.trim()).filter(Boolean),
        methodology: draft.competition_methodology.trim() || null,
        retained_count: nullableNumber(draft.competition_retained_count),
        active_average_price: nullableNumber(draft.active_average_price),
        active_average_price_per_sqm: nullableNumber(draft.active_average_price_per_sqm),
        sold_average_price: nullableNumber(draft.sold_average_price),
        sold_average_price_per_sqm: nullableNumber(draft.sold_average_price_per_sqm),
      },
      comparables: {
        sold: comparables,
        average_per_sqm: nullableNumber(draft.comparables_summary_average_per_sqm),
        low_per_sqm: nullableNumber(draft.comparables_summary_low_per_sqm),
        high_per_sqm: nullableNumber(draft.comparables_summary_high_per_sqm),
        competing: parseJsonArray(draft.comparables_competing_json, 'Biens en concurrence'),
        unsold: parseJsonArray(draft.comparables_unsold_json, 'Biens invendus'),
      },
      positioning: {
        reference_price: nullableNumber(draft.positioning_reference_price),
        reference_price_per_sqm: nullableNumber(draft.positioning_reference_price_per_sqm),
        cheaper_percent: nullableNumber(draft.positioning_cheaper_percent),
        larger_percent: nullableNumber(draft.positioning_larger_percent),
        cheaper_larger_percent: nullableNumber(draft.positioning_cheaper_larger_percent),
        competition_average_per_sqm: nullableNumber(draft.positioning_competition_average_per_sqm),
        low_per_sqm: nullableNumber(draft.positioning_low_per_sqm),
        median_per_sqm: nullableNumber(draft.positioning_median_per_sqm),
        high_per_sqm: nullableNumber(draft.positioning_high_per_sqm),
        rank: nullableNumber(draft.positioning_rank),
        rank_total: nullableNumber(draft.positioning_rank_total),
        threshold_low_price: nullableNumber(draft.positioning_threshold_low_price),
        threshold_median_price: nullableNumber(draft.positioning_threshold_median_price),
        threshold_high_price: nullableNumber(draft.positioning_threshold_high_price),
        ...parseJsonObject(draft.positioning_extended_json, 'Positionnement étendu'),
      },
      conclusion: {
        recommendations,
        text: draft.conclusion_text.trim() || null,
        legal_notice: draft.legal_notice.trim() || null,
      },
      iad_proof: {
        sold_properties: trackRecord.length > 0 ? trackRecord : parseJsonArray(draft.iad_sold_properties_json, 'Nos biens vendus'),
        client_reviews: parseJsonArray(draft.client_reviews_json, 'Avis clients'),
      },
      services: {
        advantages: draft.iad_advantages.split('\n').map((line) => line.trim()).filter(Boolean),
        services: draft.iad_services.split('\n').map((line) => line.trim()).filter(Boolean),
      },
      socio_economic: parseJsonObject(draft.socio_economic_json, 'Contexte socio-économique'),
      synthesis: parseJsonObject(draft.synthesis_json, 'Synthèse des prix'),
      track_record: trackRecord,
    },
  }
}

function eventToDraft(event: OpportunityEvent): EventDraft {
  const occurred = new Date(event.occurred_at)
  const due = event.due_at ? new Date(event.due_at) : null
  const normalize = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return ''
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  }

  return {
    type: event.type,
    title: event.title ?? '',
    content: event.content ?? '',
    due_at: normalize(due),
    occurred_at: normalize(occurred),
    milestone: typeof event.metadata?.milestone === 'string' ? event.metadata.milestone : 'estimation_done',
    meeting_type: typeof event.metadata?.meeting_type === 'string' ? event.metadata.meeting_type : 'rendez_vous_r1',

    send_sms_reminder: typeof event.metadata?.send_sms_reminder === 'boolean' ? event.metadata.send_sms_reminder : true,
    sms_reminder_hours: typeof event.metadata?.sms_reminder_hours === 'number' ? event.metadata.sms_reminder_hours : 24,
    sms_body: typeof event.metadata?.sms_body === 'string' ? event.metadata.sms_body : DEFAULT_RDV_TEMPLATES['rendez_vous_r1'].sms_template,
  }


}

export default function OpportunityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStage, setSavingStage] = useState(false)
  const [creatingDossier, setCreatingDossier] = useState(false)
  const [invitingClient, setInvitingClient] = useState(false)
  const [clientAccessSent, setClientAccessSent] = useState(false)
  const [openingClientLink, setOpeningClientLink] = useState(false)
  const [copyingClientLink, setCopyingClientLink] = useState(false)
  const [publishingEstimation, setPublishingEstimation] = useState(false)
  const [applyingImport, setApplyingImport] = useState(false)
  const [rejectingImport, setRejectingImport] = useState(false)
  const [overwriteEditorial, setOverwriteEditorial] = useState(false)
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft>(EMPTY_PROPERTY_DRAFT)
  const [professionalDraft, setProfessionalDraft] = useState<ProfessionalDraft>(EMPTY_PROFESSIONAL_DRAFT)
  const [savingPreparation, setSavingPreparation] = useState(false)

  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [eventDraft, setEventDraft] = useState<EventDraft>(emptyEventDraft('note'))
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [completingEventId, setCompletingEventId] = useState<string | null>(null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)

  const [leadDialogOpen, setLeadDialogOpen] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [detachingContactId, setDetachingContactId] = useState<string | null>(null)
  const [updatingTitulaireId, setUpdatingTitulaireId] = useState<string | null>(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [leadRows, setLeadRows] = useState<LeadSearchRow[]>([])
  const [leadLoading, setLeadLoading] = useState(false)
  const [attachingLeadId, setAttachingLeadId] = useState<string | null>(null)

  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false)
  const [propertySearch, setPropertySearch] = useState('')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('')
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('')
  const [propertyRows, setPropertyRows] = useState<PropertySearchRow[]>([])
  const [propertyLoading, setPropertyLoading] = useState(false)
  const [attachingPropertyId, setAttachingPropertyId] = useState<string | null>(null)
  const [deletingOpportunity, setDeletingOpportunity] = useState(false)
  const [propertyEditOpen, setPropertyEditOpen] = useState(false)
  const [activityFilter, setActivityFilter] = useState<'all' | 'note' | 'task' | 'call' | 'meeting'>('all')
  // Incremente a chaque enregistrement du contexte : c'est le signal qui
  // fait recalculer la liste des pieces au panneau voisin.
  const [saleContextVersion, setSaleContextVersion] = useState(0)
  const [projectBons, setProjectBons] = useState<BonDeVisite[]>([])


  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/opportunities/' + id)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      const loadedOpportunity = { ...data.opportunity, events: data.opportunity.events ?? [] } as Opportunity
      setOpportunity(loadedOpportunity)
      setPropertyDraft(propertyDraftFromOpportunity(loadedOpportunity))
      setProfessionalDraft(professionalDraftFromOpportunity(loadedOpportunity))

      try {
        const bvRes = await fetch(`/api/market/bons-de-visite?projectId=${id}`)
        if (bvRes.ok) {
          const bvData = await bvRes.json()
          setProjectBons(bvData.bons || [])
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('[OpportunityDetailPage] load:', err)
      toast.error('Impossible de charger l’opportunité')
    } finally {
      setLoading(false)
    }
  }, [id])

  async function createDossier() {
    setCreatingDossier(true)
    try {
      const res = await fetch('/api/market/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_type: 'seller', opportunity_id: id }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Création impossible')
      toast.success('Suivi client créé')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setCreatingDossier(false)
    }
  }

  async function inviteClientFromOpportunity() {
    const dossierId = opportunity?.client_dossier?.id
    if (!dossierId) return
    setInvitingClient(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/invite`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Invitation impossible')
      if (json.data?.action_link) {
        await navigator.clipboard?.writeText(json.data.action_link)
        toast.success('Lien d’invitation copié')
      } else {
        toast.success('Invitation envoyée')
      }
      setClientAccessSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invitation impossible')
    } finally {
      setInvitingClient(false)
    }
  }

  async function copyClientPortalUrlFromOpportunity() {
    const dossierId = opportunity?.client_dossier?.id
    if (!dossierId) return
    setCopyingClientLink(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/client-link`)
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.client_url) throw new Error(json.error ?? 'Lien client impossible')
      await navigator.clipboard?.writeText(json.data.client_url)
      toast.success('Lien client copié')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lien client impossible')
    } finally {
      setCopyingClientLink(false)
    }
  }

  async function openClientPortalLinkFromOpportunity() {
    const dossierId = opportunity?.client_dossier?.id
    if (!dossierId) return
    setOpeningClientLink(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/preview-link`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.preview_url) throw new Error(json.error ?? 'Ouverture impossible')
      const href = json.data.preview_url
      window.open(href, '_blank', 'noopener,noreferrer')
      toast.success('Aperçu client ouvert')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ouverture impossible')
    } finally {
      setOpeningClientLink(false)
    }
  }

  async function publishEstimationFromOpportunity() {
    const dossierId = opportunity?.client_dossier?.id
    if (!dossierId) return
    setPublishingEstimation(true)
    try {
      const res = await fetch(`/api/market/clients/${dossierId}/publish-estimation`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Publication impossible')
      toast.success('Estimation publiée dans l’espace client')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publication impossible')
    } finally {
      setPublishingEstimation(false)
    }
  }

  async function applyPendingEstimationImport() {
    const importId = opportunity?.latest_pending_estimation_import?.id
    if (!importId) return
    setApplyingImport(true)
    try {
      const res = await fetch(`/api/market/opportunities/${id}/estimation-imports/${importId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite_editorial: overwriteEditorial }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Application impossible')
      toast.success('Import appliqué à l’avis de valeur')
      setOverwriteEditorial(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Application impossible')
    } finally {
      setApplyingImport(false)
    }
  }

  async function rejectPendingEstimationImport() {
    const importId = opportunity?.latest_pending_estimation_import?.id
    if (!importId) return
    setRejectingImport(true)
    try {
      const res = await fetch(`/api/estimation-imports/${importId}/reject`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Rejet impossible')
      toast.success('Import rejeté')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejet impossible')
    } finally {
      setRejectingImport(false)
    }
  }

  const loadLeads = useCallback(async () => {
    setLeadLoading(true)
    try {
      const params = new URLSearchParams({ page_size: '30', tool: 'vendre' })
      if (leadSearch.trim()) params.set('q', leadSearch.trim())
      const res = await fetch('/api/leads/list?' + params.toString())
      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.error ?? 'Erreur API')
      setLeadRows(data.data ?? [])
    } catch (err) {
      console.error('[OpportunityDetailPage] leads:', err)
      toast.error('Impossible de charger les contacts')
    } finally {
      setLeadLoading(false)
    }
  }, [leadSearch])

  const loadProperties = useCallback(async () => {
    setPropertyLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', sort: 'last_seen_at.desc' })
      if (propertySearch.trim()) params.set('q', propertySearch.trim())
      if (propertyTypeFilter) params.set('property_type', propertyTypeFilter)
      if (propertyStatusFilter) params.set('status', propertyStatusFilter)
      const res = await fetch('/api/market/properties?' + params.toString())
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setPropertyRows(data.properties ?? [])
    } catch (err) {
      console.error('[OpportunityDetailPage] properties:', err)
      toast.error('Impossible de charger les biens')
    } finally {
      setPropertyLoading(false)
    }
  }, [propertySearch, propertyStatusFilter, propertyTypeFilter])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!leadDialogOpen) return
    const timer = setTimeout(() => { void loadLeads() }, 250)
    return () => clearTimeout(timer)
  }, [leadDialogOpen, loadLeads])
  useEffect(() => {
    if (!propertyDialogOpen) return
    const timer = setTimeout(() => { void loadProperties() }, 250)
    return () => clearTimeout(timer)
  }, [propertyDialogOpen, loadProperties])

  const events = useMemo(
    () => [...(opportunity?.events ?? [])].sort((a, b) => new Date(eventRecency(b)).getTime() - new Date(eventRecency(a)).getTime()),
    [opportunity?.events],
  )
  const upcomingEvents = useMemo(
    () => events
      .filter((event) => ['task', 'call', 'meeting'].includes(event.type) && !event.completed_at)
      .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime()),
    [events],
  )
  const recentEvents = events.slice(0, 6)

  /**
   * Échéances portées sur le calendrier : celles des activités (tâche, appel,
   * RDV) et les jalons datés du projet. Le ton porte l'urgence : dépassée,
   * honorée, ou à venir.
   */
  const deadlineItems = useMemo<DeadlineItem[]>(() => {
    if (!opportunity) return []
    const now = Date.now()

    // Seuls les éléments planifiés (tâche, appel, rdv) et jalons sont affichés sur le calendrier
    const fromEvents = events
      .filter((event) => Boolean(event.due_at) && ['task', 'call', 'meeting'].includes(event.type))
      .map((event) => {
        const dateStr = event.due_at as string
        const dateObj = new Date(dateStr)
        const isOverdue = !event.completed_at && !Number.isNaN(dateObj.getTime()) && dateObj.getTime() < now
        const typeLabel = event.type === 'task' ? 'Tâche planifiée' : event.type === 'call' ? 'Appel planifié' : 'Rendez-vous planifié'

        return {
          id: event.id,
          date: dateStr,
          label: event.title || EVENT_CONFIG[event.type]?.label || typeLabel,
          hint: typeLabel,
          tone: event.completed_at
            ? ('done' as const)
            : isOverdue
              ? ('overdue' as const)
              : ('default' as const),
        }
      })


    const dossierEvents = ((opportunity.client_dossier as any)?.events ?? [])
      .filter((evt: any) => Boolean(evt.event_date || evt.due_at))

      .map((evt: any) => {
        const dateStr = evt.event_date || evt.due_at
        const dateObj = new Date(dateStr)
        const isOverdue = !Number.isNaN(dateObj.getTime()) && dateObj.getTime() < now
        const typeLabel = evt.type === 'visit' ? 'Visite' : evt.type === 'offer' ? 'Offre d’achat' : 'Étape client'
        return {
          id: `client-evt-${evt.id}`,
          date: dateStr,
          label: evt.title || typeLabel,
          hint: typeLabel,
          tone: evt.status === 'completed' || evt.status === 'accepted'
            ? ('done' as const)
            : isOverdue
              ? ('overdue' as const)
              : ('default' as const),
        }
      })

    const milestones: Array<{ key: string; date: string | null; label: string; hint: string }> = [
      { key: 'due_date', date: opportunity.due_date, label: 'Échéance action', hint: 'Action planifiée' },
      { key: 'visit_at', date: opportunity.visit_at, label: 'Visite d’estimation', hint: 'Rendez-vous estimation' },

      { key: 'report_delivered_at', date: opportunity.report_delivered_at, label: "Remise de l'estimation", hint: 'Remise rapport' },
      { key: 'follow_up_at', date: opportunity.follow_up_at, label: 'Prochaine relance', hint: 'Suivi client' },
    ]

    const fromMilestones = milestones
      .filter((milestone): milestone is { key: string; date: string; label: string; hint: string } => Boolean(milestone.date))
      .map((milestone) => ({
        id: `milestone-${milestone.key}`,
        date: milestone.date,
        label: milestone.label,
        hint: milestone.hint,
        tone: new Date(milestone.date).getTime() < now ? ('done' as const) : ('default' as const),
      }))

    return [...fromEvents, ...dossierEvents, ...fromMilestones]
  }, [events, opportunity])


  const filteredActivityEvents = useMemo(() => {
    if (activityFilter === 'all') return recentEvents
    return events.filter((e) => e.type === activityFilter)
  }, [events, recentEvents, activityFilter])

  function openEvent(type: ActivityType) {
    setEditingEventId(null)
    setEventDraft(emptyEventDraft(type))
    setEventDialogOpen(true)
  }

  function editEvent(event: OpportunityEvent) {
    setEditingEventId(event.id)
    setEventDraft(eventToDraft(event))
    setEventDialogOpen(true)
  }

  async function updateStage(stage: string) {
    if (!opportunity) return
    setSavingStage(true)
    try {
      const res = await fetch('/api/market/opportunities/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setOpportunity((prev) => (prev ? {
        ...prev,
        ...data.opportunity,
        stage: data.opportunity?.stage ?? stage,
        project_contacts: prev.project_contacts ?? data.opportunity?.project_contacts ?? [],
      } : null))
      toast.success('Étape mise à jour : ' + stage)
    } catch (err) {
      console.error('[OpportunityDetailPage] stage:', err)
      toast.error('Impossible de modifier l’étape')
    } finally {
      setSavingStage(false)
    }
  }

  async function savePreparation() {
    const existingOpinion = asRecord(opportunity?.professional_opinion)
    const nextProfessionalOpinion = {
      ...normalizeProfessionalDraft(professionalDraft),
      ...(existingOpinion.client_portal_published === true ? {
        client_portal_published: true,
        client_portal_published_at: existingOpinion.client_portal_published_at,
      } : {}),
    }
    setSavingPreparation(true)
    try {
      const res = await fetch('/api/market/opportunities/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_snapshot: normalizePropertyDraft(propertyDraft),
          professional_opinion: nextProfessionalOpinion,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      const updatedOpportunity = { ...data.opportunity, events: data.opportunity.events ?? [] } as Opportunity
      setOpportunity(updatedOpportunity)
      setPropertyDraft(propertyDraftFromOpportunity(updatedOpportunity))
      setProfessionalDraft(professionalDraftFromOpportunity(updatedOpportunity))
      toast.success('Pré-mandat sauvegardé')
    } catch (err) {
      console.error('[OpportunityDetailPage] save preparation:', err)
      toast.error('Impossible de sauvegarder le pré-mandat')
    } finally {
      setSavingPreparation(false)
    }
  }

  async function saveEvent() {
    // L'API exige un titre pour les tâches : on le contrôle ici pour éviter
    // un 400 qui laisserait la popup ouverte sans explication.
    if (eventDraft.type === 'task' && !eventDraft.title.trim()) {
      toast.error('Un titre est requis pour une tâche')
      return
    }
    if (!eventDraft.title.trim() && !eventDraft.content.trim() && eventDraft.type !== 'estimation') {
      toast.error('Ajoute un titre ou un contenu')
      return
    }

    setSavingEvent(true)
    try {
      const milestone = ESTIMATION_MILESTONES.find((item) => item.value === eventDraft.milestone)
      const res = await fetch(
        editingEventId
          ? `/api/market/opportunities/${id}/events/${editingEventId}`
          : `/api/market/opportunities/${id}/events`,
        {
          method: editingEventId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: eventDraft.type,
            title: eventDraft.type === 'estimation' ? milestone?.label : eventDraft.title.trim(),
            content: eventDraft.content.trim() || null,
            due_at: eventDraft.due_at || null,
            // Seuls les jalons d'estimation portent une date saisie ; pour les
            // autres types l'horodatage est celui du serveur (création) et une
            // modification ne doit pas le réécrire.
            occurred_at: eventDraft.type === 'estimation' ? eventDraft.occurred_at || null : null,
            metadata: {
              ...(eventDraft.type === 'estimation' ? { milestone: eventDraft.milestone } : {}),
              ...(eventDraft.type === 'meeting' ? {
                meeting_type: eventDraft.meeting_type,
                send_sms_reminder: eventDraft.send_sms_reminder,
                sms_reminder_hours: eventDraft.sms_reminder_hours,
                sms_body: eventDraft.sms_body,
              } : {}),

            },

            created_by: 'admin',
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setEventDialogOpen(false)
      setEditingEventId(null)
      toast.success(editingEventId ? 'Activité modifiée' : 'Activité ajoutée')
      await load()
    } catch (err) {
      console.error('[OpportunityDetailPage] event:', err)
      toast.error(err instanceof Error ? err.message : 'Impossible d’enregistrer l’activité')
    } finally {
      setSavingEvent(false)
    }
  }

  async function deleteEvent(event: OpportunityEvent) {
    if (!window.confirm('Supprimer cette activité ?')) return
    setDeletingEventId(event.id)
    try {
      const res = await fetch(`/api/market/opportunities/${id}/events/${event.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      toast.success('Activité supprimée')
      await load()
    } catch (err) {
      console.error('[OpportunityDetailPage] delete event:', err)
      toast.error('Impossible de supprimer l’activité')
    } finally {
      setDeletingEventId(null)
    }
  }

  async function completeEvent(event: OpportunityEvent) {
    setCompletingEventId(event.id)
    try {
      const res = await fetch(`/api/market/opportunities/${id}/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      toast.success('Activité terminée')
      await load()
    } catch (err) {
      console.error('[OpportunityDetailPage] complete event:', err)
      toast.error('Impossible de terminer l’activité')
    } finally {
      setCompletingEventId(null)
    }
  }

  const [duplicatingOpportunity, setDuplicatingOpportunity] = useState(false)
  const [quickNoteInput, setQuickNoteInput] = useState('')
  const [submittingQuickNote, setSubmittingQuickNote] = useState(false)

  async function handleQuickAddNote() {
    const text = quickNoteInput.trim()
    if (!text || !opportunity) return
    setSubmittingQuickNote(true)
    try {
      const res = await fetch(`/api/market/opportunities/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          title: 'Note',
          content: text,
          created_by: 'admin',
        }),
      })
      if (!res.ok) throw new Error('Erreur création note')
      toast.success('Note ajoutée au journal d’activité')
      setQuickNoteInput('')
      await load()
    } catch (err) {
      console.error('Quick note error:', err)
      toast.error('Impossible d’ajouter la note')
    } finally {
      setSubmittingQuickNote(false)
    }
  }

  async function duplicateOpportunity() {
    if (!opportunity) return
    setDuplicatingOpportunity(true)
    try {
      const contactIds = (opportunity.project_contacts ?? []).map((pc: any) => pc.contacts?.id).filter(Boolean)
      const payload = {
        kind: (opportunity as any).kind || 'vente',
        title: (opportunity.title || formattedTitle) + ' (Copie)',
        seller_name: opportunity.seller_name,
        seller_phone: opportunity.seller_phone,
        seller_email: opportunity.seller_email,
        property_city: opportunity.property_city,
        property_type: opportunity.property_type,
        contact_ids: contactIds,
      }
      const res = await fetch('/api/market/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la duplication')
      toast.success('Projet dupliqué avec succès')
      const newId = data.opportunity?.id || data.id
      if (newId) {
        router.push(`/admin/market/projects/${newId}`)
      }
    } catch (err) {
      console.error('Duplicate error:', err)
      toast.error('Impossible de dupliquer ce projet')
    } finally {
      setDuplicatingOpportunity(false)
    }
  }

  async function deleteOpportunity() {
    if (!window.confirm('Supprimer cette opportunité ? Cette action est irréversible.')) return
    setDeletingOpportunity(true)
    try {
      const res = await fetch(`/api/market/opportunities/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      toast.success('Projet supprimé')
      router.push('/admin/market/projects')
    } catch (err) {
      console.error('[OpportunityDetailPage] delete opportunity:', err)
      toast.error("Impossible de supprimer l'opportunité")
    } finally {
      setDeletingOpportunity(false)
    }
  }

  /**
   * Designe ou retire un titulaire : seuls les contacts qui figurent sur le
   * titre de propriete composent le titre affiche du projet. Le notaire ou le
   * mandataire reste rattache au dossier sans y apparaitre.
   */
  async function toggleProjectTitulaire(contactId: string, next: boolean) {
    setUpdatingTitulaireId(contactId)
    try {
      const res = await fetch(`/api/market/projects/${id}/contacts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, is_titulaire: next }),
      })
      if (!res.ok) throw new Error('Erreur API')
      toast.success(next ? 'Désigné comme titulaire' : 'Retiré des titulaires')
      await load()
    } catch (err) {
      console.error('[OpportunityDetailPage] toggle titulaire:', err)
      toast.error('Impossible de mettre à jour le titulaire')
    } finally {
      setUpdatingTitulaireId(null)
    }
  }

  async function detachProjectContact(contactId: string, name: string) {
    setDetachingContactId(contactId)
    try {
      const res = await fetch(`/api/market/projects/${id}/contacts?contact_id=${contactId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erreur API')
      toast.success(`${name} détaché du projet`)
      await load()
    } catch (err) {
      console.error('[OpportunityDetailPage] detach contact:', err)
      toast.error('Impossible de détacher ce contact')
    } finally {
      setDetachingContactId(null)
    }
  }

  async function attachLead(lead: LeadSearchRow) {
    if (lead.opportunity && lead.opportunity.id !== id) {
      toast.error('Ce contact est déjà rattaché à une opportunité')
      return
    }
    setAttachingLeadId(lead.id)
    try {
      const res = await fetch('/api/market/opportunities/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const data = await res.json()
      if (res.status === 409) {
        toast.error('Ce contact est déjà rattaché à une opportunité', {
          action: data.existing_opportunity?.id
            ? { label: 'Ouvrir', onClick: () => router.push(`/admin/market/projects/${data.existing_opportunity.id}`) }
            : undefined,
        })
        return
      }
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setOpportunity({ ...data.opportunity, events: data.opportunity.events ?? [] })
      setLeadDialogOpen(false)
      toast.success('Contact rattaché')
    } catch (err) {
      console.error('[OpportunityDetailPage] attach lead:', err)
      toast.error('Impossible de rattacher ce contact')
    } finally {
      setAttachingLeadId(null)
    }
  }

  // Même personne, projet distinct : crée un lead dédié (via clone_lead_from)
  // et le rattache à cette opportunité, qui garde son propre portail.
  async function attachAsNewProject(lead: LeadSearchRow) {
    setAttachingLeadId(lead.id)
    try {
      const res = await fetch('/api/market/opportunities/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clone_lead_from: lead.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setOpportunity({ ...data.opportunity, events: data.opportunity.events ?? [] })
      setLeadDialogOpen(false)
      toast.success('Nouveau projet rattaché à ce contact')
    } catch (err) {
      console.error('[OpportunityDetailPage] attach new project:', err)
      toast.error(err instanceof Error ? err.message : 'Impossible de créer le nouveau projet')
    } finally {
      setAttachingLeadId(null)
    }
  }

  async function attachProperty(property: PropertySearchRow) {
    if (property.opportunity && property.opportunity.id !== id) {
      toast.error('Ce bien est déjà rattaché à une opportunité')
      return
    }
    setAttachingPropertyId(property.id)
    try {
      const res = await fetch('/api/market/opportunities/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_property_id: property.id }),
      })
      const data = await res.json()
      if (res.status === 409) {
        toast.error('Ce bien est déjà rattaché à une opportunité', {
          action: data.existing_opportunity?.id
            ? { label: 'Ouvrir', onClick: () => router.push(`/admin/market/projects/${data.existing_opportunity.id}`) }
            : undefined,
        })
        return
      }
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setOpportunity({ ...data.opportunity, events: data.opportunity.events ?? [] })
      setPropertyDialogOpen(false)
      toast.success('Bien rattaché')
    } catch (err) {
      console.error('[OpportunityDetailPage] attach property:', err)
      toast.error('Impossible de rattacher ce bien')
    } finally {
      setAttachingPropertyId(null)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Chargement...</div>
  if (!opportunity) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">Projet introuvable</p>
        <Button variant="outline" onClick={() => router.push('/admin/market/projects')}>Retour</Button>
      </div>
    )
  }

  const currentStage = opportunity.stage ?? STAGES[0]
  const stageIndex = Math.max(0, STAGES.indexOf(currentStage))
  const progress = Math.max(8, ((stageIndex + 1) / STAGES.length) * 100)
  const prevStage = stageIndex > 0 ? STAGES[stageIndex - 1] : null
  const prevStageIndex = stageIndex > 0 ? stageIndex - 1 : -1
  const nextStage = stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null


  const editableProperty = isUserEditableProperty(opportunity.property)
  const estimationPublished = isClientPortalEstimationPublished(opportunity)
  const estimate = opportunity.estimated_price_min || opportunity.estimated_price_max
    ? [opportunity.estimated_price_min, opportunity.estimated_price_max].filter((value): value is number => value != null).map(formatPrice).join(' - ')
    : null
  const formattedTitle = (
    buildProjectTitle({
      titulaireLastNames: (opportunity.project_contacts ?? [])
        .filter((entry: any) => entry.is_titulaire)
        .map((entry: any) => entry.contacts?.last_name),
      declaredName: (opportunity.project_contacts ?? []).length === 0 ? opportunity.seller_name : null,
      city: opportunity.property_city ?? null,
    }) ||
    (opportunity.display_title && opportunity.display_title !== 'Opportunité vendeur' && opportunity.display_title !== 'Nouveau Vendeur' ? opportunity.display_title : null) || 
    (opportunity.title && opportunity.title !== 'Opportunité vendeur' && opportunity.title !== 'Nouveau Vendeur' ? opportunity.title : null) || 
    'Projet Vente'
  )

  return (
    <div className="space-y-6">
      {/* Top Navigation Link */}
      <div>
        <Link href="/admin/market/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Retour aux projets
        </Link>
      </div>

      {/* Top Banner Card (Fiche Projet Header) */}
      <div className="rounded-2xl border bg-card p-6 shadow-2xs space-y-5">
        {/* Top Header Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-xs">
                PROJET {(opportunity as any).kind === 'achat' ? 'ACHAT' : 'VENTE'}
              </Badge>
              {estimate && (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-bold text-xs">
                  💰 {estimate} €
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight pt-1">
              {formattedTitle}
            </h1>
            {/* La commune est dans le titre : ici c'est l'identite du dossier,
                celle qu'on annonce au telephone et qu'on met dans un mail. */}
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {(opportunity as any).reference ?? '—'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-9 rounded-xl text-xs font-semibold border-border bg-card hover:bg-accent cursor-pointer"
            >
              <Link href={`/app/bons-de-visite/nouveau?projectId=${id}`}>
                <FileSignature className="mr-1.5 size-4 text-primary" />
                Bon de visite
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label="Options du projet">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuItem onClick={duplicateOpportunity} disabled={duplicatingOpportunity} className="cursor-pointer">
                  {duplicatingOpportunity ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Copy className="mr-2 size-4 text-muted-foreground" />}
                  Dupliquer le projet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={deleteOpportunity} disabled={deletingOpportunity} className="text-destructive font-medium cursor-pointer">
                  {deletingOpportunity ? <Loader2 className="mr-2 size-4 animate-spin text-destructive" /> : <Trash2 className="mr-2 size-4 text-destructive" />}
                  Supprimer le projet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Separator />

        {/* Ultra-Modern 3-Step Carousel Stepper Header */}
        <div className="space-y-4">
          {/* Header Controls: Progress Summary + Modifier l'étape Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
            <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Rocket className="size-4 text-primary" />
              Avancement du projet — Étape {stageIndex + 1} sur {STAGES.length}
            </span>
            <div className="flex items-center gap-3">
              <StatusPill tone={stageIndex === STAGES.length - 1 ? 'success' : 'brand'}>
                {Math.round(progress)}% accompli
              </StatusPill>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={savingStage}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-4 h-8 text-xs shadow-2xs cursor-pointer transition-all duration-200"
                  >
                    {savingStage ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 size-4" />
                    )}
                    Modifier l’étape
                    <ChevronDown className="ml-2 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-sm border-border/80">
                  {STAGES.map((stg, idx) => {
                    const { icon: ItemIcon } = getStageTheme(stg)
                    const isSelected = stg === currentStage
                    return (
                      <DropdownMenuItem
                        key={stg}
                        onClick={() => updateStage(stg)}
                        className={cn(
                          "cursor-pointer font-medium text-xs flex items-center justify-between py-2 px-3 rounded-xl transition-all",
                          isSelected
                            ? "bg-primary/10 font-bold text-primary"
                            : "hover:bg-accent text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}.</span>
                          <ItemIcon className="size-4 text-muted-foreground" />
                          <span>{stg}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="size-4 text-primary" />}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Clean & Visual Horizontal Progress Carousel Track */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xs overflow-x-auto scrollbar-thin">
              <div className="relative min-w-max px-6 py-2">
                {/* Background Line */}
                <div className="absolute left-10 right-10 top-8 h-1.5 bg-muted rounded-full z-0" />
                <div
                  className="absolute left-10 h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-sky-500 rounded-full z-0 transition-all duration-500"
                  style={{
                    width: `calc(${Math.min(100, Math.max(0, (stageIndex / (STAGES.length - 1)) * 100))}% * (100% - 80px) / 100)`,
                  }}
                />

                {/* Horizontal Stepper Nodes */}
                <div className="flex items-start justify-between gap-8 sm:gap-12 relative z-10">
                  {STAGES.map((stg, idx) => {
                    const isDone = idx < stageIndex
                    const isCurrent = idx === stageIndex
                    const { icon: StageIcon } = getStageTheme(stg)

                    return (
                      <button
                        key={stg}
                        type="button"
                        onClick={() => updateStage(stg)}
                        disabled={savingStage}
                        className="group flex flex-col items-center gap-2.5 focus:outline-hidden min-w-28 text-center cursor-pointer"
                      >
                        {/* Node Icon Circle */}
                        <div
                          className={cn(
                            'flex size-11 items-center justify-center rounded-2xl text-xs font-bold transition-all duration-300 border-2 bg-card shadow-2xs',
                            isDone &&
                              'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20 shadow-md',
                            isCurrent &&
                              'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110 shadow-lg',
                            !isDone &&
                              !isCurrent &&
                              'border-border text-muted-foreground group-hover:border-primary/50 group-hover:text-foreground'
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="size-5 stroke-[2.5]" />
                          ) : (
                            <StageIcon className="size-4.5" />
                          )}
                        </div>

                        {/* Title */}
                        <span
                          className={cn(
                            'block text-xs font-bold truncate max-w-32 transition-colors',
                            isCurrent
                              ? 'text-primary font-black'
                              : isDone
                              ? 'text-foreground font-semibold'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )}
                          title={stg}
                        >
                          {idx + 1}. {stg}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Active Stage Quick Action Bar */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold text-xs shrink-0 shadow-2xs">
                  {(() => {
                    const { icon: ActiveIcon } = getStageTheme(currentStage)
                    return <ActiveIcon className="size-4.5" />
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                      Étape actuelle ({stageIndex + 1}/{STAGES.length})
                    </span>
                    <StatusPill tone="brand" className="h-4 px-2 text-[10px] font-bold">
                      En cours
                    </StatusPill>
                  </div>
                  <h4 className="text-sm font-black text-foreground">{currentStage}</h4>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {prevStage && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingStage}
                    onClick={() => updateStage(prevStage)}
                    className="h-8 rounded-xl text-xs font-semibold border-border bg-card hover:bg-accent cursor-pointer"
                  >
                    <ChevronLeft className="mr-1 size-3.5" />
                    {prevStage}
                  </Button>
                )}
                {nextStage && (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={savingStage}
                    onClick={() => updateStage(nextStage)}
                    className="h-8 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs cursor-pointer"
                  >
                    Passer à : {nextStage}
                    <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>




      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList variant="pill" className="w-full justify-start">
          <TabsTrigger value="overview" className="flex-1"><LayoutDashboard className="mr-1.5 size-4" /> Vue d’ensemble</TabsTrigger>
          <TabsTrigger value="estimation" className="flex-1"><Building2 className="mr-1.5 size-4" /> Estimation</TabsTrigger>
          <TabsTrigger value="visites" className="flex-1"><FileSignature className="mr-1.5 size-4" /> Visites ({projectBons.length})</TabsTrigger>
          <TabsTrigger value="dossier" className="flex-1"><FolderOpen className="mr-1.5 size-4" /> Suivi client</TabsTrigger>
          <TabsTrigger value="history" className="flex-1"><History className="mr-1.5 size-4" /> Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Main 2-Column Grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column (Calendrier, Contacts, Le Bien) */}
            <div className="space-y-6 lg:col-span-5">

              {/* Card: CALENDRIER */}
              <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      CALENDRIER
                    </h2>
                    {deadlineItems.length > 0 && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-[10px] h-5 px-2">
                        {deadlineItems.length} événement{deadlineItems.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEvent('meeting')}
                      className="text-primary hover:text-primary/80 font-bold text-xs p-1 h-auto"
                      title="Planifier un rendez-vous"
                    >
                      + Rendez-vous
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEvent('task')}
                      className="text-muted-foreground hover:text-foreground font-bold text-xs p-1 h-auto"
                      title="Ajouter une tâche"
                    >
                      + Tâche
                    </Button>
                  </div>
                </div>
                <DeadlineCalendar
                  items={deadlineItems}
                  emptyText="Aucun événement planifié : ajoutez une tâche, un appel ou un rendez-vous."
                  onSelectItem={(item) => {
                    const event = events.find((candidate) => candidate.id === item.id)
                    if (event) editEvent(event)
                  }}
                />
              </div>

              {/* Card: CONTACTS RATTACHÉS */}
              <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      CONTACTS RATTACHÉS
                    </h2>
                    {opportunity.project_contacts && opportunity.project_contacts.length > 0 && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-[10px] h-5 px-2">
                        {opportunity.project_contacts.length} contact{opportunity.project_contacts.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContactDialogOpen(true)}
                    className="text-primary hover:text-primary/80 font-bold text-xs p-1 h-auto cursor-pointer"
                  >
                    + Ajouter
                  </Button>
                </div>

                {opportunity.project_contacts && opportunity.project_contacts.length > 0 ? (
                  <div className="space-y-3">
                    {opportunity.project_contacts.map((pc: any, idx: number) => {
                      const contact = pc.contacts
                      if (!contact) return null
                      const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
                      const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'C'
                      const roleLabel = pc.role ? pc.role.toLowerCase() : 'contact'

                      const colors = [
                        'bg-sky-600 text-white',
                        'bg-slate-700 text-white',
                        'bg-amber-700 text-white',
                        'bg-emerald-700 text-white',
                      ]
                      const avatarColor = colors[idx % colors.length]

                      const contactHref = contact.id ? `/admin/market/contacts/${contact.id}` : null

                      return (
                        <div key={contact.id || idx} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {contactHref ? (
                              <Link href={contactHref} className="shrink-0 group">
                                <div className={cn("size-9 flex items-center justify-center rounded-full text-xs font-bold shadow-xs group-hover:opacity-85 transition-opacity", avatarColor)}>
                                  {initials}
                                </div>
                              </Link>
                            ) : (
                              <div className={cn("size-9 shrink-0 flex items-center justify-center rounded-full text-xs font-bold shadow-xs", avatarColor)}>
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-foreground truncate">
                                {contactHref ? (
                                  <Link href={contactHref} className="hover:underline hover:text-primary transition-colors">
                                    {name}
                                  </Link>
                                ) : (
                                  name
                                )}{' '}
                                <span className="text-xs font-normal italic text-muted-foreground">• {roleLabel}</span>
                              </div>
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="text-xs text-muted-foreground hover:text-primary font-medium block truncate">
                                  {contact.phone}
                                </a>
                              )}
                            </div>
                          </div>
                          <ToggleChip
                            selected={pc.is_titulaire === true}
                            onClick={() => toggleProjectTitulaire(contact.id, !pc.is_titulaire)}
                            disabled={updatingTitulaireId === contact.id}
                            title={
                              pc.is_titulaire
                                ? 'Figure sur le titre de propriété — retirer'
                                : 'Ne figure pas sur le titre de propriété — désigner'
                            }
                            className="ml-auto shrink-0"
                          >
                            Titulaire
                          </ToggleChip>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => detachProjectContact(contact.id, name)}
                            disabled={detachingContactId === contact.id}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            {detachingContactId === contact.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground space-y-2">
                    <p>Aucun contact rattaché à ce projet.</p>
                    <Button variant="outline" size="sm" onClick={() => setContactDialogOpen(true)} className="text-xs font-medium">
                      + Rattacher un contact
                    </Button>
                  </div>
                )}
              </div>

              {/* Card: LE BIEN */}
              <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      LE BIEN
                    </h2>
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-[10px] h-5 px-2">
                      {propertyDraft.type_bien || opportunity.property?.property_type || 'Bien'}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPropertyEditOpen(true)}
                    className="text-primary hover:text-primary/80 font-bold text-xs p-1 h-auto cursor-pointer flex items-center gap-1"
                  >
                    <Edit className="size-3.5 text-primary" />
                    <span>Modifier les infos</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Block 1: Surface habitable */}
                  <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Ruler className="size-3.5 text-muted-foreground" />
                      Surface habitable
                    </span>
                    <span className="block text-sm font-bold text-foreground">
                      {propertyDraft.surface || opportunity.property?.surface || (opportunity as any).property_surface
                        ? `${propertyDraft.surface || opportunity.property?.surface || (opportunity as any).property_surface} m²`
                        : 'Non renseigné'}
                    </span>
                  </div>

                  {/* Block 2: Configuration / Type */}
                  <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      Type & Pièces
                    </span>
                    <span className="block text-sm font-bold text-foreground">
                      {propertyDraft.type_bien || opportunity.property?.property_type || 'Bien'}{' '}
                      {propertyDraft.nb_pieces || opportunity.property?.rooms || (opportunity as any).property_rooms
                        ? `(${propertyDraft.nb_pieces || opportunity.property?.rooms || (opportunity as any).property_rooms} p.)`
                        : ''}
                    </span>
                  </div>

                  {/* Block 3: Surface terrain */}
                  <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Trees className="size-3.5 text-muted-foreground" />
                      Surface terrain
                    </span>
                    <span className="block text-sm font-bold text-foreground">
                      {propertyDraft.surface_terrain || opportunity.property?.land_surface || (opportunity as any).property_land_surface
                        ? `${propertyDraft.surface_terrain || opportunity.property?.land_surface || (opportunity as any).property_land_surface} m²`
                        : 'Non renseigné'}
                    </span>
                  </div>

                  {/* Block 4: Estimation (Fourchette) */}
                  <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calculator className="size-3.5 text-primary" />
                      Estimation (Fourchette)
                    </span>
                    <span className="block text-sm font-bold text-primary">
                      {professionalDraft.price_low || professionalDraft.price_high
                        ? `${professionalDraft.price_low ? formatPrice(Number(professionalDraft.price_low)) : ''}${professionalDraft.price_low && professionalDraft.price_high ? ' - ' : ''}${professionalDraft.price_high ? formatPrice(Number(professionalDraft.price_high)) : ''}`
                        : professionalDraft.price
                        ? formatPrice(Number(professionalDraft.price))
                        : estimate || 'Non estimé'}
                    </span>
                  </div>
                </div>
              </div>

            </div>


            {/* Right Column (Journal d'activité) */}
            <div className="space-y-6 lg:col-span-7">
              <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      JOURNAL D'ACTIVITÉ
                    </h2>
                    {filteredActivityEvents.length > 0 && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-[10px] h-5 px-2">
                        {filteredActivityEvents.length} activité{filteredActivityEvents.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-[10px] uppercase font-bold tracking-wider text-muted-foreground rounded-full px-2.5">
                        FILTRE : {activityFilter === 'all' ? 'TOUT' : activityFilter}
                        <ChevronDown className="ml-1 size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setActivityFilter('all')} className="text-xs font-semibold cursor-pointer">TOUT</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActivityFilter('note')} className="text-xs cursor-pointer">NOTES</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActivityFilter('task')} className="text-xs cursor-pointer">TÂCHES</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActivityFilter('call')} className="text-xs cursor-pointer">APPELS</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActivityFilter('meeting')} className="text-xs cursor-pointer">RENDEZ-VOUS</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Action Buttons to add events */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEvent('note')}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    <StickyNote className="mr-1.5 size-3.5 text-primary" /> + Note
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEvent('task')}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    <CheckCircle2 className="mr-1.5 size-3.5 text-emerald-600" /> + Tâche
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEvent('call')}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    <Phone className="mr-1.5 size-3.5 text-sky-600" /> + Appel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEvent('meeting')}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    <Calendar className="mr-1.5 size-3.5 text-amber-600" /> + Rendez-vous
                  </Button>
                </div>

                {/* Timeline Events Feed */}
                <Timeline
                  events={filteredActivityEvents}
                  emptyText="Aucune activité pour ce filtre."
                  onEdit={editEvent}
                  onDelete={deleteEvent}
                  deletingEventId={deletingEventId}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="estimation" className="space-y-6">
          {/* Header Summary KPI Hero Bar */}
          <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-2xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-xs">
                    Estimation & Avis de valeur
                  </Badge>
                  {opportunity.estimated_price_min || opportunity.estimated_price_max || professionalDraft.price ? (
                    <StatusPill tone="success" className="h-5 px-2.5 text-xs font-semibold">Valorisation définie</StatusPill>
                  ) : (
                    <StatusPill tone="warning" className="h-5 px-2.5 text-xs font-semibold">En cours d'élaboration</StatusPill>
                  )}
                </div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">Données de valorisation du bien</h2>
                <p className="text-xs font-medium text-muted-foreground">
                  Administrez les spécifications techniques du logement et configurez votre avis de valeur professionnel.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-10 rounded-xl font-semibold text-xs border-border bg-card hover:bg-accent cursor-pointer"
                >
                  <Link href={`/admin/avis-de-valeur/${id}`} target="_blank">
                    <FileText className="mr-1.5 size-4 text-primary" /> Ouvrir le rapport A4
                    <ExternalLink className="ml-1 size-3 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  onClick={savePreparation}
                  disabled={savingPreparation}
                  className="h-10 rounded-xl bg-primary hover:bg-primary/90 font-bold text-xs px-5 shadow-2xs cursor-pointer"
                >
                  {savingPreparation ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
                  Sauvegarder les modifications
                </Button>
              </div>
            </div>
          </div>

          {/* Section 1: Spécifications du bien */}
          <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Home className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Fiche technique du bien</h3>
                  <p className="text-xs font-medium text-muted-foreground">Caractéristiques physiques, surfaces et éléments administratifs</p>
                </div>
              </div>
            </div>

            {/* Administrative & Technical fields */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DraftField label="N° mandat" value={propertyDraft.mandate_number} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, mandate_number: value }))} placeholder="Ex. M-2026-042" />
              <DraftField label="Type de mandat prévu" value={propertyDraft.mandate_type} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, mandate_type: value }))} placeholder="Ex. Exclusif, Simple..." />
              <DraftSelectField label="Type de bien" value={propertyDraft.type_bien || 'Maison'} options={PROPERTY_TYPES} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, type_bien: value }))} />

              <DraftField label="Adresse / secteur" value={propertyDraft.adresse} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, adresse: value }))} placeholder="Ex. 12 rue des Vignes" />
              <DraftField label="Commune" value={propertyDraft.commune} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, commune: value }))} placeholder="Ex. Aix-en-Provence" />
              <DraftField label="DPE" value={propertyDraft.dpe} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, dpe: value }))} placeholder="Ex. B, C, D..." />
              <DraftField label="Surface habitable" type="number" suffix="m²" value={propertyDraft.surface} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, surface: value }))} />
              <DraftField label="Terrain / extérieur" type="number" suffix="m²" value={propertyDraft.surface_terrain} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, surface_terrain: value }))} />
              <DraftField label="Pièces" type="number" value={propertyDraft.nb_pieces} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, nb_pieces: value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <DraftArea label="État Général & Travaux" value={propertyDraft.etat} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, etat: value }))} placeholder="Ex. Très bon état général, travaux de rafraîchissement à prévoir..." rows={3} />
              <DraftArea label="Équipements & Prestations" value={propertyDraft.equipements} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, equipements: value }))} placeholder="Ex. Piscine, garage double, pompe à chaleur..." rows={3} />
              <DraftArea label="Contexte Vendeur & Projet" value={propertyDraft.contexte} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, contexte: value }))} placeholder="Ex. Mutation professionnelle, succession..." rows={3} />
              <DraftArea label="Points de vigilance" value={propertyDraft.points_vigilance} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, points_vigilance: value }))} placeholder="Ex. Servitude de passage, assainissement à mettre aux normes..." rows={3} />
            </div>
          </section>

          {/* Section 2: Financial Valuation & Professional Opinion */}
          <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Calculator className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Fourchette de valeur & avis professionnel</h3>
                  <p className="text-xs font-medium text-muted-foreground">Définissez le positionnement prix retenu et votre argumentaire</p>
                </div>
              </div>
            </div>

            {/* High Impact Valuation Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/80 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Estimation Basse</span>
                  <StatusPill tone="success" className="h-4 px-2 text-[10px]">Fourchette min</StatusPill>
                </div>
                <DraftField label="" type="number" suffix="€" value={professionalDraft.price_low} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price_low: value }))} placeholder="Ex. 420 000" />
              </div>

              <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3 shadow-2xs ring-2 ring-primary/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Prix Retenu (Conseillé)</span>
                  <StatusPill tone="brand" className="h-4 px-2 text-[10px] font-bold">Recommandé</StatusPill>
                </div>
                <DraftField label="" type="number" suffix="€" value={professionalDraft.price} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price: value }))} placeholder="Ex. 450 000" />
              </div>

              <div className="rounded-xl border border-border/80 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Estimation Haute</span>
                  <StatusPill tone="warning" className="h-4 px-2 text-[10px]">Fourchette max</StatusPill>
                </div>
                <DraftField label="" type="number" suffix="€" value={professionalDraft.price_high} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price_high: value }))} placeholder="Ex. 480 000" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DraftArea label="Synthèse de l’avis professionnel" value={professionalDraft.summary} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, summary: value }))} rows={5} placeholder="Résumé clair et pédagogique destiné au propriétaire..." />
              <DraftArea label="Arguments de valeur clés" value={professionalDraft.arguments} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, arguments: value }))} rows={5} placeholder="Points forts du bien, atouts comparables et arguments de négociation..." />
            </div>

            {opportunity.latest_pending_estimation_import ? (
              <PendingEstimationImportBanner
                pendingImport={opportunity.latest_pending_estimation_import}
                overwriteEditorial={overwriteEditorial}
                setOverwriteEditorial={setOverwriteEditorial}
                applying={applyingImport}
                rejecting={rejectingImport}
                onApply={applyPendingEstimationImport}
                onReject={rejectPendingEstimationImport}
              />
            ) : null}

            <ValuationReportEditor draft={professionalDraft} setDraft={setProfessionalDraft} />
          </section>
        </TabsContent>

        <TabsContent value="visites" className="space-y-6">
          {/* Header Visites avec Stats & Bouton d'action rapide */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-base font-extrabold text-foreground tracking-tight flex items-center gap-2">
                  <FileSignature className="size-5 text-primary" />
                  Visites & Bons de visite certifiés
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Consultez l'historique des acquéreurs ayant visité ce logement et générez de nouveaux bons certifiés.
                </p>
              </div>

              <Button
                asChild
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-2xs cursor-pointer"
              >
                <Link href={`/app/bons-de-visite/nouveau?projectId=${opportunity.id}`}>
                  <Plus className="mr-1.5 size-4" />
                  Nouveau bon de visite
                </Link>
              </Button>
            </div>

            {/* Statistiques rapides de visite */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Visites effectuées
                </span>
                <span className="text-2xl font-black text-foreground mt-1 block">
                  {projectBons.length}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {projectBons.length > 0 ? 'Document(s) certifié(s)' : 'Aucune visite pour le moment'}
                </span>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Acquéreurs uniques
                </span>
                <span className="text-2xl font-black text-foreground mt-1 block">
                  {projectBons.reduce((acc, b) => acc + (b.visitors_count || b.visitors?.length || 1), 0)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Qualifiés dans votre annuaire
                </span>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Espace Vendeur
                </span>
                <div className="flex items-center gap-1.5 mt-2">
                  <StatusPill tone="success">Synchronisé</StatusPill>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Remontée automatique au propriétaire
                </span>
              </div>
            </div>
          </div>

          {/* Liste chronologique des bons de visite */}
          {projectBons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
              <div className="flex size-12 mx-auto items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileCheck className="size-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                Aucune visite enregistrée sur ce bien
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Lors de votre prochaine visite avec un acquéreur, utilisez le générateur mobile pour faire signer le bon de recherche et visite.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-2 text-xs font-semibold rounded-xl border-border bg-card hover:bg-accent"
              >
                <Link href={`/app/bons-de-visite/nouveau?projectId=${opportunity.id}`}>
                  <Plus className="mr-1.5 size-3.5" />
                  Créer le premier bon de visite
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {projectBons.map((bon) => (
                <div
                  key={bon.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-2xs hover:border-primary/40 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                        {bon.reference}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(bon.visit_at).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusPill tone={bon.email_status === 'sent' ? 'success' : 'neutral'}>
                        {bon.email_status === 'sent' ? 'Email envoyé' : 'En attente email'}
                      </StatusPill>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold rounded-xl border-border bg-card hover:bg-accent cursor-pointer"
                      >
                        <Link href={`/bon-de-visite/${bon.token}`} target="_blank">
                          <ExternalLink className="mr-1.5 size-3.5 text-primary" />
                          Consulter le document officiel
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Détail des visiteurs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground font-semibold block mb-1">
                        Visiteur(s) ({bon.visitors_count}) :
                      </span>
                      <div className="space-y-1">
                        {bon.visitors.map((v, idx) => (
                          <div key={idx} className="flex flex-col text-foreground font-medium">
                            <span>
                              <strong>{v.first_name} {v.last_name}</strong>
                              {v.cni_number ? ` · CNI : ${v.cni_number}` : ''}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {v.email}{v.phone ? ` · ${v.phone}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground font-semibold block mb-1">
                        Compte-rendu & Notes de visite :
                      </span>
                      <p className="text-xs text-foreground italic bg-muted/30 p-2.5 rounded-xl border border-border/60">
                        {bon.notes || 'Aucune note particulière consignée pour cette visite.'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>


        <TabsContent value="dossier">
          <div className="space-y-5">
            {/* Le contexte appartient au projet, pas au dossier : il se saisit des
                la visite d'estimation, avant meme qu'un suivi client existe. */}
            <SaleContextPanel
              projectId={opportunity.id}
              propertyType={opportunity.property_type}
              onSaved={() => setSaleContextVersion((version) => version + 1)}
            />

            {/* Informatif : prepare l'ERP, ne coche aucune case du contexte. */}
            <PropertyRisksPanel projectId={opportunity.id} />

            {opportunity.client_dossier ? (
              <>
                <MandateFilePanel
                  dossierId={opportunity.client_dossier.id}
                  refreshToken={saleContextVersion}
                  onDocumentsChanged={() => void load()}
                />
                {/* Paralleles au statut : elles ne rentrent pas dans le stepper. */}
                <MandateActionsPanel dossierId={opportunity.client_dossier.id} />
                <DossierWorkspace dossierId={opportunity.client_dossier.id} opportunityId={opportunity.id} />
              </>
            ) : (
              <section className="rounded-xl border bg-card p-8 text-center">
              <FolderOpen className="mx-auto size-8 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold">
                {isPortalEligibleStage(currentStage) ? 'Créer le suivi client' : 'Suivi client à venir'}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {isPortalEligibleStage(currentStage)
                  ? 'Crée le suivi pour obtenir le lien client, puis administrer documents, plan de vente, visites, offres et statistiques.'
                  : 'Le suivi client sera disponible à partir de la remise de l’estimation.'}
              </p>
              {isPortalEligibleStage(currentStage) && (
                <Button size="sm" className="mt-4 bg-primary hover:bg-primary/90" onClick={createDossier} disabled={creatingDossier}>
                  {creatingDossier ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Plus className="mr-1 size-3.5" />}
                  Créer le suivi client
                </Button>
              )}
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Historique complet</h2>
            <Timeline events={events} emptyText="Aucune activité enregistrée." onEdit={editEvent} onDelete={deleteEvent} deletingEventId={deletingEventId} />
          </section>
        </TabsContent>
      </Tabs>

      <EventDialog
        open={eventDialogOpen}
        draft={eventDraft}
        saving={savingEvent}
        editing={Boolean(editingEventId)}
        leadInfo={opportunity?.lead}
        propertyInfo={opportunity?.property}
        onOpenChange={setEventDialogOpen}
        onDraftChange={setEventDraft}
        onSubmit={saveEvent}
      />



      <ProjectContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        projectId={id}
        kind="vente"
        excludeIds={(opportunity.project_contacts ?? []).map((pc: any) => pc.contacts?.id).filter(Boolean)}
        onAttached={load}
      />

      <LeadAttachDialog
        open={leadDialogOpen}
        rows={leadRows}
        search={leadSearch}
        loading={leadLoading}
        attachingId={attachingLeadId}
        opportunityId={id}
        onOpenChange={setLeadDialogOpen}
        onSearchChange={setLeadSearch}
        onAttach={attachLead}
        onAttachNewProject={attachAsNewProject}
        onOpenOpportunity={(opportunityId) => router.push(`/admin/market/projects/${opportunityId}`)}
      />

      <PropertyAttachDialog
        open={propertyDialogOpen}
        rows={propertyRows}
        search={propertySearch}
        typeFilter={propertyTypeFilter}
        statusFilter={propertyStatusFilter}
        loading={propertyLoading}
        attachingId={attachingPropertyId}
        opportunityId={id}
        onOpenChange={setPropertyDialogOpen}
        onSearchChange={setPropertySearch}
        onTypeFilterChange={setPropertyTypeFilter}
        onStatusFilterChange={setPropertyStatusFilter}
        onAttach={attachProperty}
        onOpenOpportunity={(opportunityId) => router.push(`/admin/market/projects/${opportunityId}`)}
      />

      <Dialog open={propertyEditOpen} onOpenChange={setPropertyEditOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
              <Building2 className="size-5 text-primary" />
              Modifier les informations du bien
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mettez à jour le type de bien, les surfaces et la fourchette d'estimation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <DraftSelectField
              label="Type de bien"
              value={propertyDraft.type_bien || 'Maison'}
              options={PROPERTY_TYPES}
              onChange={(value) => setPropertyDraft((draft) => ({ ...draft, type_bien: value }))}
            />


            <div className="grid grid-cols-2 gap-3">
              <DraftField
                label="Surface habitable"
                type="number"
                suffix="m²"
                value={propertyDraft.surface}
                onChange={(value) => setPropertyDraft((draft) => ({ ...draft, surface: value }))}
              />
              <DraftField
                label="Surface terrain"
                type="number"
                suffix="m²"
                value={propertyDraft.surface_terrain}
                onChange={(value) => setPropertyDraft((draft) => ({ ...draft, surface_terrain: value }))}
              />
            </div>

            <DraftField
              label="Nombre de pièces"
              type="number"
              value={propertyDraft.nb_pieces}
              onChange={(value) => setPropertyDraft((draft) => ({ ...draft, nb_pieces: value }))}
            />

            <div className="border-t pt-3 space-y-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Fourchette d'estimation (€)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <DraftField
                  label="Min"
                  type="number"
                  suffix="€"
                  value={professionalDraft.price_low}
                  onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price_low: value }))}
                  placeholder="Basse"
                />
                <DraftField
                  label="Retenu"
                  type="number"
                  suffix="€"
                  value={professionalDraft.price}
                  onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price: value }))}
                  placeholder="Conseillé"
                />
                <DraftField
                  label="Max"
                  type="number"
                  suffix="€"
                  value={professionalDraft.price_high}
                  onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price_high: value }))}
                  placeholder="Haute"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setPropertyEditOpen(false)} className="rounded-xl font-semibold text-xs cursor-pointer">
              Annuler
            </Button>
            <Button
              onClick={async () => {
                await savePreparation()
                setPropertyEditOpen(false)
              }}
              disabled={savingPreparation}
              className="rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-4 cursor-pointer"
            >
              {savingPreparation ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

}

function InfoCard({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  action: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function DraftSelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span> : null}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl bg-card border-input font-medium text-xs shadow-2xs focus:ring-2 focus:ring-primary/20">
          <SelectValue placeholder="Sélectionner..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium cursor-pointer">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function DraftField({

  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  placeholder?: string
  suffix?: string
}) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span> : null}
      <div className="relative flex items-center">
        <Input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn("h-10 rounded-xl bg-card border-input font-medium text-xs shadow-2xs focus:ring-2 focus:ring-primary/20", suffix ? "pr-8" : "")}
        />
        {suffix && (
          <span className="absolute right-3 text-xs font-bold text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

function DraftArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="bg-card border-input rounded-xl text-xs font-medium resize-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  )
}



function ValuationReportEditor({
  draft,
  setDraft,
}: {
  draft: ProfessionalDraft
  setDraft: React.Dispatch<React.SetStateAction<ProfessionalDraft>>
}) {
  const set = (key: keyof ProfessionalDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }))

  return (
    <div className="mt-6 space-y-6">

      <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold text-xs">
            Avis de valeur complet iad
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">15 rubriques éditables</span>
        </div>
        <p className="text-xs text-muted-foreground font-medium pt-1">
          Données et annexes reprises dans le rapport A4 et le portail client : couverture, cadastre, marché, concurrence, comparables, positionnement, avis et preuves iad.
        </p>
      </div>

      <ReportSection
        title="1. Couverture et destinataire"
        icon={FileText}
        badge="PDF Page 1"
        description="Méta-données du dossier, référence et coordonnées du conseiller"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DraftField label="Titre du rapport" value={draft.report_title} onChange={(value) => set('report_title', value)} />
          <DraftField label="Sous-titre / bien" value={draft.report_subtitle} onChange={(value) => set('report_subtitle', value)} />
          <DraftField label="Date du rapport" value={draft.report_date} onChange={(value) => set('report_date', value)} />
          <DraftField label="Référence" value={draft.report_reference} onChange={(value) => set('report_reference', value)} />
          <DraftField label="Destinataire" value={draft.report_recipient} onChange={(value) => set('report_recipient', value)} />
          <DraftField label="Contexte" value={draft.report_context} onChange={(value) => set('report_context', value)} />
          <DraftField label="Conseiller" value={draft.advisor_name} onChange={(value) => set('advisor_name', value)} />
          <DraftField label="Téléphone conseiller" value={draft.advisor_phone} onChange={(value) => set('advisor_phone', value)} />
          <DraftField label="Email conseiller" value={draft.advisor_email} onChange={(value) => set('advisor_email', value)} />
        </div>
      </ReportSection>

      <ReportSection
        title="2. Plan de situation et cadastre"
        icon={MapPin}
        badge="PDF Page 2"
        description="Localisation cadastrale, contenances et notes de vue aérienne"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <DraftField label="Commune" value={draft.situation_commune} onChange={(value) => set('situation_commune', value)} />
          <DraftField label="Contenance totale" value={draft.cadastral_total} onChange={(value) => set('cadastral_total', value)} />
        </div>
        <DraftArea label="Note plan / vue aérienne" value={draft.situation_plan_note} onChange={(value) => set('situation_plan_note', value)} rows={3} />
        <DraftJsonArea
          label="Informations cadastrales JSON"
          value={draft.cadastral_rows_json}
          onChange={(value) => set('cadastral_rows_json', value)}
          placeholder={'[\n  { "section": "D", "prefixe": "865", "numero": "111", "superficie": "276 m²" }\n]'}
        />
      </ReportSection>

      <ReportSection
        title="3. Présentation du bien"
        icon={Home}
        badge="PDF Page 3"
        description="Titre de la fiche, caractéristiques clés, atouts et points à défendre"
      >
        <DraftField label="Titre de présentation" value={draft.property_presentation_title} onChange={(value) => set('property_presentation_title', value)} />
        <DraftJsonArea
          label="Caractéristiques clés JSON"
          value={draft.property_stats_json}
          onChange={(value) => set('property_stats_json', value)}
          placeholder={'[\n  { "label": "Surface", "value": "125 m²" },\n  { "label": "Pièces", "value": "5" }\n]'}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <DraftArea label="Points forts" value={draft.strengths} onChange={(value) => set('strengths', value)} rows={5} />
          <DraftArea label="Points à défendre" value={draft.objections} onChange={(value) => set('objections', value)} rows={5} />
        </div>
      </ReportSection>

      <ReportSection
        title="4. Tendance du marché local"
        icon={TrendingUp}
        badge="PDF Page 4"
        description="Données statistiques du secteur, prix/m² et délais d'écoulement"
      >
        <DraftArea label="Base de l’étude" value={draft.market_basis} onChange={(value) => set('market_basis', value)} rows={3} />
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Prix/m² bas (€)" type="number" value={draft.market_price_per_sqm_low} onChange={(value) => set('market_price_per_sqm_low', value)} />
          <DraftField label="Prix/m² médian (€)" type="number" value={draft.market_price_per_sqm_median} onChange={(value) => set('market_price_per_sqm_median', value)} />
          <DraftField label="Prix/m² haut (€)" type="number" value={draft.market_price_per_sqm_high} onChange={(value) => set('market_price_per_sqm_high', value)} />
          <DraftField label="Filtre prix/m²" value={draft.market_price_filter} onChange={(value) => set('market_price_filter', value)} />
          <DraftField label="Délai rapide (jours)" type="number" value={draft.sale_delay_fast} onChange={(value) => set('sale_delay_fast', value)} />
          <DraftField label="Délai médian (jours)" type="number" value={draft.sale_delay_median} onChange={(value) => set('sale_delay_median', value)} />
          <DraftField label="Délai lent (jours)" type="number" value={draft.sale_delay_slow} onChange={(value) => set('sale_delay_slow', value)} />
        </div>
        <DraftJsonArea
          label="Évolution des prix JSON"
          value={draft.market_evolution_json}
          onChange={(value) => set('market_evolution_json', value)}
          placeholder={'[\n  { "period": "T2 2026", "median": 4143, "change": 3.51 }\n]'}
        />
      </ReportSection>

      <ReportSection
        title="5. Analyse de la concurrence"
        icon={BarChart3}
        badge="PDF Page 5"
        description="Offre active sur le secteur et données comparatives d'opportunités"
      >
        <DraftArea label="Critères de sélection" value={draft.competition_criteria} onChange={(value) => set('competition_criteria', value)} rows={4} />
        <DraftArea label="Méthodologie iad" value={draft.competition_methodology} onChange={(value) => set('competition_methodology', value)} rows={5} />
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Biens retenus" type="number" value={draft.competition_retained_count} onChange={(value) => set('competition_retained_count', value)} />
          <DraftField label="Bien en vente moyen (€)" type="number" value={draft.active_average_price} onChange={(value) => set('active_average_price', value)} />
          <DraftField label="Bien en vente (€/m²)" type="number" value={draft.active_average_price_per_sqm} onChange={(value) => set('active_average_price_per_sqm', value)} />
          <DraftField label="Bien vendu moyen (€)" type="number" value={draft.sold_average_price} onChange={(value) => set('sold_average_price', value)} />
          <DraftField label="Bien vendu (€/m²)" type="number" value={draft.sold_average_price_per_sqm} onChange={(value) => set('sold_average_price_per_sqm', value)} />
        </div>
      </ReportSection>

      <ReportSection
        title="6. Comparables vendus"
        icon={Scale}
        badge="PDF Page 6"
        description="Ventes réelles enregistrées sur le marché local récent"
      >
        <DraftJsonArea
          label="Comparables vendus JSON"
          value={draft.comparables_json}
          onChange={(value) => set('comparables_json', value)}
          rows={8}
          placeholder={'[\n  { "title": "Maison 7 p. 121 m²", "price": 431600, "price_per_sqm": 3567, "address": "4 Vallon des Eaux Vives", "status": "Vendu", "date_label": "il y a 10 mois" }\n]'}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Moyenne sélection €/m²" type="number" value={draft.comparables_summary_average_per_sqm} onChange={(value) => set('comparables_summary_average_per_sqm', value)} />
          <DraftField label="Prix bas €/m²" type="number" value={draft.comparables_summary_low_per_sqm} onChange={(value) => set('comparables_summary_low_per_sqm', value)} />
          <DraftField label="Prix haut €/m²" type="number" value={draft.comparables_summary_high_per_sqm} onChange={(value) => set('comparables_summary_high_per_sqm', value)} />
        </div>
      </ReportSection>

      <ReportSection
        title="7. Positionnement de votre bien"
        icon={Target}
        badge="PDF Page 7"
        description="Classement prix/m² et positionnement stratégique sur le marché"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Prix de référence (€)" type="number" value={draft.positioning_reference_price} onChange={(value) => set('positioning_reference_price', value)} />
          <DraftField label="Prix de référence (€/m²)" type="number" value={draft.positioning_reference_price_per_sqm} onChange={(value) => set('positioning_reference_price_per_sqm', value)} />
          <DraftField label="% moins chers" type="number" value={draft.positioning_cheaper_percent} onChange={(value) => set('positioning_cheaper_percent', value)} />
          <DraftField label="% plus grands" type="number" value={draft.positioning_larger_percent} onChange={(value) => set('positioning_larger_percent', value)} />
          <DraftField label="% moins chers et plus grands" type="number" value={draft.positioning_cheaper_larger_percent} onChange={(value) => set('positioning_cheaper_larger_percent', value)} />
          <DraftField label="Prix moyen concurrence (€/m²)" type="number" value={draft.positioning_competition_average_per_sqm} onChange={(value) => set('positioning_competition_average_per_sqm', value)} />
          <DraftField label="Fourchette basse (€/m²)" type="number" value={draft.positioning_low_per_sqm} onChange={(value) => set('positioning_low_per_sqm', value)} />
          <DraftField label="Médiane (€/m²)" type="number" value={draft.positioning_median_per_sqm} onChange={(value) => set('positioning_median_per_sqm', value)} />
          <DraftField label="Fourchette haute (€/m²)" type="number" value={draft.positioning_high_per_sqm} onChange={(value) => set('positioning_high_per_sqm', value)} />
          <DraftField label="Rang prix/m²" type="number" value={draft.positioning_rank} onChange={(value) => set('positioning_rank', value)} />
          <DraftField label="Total concurrence" type="number" value={draft.positioning_rank_total} onChange={(value) => set('positioning_rank_total', value)} />
          <DraftField label="Seuil 10% moins chers (€)" type="number" value={draft.positioning_threshold_low_price} onChange={(value) => set('positioning_threshold_low_price', value)} />
          <DraftField label="Prix médian (€)" type="number" value={draft.positioning_threshold_median_price} onChange={(value) => set('positioning_threshold_median_price', value)} />
          <DraftField label="Seuil 10% plus chers (€)" type="number" value={draft.positioning_threshold_high_price} onChange={(value) => set('positioning_threshold_high_price', value)} />
        </div>
      </ReportSection>

      <ReportSection
        title="8. Recommandations et conclusion"
        icon={CheckCircle2}
        badge="PDF Page 8"
        description="Avis motivé, préconisations de mise en vente et mentions légales"
      >
        <DraftArea label="Mes recommandations" value={draft.recommendations} onChange={(value) => set('recommendations', value)} rows={4} />
        <DraftArea label="Conclusion" value={draft.conclusion_text} onChange={(value) => set('conclusion_text', value)} rows={5} />
        <DraftArea label="Avertissement légal" value={draft.legal_notice} onChange={(value) => set('legal_notice', value)} rows={3} />
      </ReportSection>

      <ReportSection
        title="9. Preuves iad : biens vendus et avis clients"
        icon={Award}
        badge="PDF Page 9"
        description="Références de transactions réalisées et témoignages de satisfaction"
      >
        <DraftJsonArea
          label="Nos biens vendus JSON"
          value={draft.iad_sold_properties_json}
          onChange={(value) => set('iad_sold_properties_json', value)}
          rows={6}
          placeholder={'[\n  { "title": "Maison 5 p. 110 m²", "address": "122 Chemin du Vallon des Escourtines", "price": 359000, "price_per_sqm": 3264, "date_label": "il y a un an" }\n]'}
        />
        <DraftJsonArea
          label="Avis clients JSON"
          value={draft.client_reviews_json}
          onChange={(value) => set('client_reviews_json', value)}
          rows={6}
          placeholder={'[\n  { "title": "Sympathique et bienveillant", "author": "JessicaR", "rating": 5, "date": "3 juillet 2026", "content": "..." }\n]'}
        />
      </ReportSection>

      <ReportSection
        title="10. Les + iad et services iad"
        icon={Sparkles}
        badge="PDF Page 10"
        description="Avantages réseau, stratégie de commercialisation et gamme de services"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <DraftArea label="Les + iad" value={draft.iad_advantages} onChange={(value) => set('iad_advantages', value)} rows={5} />
          <DraftArea label="Les services iad" value={draft.iad_services} onChange={(value) => set('iad_services', value)} rows={5} />
        </div>
      </ReportSection>

      <ReportSection
        title="11. Contexte socio-économique"
        icon={Users}
        badge="PDF Annexe 11"
        description="Démographie locale, revenus des ménages et profils acquéreurs typiques"
      >
        <DraftJsonArea
          label="Contexte socio-économique JSON"
          value={draft.socio_economic_json}
          onChange={(value) => set('socio_economic_json', value)}
          rows={8}
          placeholder={'{\n  "population": 4820, "households": 2140, "median_income": 2380, "interest_rate": 3.85,\n  "buyer_profiles": [\n    { "type": "COUPLE", "interested_in": "35% – Recherche T3", "budget_low": 180000, "budget_high": 240000, "income_low": 2900, "income_high": 3600 }\n  ]\n}'}
        />
      </ReportSection>

      <ReportSection
        title="12. Répartition, tendance et tension du marché"
        icon={Activity}
        badge="PDF Annexe 12"
        description="Tensiomètre immobilier, carte de tendance et répartition typologique"
      >
        <div className="space-y-4">
          <DraftJsonArea
            label="Répartition du marché JSON"
            value={draft.market_distribution_json}
            onChange={(value) => set('market_distribution_json', value)}
            rows={6}
          />
          <DraftJsonArea
            label="Tendance du marché JSON"
            value={draft.market_trend_json}
            onChange={(value) => set('market_trend_json', value)}
            rows={6}
          />
          <DraftJsonArea
            label="Tension du marché JSON"
            value={draft.market_tension_json}
            onChange={(value) => set('market_tension_json', value)}
            rows={6}
          />
        </div>
      </ReportSection>

      <ReportSection
        title="13. Biens en concurrence et invendus"
        icon={Building2}
        badge="PDF Annexe 13"
        description="Inventaire des opportunités concurrentes en cours et offres retirées"
      >
        <div className="space-y-4">
          <DraftJsonArea
            label="Biens en concurrence JSON"
            value={draft.comparables_competing_json}
            onChange={(value) => set('comparables_competing_json', value)}
            rows={6}
          />
          <DraftJsonArea
            label="Biens invendus JSON"
            value={draft.comparables_unsold_json}
            onChange={(value) => set('comparables_unsold_json', value)}
            rows={5}
          />
        </div>
      </ReportSection>

      <ReportSection
        title="14. Positionnement étendu et synthèse des prix"
        icon={Calculator}
        badge="PDF Annexe 14"
        description="Classement par tranche de prix et synthèse croisée des 3 méthodes d'évaluation"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <DraftJsonArea
            label="Positionnement étendu JSON"
            value={draft.positioning_extended_json}
            onChange={(value) => set('positioning_extended_json', value)}
            rows={5}
          />
          <DraftJsonArea
            label="Synthèse des prix JSON"
            value={draft.synthesis_json}
            onChange={(value) => set('synthesis_json', value)}
            rows={5}
          />
        </div>
      </ReportSection>

      <ReportSection
        title="15. Biens vendus par iad (Portail Client)"
        icon={Globe}
        badge="Portail Client"
        description="Alimente directement la vitrine « Nos biens vendus » du portail autonomie client"
      >
        <DraftJsonArea
          label="Biens vendus par iad (Track record portail) JSON"
          value={draft.track_record_json}
          onChange={(value) => set('track_record_json', value)}
          rows={6}
          placeholder={'[\n  { "id": "tr-1", "title": "Villa T5", "address": "...", "price": 340000, "price_per_sqm": 3200, "sold_date": "2026-05", "type": "Maison" }\n]'}
        />
      </ReportSection>
    </div>

  )
}

function PendingEstimationImportBanner({
  pendingImport,
  overwriteEditorial,
  setOverwriteEditorial,
  applying,
  rejecting,
  onApply,
  onReject,
}: {
  pendingImport: PendingEstimationImport
  overwriteEditorial: boolean
  setOverwriteEditorial: (value: boolean) => void
  applying: boolean
  rejecting: boolean
  onApply: () => void
  onReject: () => void
}) {
  const detectedSections = detectImportSections(pendingImport.payload)
  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Import d’estimation en attente</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Source : {pendingImport.source} · reçu {formatDateTime(pendingImport.created_at)}
            {pendingImport.confidence != null ? ` · confiance ${Math.round(pendingImport.confidence * 100)}%` : ''}
          </p>
          {pendingImport.summary ? <p className="mt-2 text-sm">{pendingImport.summary}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatPrice(pendingImport.price_low)} – {formatPrice(pendingImport.price_high)}
            {pendingImport.price_m2 ? ` · ${formatNumber(pendingImport.price_m2, ' €/m²')}` : ''}
          </p>
          {detectedSections.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Sections détectées : {detectedSections.join(' · ')}</p>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={overwriteEditorial} onCheckedChange={(checked) => setOverwriteEditorial(checked === true)} />
            Écraser aussi la présentation, les points forts/à défendre et la conclusion déjà rédigés
          </label>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onApply} disabled={applying || rejecting}>
              {applying ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 size-3.5" />}
              Appliquer l’import
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={applying || rejecting}>
              {rejecting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <XCircle className="mr-1 size-3.5" />}
              Rejeter
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function detectImportSections(payload: Record<string, unknown>) {
  const labels: string[] = []
  if (isNonEmptyObject(payload.socio_economic)) labels.push('contexte socio-éco')
  const market = isRecord(payload.market) ? payload.market : {}
  if (isNonEmptyObject(market.distribution)) labels.push('répartition marché')
  if (isNonEmptyObject(market.trend)) labels.push('tendance')
  if (isNonEmptyObject(market.tension)) labels.push('tension')
  const comparables = isRecord(payload.comparables) ? payload.comparables : {}
  if (Array.isArray(comparables.competing) && comparables.competing.length > 0) labels.push(`${comparables.competing.length} en concurrence`)
  if (Array.isArray(comparables.unsold) && comparables.unsold.length > 0) labels.push(`${comparables.unsold.length} invendus`)
  if (isNonEmptyObject(payload.positioning)) labels.push('positionnement')
  if (isNonEmptyObject(payload.synthesis)) labels.push('synthèse 3 méthodes')
  if (Array.isArray(payload.track_record) && payload.track_record.length > 0) labels.push(`${payload.track_record.length} biens vendus iad`)
  return labels
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyObject(value: unknown) {
  return isRecord(value) && Object.keys(value).length > 0
}

function ReportSection({
  title,
  icon: Icon = FileText,
  badge,
  description,
  children,
}: {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Icon className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">{title}</h3>
              {badge && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                  {badge}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
      {children}
    </section>
  )
}

function DraftJsonArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground border-border bg-muted/20">
          Données JSON
        </Badge>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-xl bg-background border-input font-mono text-xs p-3.5 leading-relaxed focus-visible:ring-primary shadow-xs"
      />
    </div>
  )
}


function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  )
}

function EmptyCardText({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</div>
}

function PropertyThumbnail({ title, url }: { title?: string | null; url?: string | null }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-lg border bg-muted/30">
      {url ? (
        <div
          aria-label={title ?? 'Miniature du bien'}
          className="h-full w-full bg-cover bg-center"
          role="img"
          style={{ backgroundImage: `url("${url}")` }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Home className="size-8" />
        </div>
      )}
    </div>
  )
}

/**
 * Auteur d'un événement, en clair.
 *
 * `created_by` porte le canal de saisie (`telegram`, `admin`…), utile pour
 * l'audit mais pas dans une fiche : ce qui compte est de distinguer ce
 * qu'Alexandre a écrit de ce que l'assistant a produit.
 */
function authorLabel(createdBy: string | null) {
  if (!createdBy) return null
  if (createdBy === 'admin' || createdBy === 'telegram') return 'Alexandre'
  if (createdBy.startsWith('assistant')) return 'Assistant IA'
  return createdBy
}

function ActivityRow({ event, action, onEdit }: { event: OpportunityEvent; action?: React.ReactNode; onEdit?: (event: OpportunityEvent) => void }) {
  const config = EVENT_CONFIG[event.type]
  const Icon = config.icon
  return (
    <div 
      className={cn("rounded-lg border p-3 transition-colors", onEdit && "cursor-pointer hover:bg-muted/50")}
      onClick={() => onEdit?.(event)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-[10px]', config.className)}>
              <Icon className="mr-1 size-3" /> {config.label}
            </Badge>
            <p className="font-medium">{event.title || config.label}</p>
          </div>
          {event.content && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{event.content}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {event.due_at && <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Échéance : {formatDateTime(event.due_at)}</span>}
            {authorLabel(event.created_by) && <span>{authorLabel(event.created_by)}</span>}
            {event.completed_at && <span>Terminée le {formatDateTime(event.completed_at)}</span>}
          </div>
          {formatStamp(event.created_at) && (
            <p className="mt-2 text-xs text-muted-foreground/70">
              Créée le {formatStamp(event.created_at)}
            </p>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      </div>
    </div>
  )
}

function EventActions({
  event,
  deleting,
  onEdit,
  onDelete,
}: {
  event: OpportunityEvent
  deleting?: boolean
  onEdit: (event: OpportunityEvent) => void
  onDelete: (event: OpportunityEvent) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => onEdit(event)}>
        <Edit className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(event)} disabled={deleting}>
        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  )
}

function Timeline({
  events,
  emptyText,
  onEdit,
  onDelete,
  deletingEventId,
}: {
  events: OpportunityEvent[]
  emptyText: string
  onEdit: (event: OpportunityEvent) => void
  onDelete: (event: OpportunityEvent) => void
  deletingEventId: string | null
}) {
  if (events.length === 0) {
    return <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-xs font-medium text-muted-foreground">{emptyText}</div>
  }

  return (
    <div className="mt-4 space-y-1">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1
        return (
          <div key={event.id} className="flex gap-3 group">
            {/* Left Axis Column: Perfectly centered Dot & Connecting Line */}
            <div className="flex flex-col items-center shrink-0 w-5">
              <div
                className="z-10 mt-3.5 size-3.5 rounded-full border-2 border-background bg-primary ring-4 ring-primary/15 shadow-2xs shrink-0 transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              {!isLast && (
                <div
                  className="w-0.5 flex-1 bg-border/60 group-hover:bg-primary/30 transition-colors my-1"
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Right Card Content */}
            <div className="flex-1 pb-3.5">
              <ActivityRow
                event={event}
                onEdit={onEdit}
                action={
                  <EventActions
                    event={event}
                    deleting={deletingEventId === event.id}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                }
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}



function EventDialog({
  open,
  draft,
  saving,
  editing,
  leadInfo,
  propertyInfo,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  open: boolean
  draft: EventDraft
  saving: boolean
  editing: boolean
  leadInfo?: LeadInfo | null
  propertyInfo?: any
  onOpenChange: (open: boolean) => void
  onDraftChange: (draft: EventDraft) => void
  onSubmit: () => void
}) {
  const config = EVENT_CONFIG[draft.type]
  const showDue = ['task', 'call', 'meeting'].includes(draft.type)
  const showMilestone = draft.type === 'estimation'
  const showOccurredAt = showMilestone

  const [masterTemplates, setMasterTemplates] = useState<RdvTemplatesMap>(DEFAULT_RDV_TEMPLATES)

  useEffect(() => {
    if (open && draft.type === 'meeting') {
      fetch('/api/market/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data?.settings?.rdv_templates) {
            setMasterTemplates(parseRdvTemplates(data.settings.rdv_templates))
          }
        })
        .catch(() => {})
    }
  }, [open, draft.type])

  const clientFirstName = leadInfo?.prospect?.first_name || 'Monsieur/Madame'
  const clientLastName = leadInfo?.prospect?.last_name || ''
  const propertyAddress = [propertyInfo?.address, propertyInfo?.city].filter(Boolean).join(', ') || 'Votre bien'

  const formattedDate = draft.due_at ? new Date(draft.due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '[Date]'
  const formattedTime = draft.due_at ? new Date(draft.due_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '[Heure]'
  const currentTypeLabel = MEETING_TYPES.find((t) => t.value === draft.meeting_type)?.label || 'Rendez-vous'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6 border bg-card">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-foreground">
            {config.label}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ajoute une activité à la timeline de cette opportunité.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {draft.type === 'meeting' && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type de rendez-vous</span>
              <Select
                value={draft.meeting_type || 'rendez_vous_r1'}
                onValueChange={(value) => {
                  const tpl = masterTemplates[value] ?? DEFAULT_RDV_TEMPLATES[value]
                  const newTitle = tpl?.title || ''
                  const newSmsBody = tpl?.sms_template || ''
                  const newSmsHours = tpl?.sms_reminder_hours ?? 24
                  onDraftChange({
                    ...draft,
                    meeting_type: value,
                    title: newTitle,
                    sms_body: newSmsBody,
                    sms_reminder_hours: newSmsHours,
                  })
                }}
              >
                <SelectTrigger className="h-10 rounded-xl bg-card border-input font-semibold text-xs cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_TYPES.map((type) => {
                    const Icon = type.icon
                    return (
                      <SelectItem key={type.value} value={type.value} className="text-xs cursor-pointer font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-primary shrink-0" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {showMilestone ? (
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Jalon</span>
              <Select value={draft.milestone} onValueChange={(value) => onDraftChange({ ...draft, milestone: value })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{ESTIMATION_MILESTONES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {draft.type === 'meeting' ? 'Intitulé du rendez-vous' : 'Titre'}
              </span>
              <Input
                value={draft.title}
                onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
                className="h-10 rounded-xl text-xs font-medium"
                placeholder={draft.type === 'meeting' ? 'ex: Rendez-vous découverte (R1)' : 'ex: Relancer le vendeur'}
              />
            </div>
          )}

          {draft.type === 'meeting' && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={draft.send_sms_reminder ?? true}
                    onCheckedChange={(checked) => onDraftChange({ ...draft, send_sms_reminder: Boolean(checked) })}
                    id="sms_reminder_toggle"
                  />
                  <span className="text-xs font-bold text-foreground">Automatisation : Rappel SMS</span>
                </label>
                <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold text-[10px]">
                  📱 SMS Client
                </Badge>
              </div>

              {draft.send_sms_reminder !== false && (
                <div className="pt-1">
                  <LiquidTemplateEditor
                    label="Message SMS (Ajustable pour ce rendez-vous)"
                    value={draft.sms_body ?? ''}
                    onChange={(newSms) => onDraftChange({ ...draft, sms_body: newSms })}
                    rows={5}
                    clientData={{
                      first_name: clientFirstName,
                      last_name: clientLastName,
                      date: formattedDate,
                      time: formattedTime,
                      type: currentTypeLabel,
                      address: propertyAddress,
                      agent_name: 'Alexandre Lopez',
                    }}
                  />
                </div>
              )}
            </div>
          )}



          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Détails</span>
            <Textarea
              value={draft.content}
              onChange={(e) => onDraftChange({ ...draft, content: e.target.value })}
              rows={4}
              className="rounded-xl"
              placeholder="Compte rendu, objectif, précision utile..."
            />
          </div>

          {(showOccurredAt || showDue) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {showOccurredAt && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date du jalon</span>
                  <Input
                    type="datetime-local"
                    step="300"
                    value={draft.occurred_at}
                    onChange={(e) => onDraftChange({ ...draft, occurred_at: e.target.value })}
                    className="h-10 rounded-xl text-xs font-medium"
                  />
                </div>
              )}
              {showDue && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {draft.type === 'meeting' ? 'Date du rendez-vous' : "Date de l’échéance"}
                  </span>
                  <Input
                    type="datetime-local"
                    step="300"
                    value={draft.due_at}
                    onChange={(e) => onDraftChange({ ...draft, due_at: e.target.value })}
                    className="h-10 rounded-xl text-xs font-medium"
                  />
                </div>
              )}
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl font-semibold text-xs h-9 px-4 border-border bg-card hover:bg-accent text-foreground cursor-pointer">
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="rounded-xl font-bold text-xs h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs cursor-pointer">
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            {editing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}

function LeadAttachDialog({
  open,
  rows,
  search,
  loading,
  attachingId,
  opportunityId,
  onOpenChange,
  onSearchChange,
  onAttach,
  onAttachNewProject,
  onOpenOpportunity,
}: {
  open: boolean
  rows: LeadSearchRow[]
  search: string
  loading: boolean
  attachingId: string | null
  opportunityId: string
  onOpenChange: (open: boolean) => void
  onSearchChange: (value: string) => void
  onAttach: (lead: LeadSearchRow) => void
  onAttachNewProject: (lead: LeadSearchRow) => void
  onOpenOpportunity: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl rounded-2xl p-6 border bg-card">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-foreground">Ajouter un contact</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Recherche dans les contacts vendeurs déjà présents.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Nom, téléphone, email..." className="pl-9 h-10 rounded-xl" />
          </div>
          <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-xl border p-2 bg-background">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement...</div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun contact trouvé</p>
            ) : rows.map((lead) => {
              const alreadyLinked = lead.opportunity && lead.opportunity.id !== opportunityId
              return (
                <div key={lead.id} className="rounded-xl border p-3 bg-card hover:border-primary/40 transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-sm text-foreground">{leadOptionName(lead)}</p>
                        {alreadyLinked && <Badge variant="secondary" className="text-[10px]">déjà lié</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {lead.prospect.phone && <span>{lead.prospect.phone}</span>}
                        {lead.prospect.email && <span>{lead.prospect.email}</span>}
                        {lead.commune && <span>{lead.commune}</span>}
                        {lead.seller_property?.type_bien && <span>{lead.seller_property.type_bien}</span>}
                      </div>
                    </div>
                    {alreadyLinked ? (
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => onOpenOpportunity(lead.opportunity!.id)}>Voir l’opportunité</Button>
                        <Button size="sm" onClick={() => onAttachNewProject(lead)} disabled={attachingId === lead.id} className="bg-primary hover:bg-primary/90 text-white rounded-full text-xs">
                          {attachingId === lead.id ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Plus className="mr-1 size-3.5" />}
                          Nouveau projet
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => onAttach(lead)} disabled={attachingId === lead.id} className="bg-primary hover:bg-primary/90 text-white rounded-full text-xs">
                        {attachingId === lead.id ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Link2 className="mr-1 size-3.5" />}
                        Ajouter
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold text-xs h-9 px-4 border-border bg-card hover:bg-accent text-foreground cursor-pointer">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function PropertyAttachDialog({
  open,
  rows,
  search,
  typeFilter,
  statusFilter,
  loading,
  attachingId,
  opportunityId,
  onOpenChange,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onAttach,
  onOpenOpportunity,
}: {
  open: boolean
  rows: PropertySearchRow[]
  search: string
  typeFilter: string
  statusFilter: string
  loading: boolean
  attachingId: string | null
  opportunityId: string
  onOpenChange: (open: boolean) => void
  onSearchChange: (value: string) => void
  onTypeFilterChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onAttach: (property: PropertySearchRow) => void
  onOpenOpportunity: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-2xl p-6 border bg-card">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-foreground">Ajouter un bien</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Recherche uniquement dans les biens déjà présents en base.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_140px]">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recherche</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Titre, commune, CP..." className="pl-9 h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</span>
              <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-medium">
                <option value="">Tous</option>
                {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Statut</span>
              <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-medium">
                <option value="">Tous</option>
                <option value="active">En ligne</option>
                <option value="online">Online</option>
                <option value="expired">Expiré</option>
                <option value="opportunity">Opportunité</option>
              </select>
            </div>
          </div>

          <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-xl border p-2 bg-background">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement...</div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun bien trouvé</p>
            ) : rows.map((property) => {
              const alreadyLinked = property.opportunity && property.opportunity.id !== opportunityId
              return (
                <div key={property.id} className="rounded-xl border p-3 bg-card hover:border-primary/40 transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
                        {property.thumbnail_url ? (
                          <div
                            aria-label={property.title ?? 'Miniature du bien'}
                            className="h-full w-full bg-cover bg-center"
                            role="img"
                            style={{ backgroundImage: `url("${property.thumbnail_url}")` }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Home className="size-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="line-clamp-1 font-bold text-sm text-foreground">{property.title ?? 'Bien en annonce'}</p>
                          {property.status && <Badge variant="outline" className="text-[10px]">{property.status}</Badge>}
                          {alreadyLinked && <Badge variant="secondary" className="text-[10px]">déjà lié</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {[property.property_type, property.city, property.zipcode].filter(Boolean).map((item) => <span key={item}>{item}</span>)}
                          <span>{formatPrice(property.price)}</span>
                          <span>{formatNumber(property.surface, ' m²')}</span>
                          {property.seller_type && <span>{property.seller_type}</span>}
                        </div>
                      </div>
                    </div>
                    {alreadyLinked ? (
                      <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => onOpenOpportunity(property.opportunity!.id)}>Voir l’opportunité</Button>
                    ) : (
                      <Button size="sm" onClick={() => onAttach(property)} disabled={attachingId === property.id} className="bg-primary hover:bg-primary/90 text-white rounded-full text-xs">
                        {attachingId === property.id ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Link2 className="mr-1 size-3.5" />}
                        Ajouter
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold text-xs h-9 px-4 border-border bg-card hover:bg-accent text-foreground cursor-pointer">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


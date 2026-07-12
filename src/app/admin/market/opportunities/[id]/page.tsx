'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Edit,
  Eye,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Rocket,
  Search,
  StickyNote,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { DossierWorkspace } from '../../clients/DossierWorkspace'
import { isPortalEligibleStage } from '@/lib/market/seller-stages'
import type { OpportunityEventType } from '@/types/supabase'

type Priority = 'low' | 'medium' | 'high' | 'critical'

interface OpportunityEvent {
  id: string
  opportunity_id: string
  type: OpportunityEventType
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
  property_city: string | null
  property_type: string | null
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
  type: OpportunityEventType
  title: string
  content: string
  due_at: string
  occurred_at: string
  milestone: string
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
}

const STAGES = [
  'Veille annonce',
  'Nouveau contact',
  'Pré-estimation',
  "Visite d'estimation",
  "Remise de l'estimation",
  'Décision vendeur',
  'Suivi moyen terme',
  'Mandat signé',
  'Vendu',
  'Perdu / Écarté',
]

const CLIENT_DOSSIER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

const EVENT_CONFIG: Record<OpportunityEventType, { label: string; icon: typeof StickyNote; className: string }> = {
  note: { label: 'Note', icon: StickyNote, className: 'bg-slate-50 text-slate-700 border-slate-200' },
  task: { label: 'Tâche', icon: CheckCircle2, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  call: { label: 'Appel', icon: Phone, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  meeting: { label: 'RDV', icon: Calendar, className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
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
}

function emptyEventDraft(type: OpportunityEventType): EventDraft {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return {
    type,
    title: type === 'task' ? 'Nouvelle tâche' : '',
    content: '',
    due_at: '',
    occurred_at: now.toISOString().slice(0, 16),
    milestone: 'pre_estimation',
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

function isClientPortalEstimationPublished(opportunity: Opportunity | null) {
  return asRecord(opportunity?.professional_opinion).client_portal_published === true
}

function eventDate(event: OpportunityEvent) {
  return event.due_at ?? event.occurred_at ?? event.created_at
}

function isUserEditableProperty(property: PropertyInfo | null) {
  return property?.source === 'manual' || property?.source === 'user'
}

function milestoneRows(opportunity: Opportunity) {
  return [
    { label: 'Estimation réalisée', value: formatDate(opportunity.pre_estimation_done_at) },
    {
      label: 'Prochaine action',
      value: opportunity.next_action
        ? `${opportunity.next_action}${opportunity.due_date ? ` · ${formatDate(opportunity.due_date)}` : ''}`
        : '—',
    },
  ]
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
      },
      conclusion: {
        recommendations,
        text: draft.conclusion_text.trim() || null,
        legal_notice: draft.legal_notice.trim() || null,
      },
      iad_proof: {
        sold_properties: parseJsonArray(draft.iad_sold_properties_json, 'Nos biens vendus'),
        client_reviews: parseJsonArray(draft.client_reviews_json, 'Avis clients'),
      },
      services: {
        advantages: draft.iad_advantages.split('\n').map((line) => line.trim()).filter(Boolean),
        services: draft.iad_services.split('\n').map((line) => line.trim()).filter(Boolean),
      },
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
    () => [...(opportunity?.events ?? [])].sort((a, b) => new Date(eventDate(b)).getTime() - new Date(eventDate(a)).getTime()),
    [opportunity?.events],
  )
  const upcomingEvents = useMemo(
    () => events
      .filter((event) => ['task', 'call', 'meeting'].includes(event.type) && !event.completed_at)
      .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime()),
    [events],
  )
  const recentEvents = events.slice(0, 6)

  function openEvent(type: OpportunityEventType) {
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
    if (!opportunity || stage === opportunity.stage) return
    setSavingStage(true)
    try {
      const res = await fetch('/api/market/opportunities/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur API')
      setOpportunity({ ...data.opportunity, events: data.opportunity.events ?? [] })
      toast.success('Étape mise à jour')
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
            occurred_at: eventDraft.occurred_at || null,
            metadata: eventDraft.type === 'estimation' ? { milestone: eventDraft.milestone } : {},
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
      toast.error('Impossible d’enregistrer l’activité')
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
      toast.success('Opportunité supprimée')
      router.push('/app/opportunities')
    } catch (err) {
      console.error('[OpportunityDetailPage] delete opportunity:', err)
      toast.error("Impossible de supprimer l'opportunité")
    } finally {
      setDeletingOpportunity(false)
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
            ? { label: 'Ouvrir', onClick: () => router.push(`/app/opportunities/${data.existing_opportunity.id}`) }
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
            ? { label: 'Ouvrir', onClick: () => router.push(`/app/opportunities/${data.existing_opportunity.id}`) }
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
        <p className="text-muted-foreground">Opportunité introuvable</p>
        <Button variant="outline" onClick={() => router.push('/app/opportunities')}>Retour</Button>
      </div>
    )
  }

  const currentStage = opportunity.stage ?? STAGES[0]
  const stageIndex = Math.max(0, STAGES.indexOf(currentStage))
  const progress = Math.max(8, ((stageIndex + 1) / STAGES.length) * 100)
  const editableProperty = isUserEditableProperty(opportunity.property)
  const estimationPublished = isClientPortalEstimationPublished(opportunity)
  const estimate = opportunity.estimated_price_min || opportunity.estimated_price_max
    ? [opportunity.estimated_price_min, opportunity.estimated_price_max].filter((value): value is number => value != null).map(formatPrice).join(' - ')
    : null
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b pb-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/app/opportunities" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Retour aux vendeurs
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl font-bold leading-tight">{opportunity.title ?? 'Opportunité vendeur'}</h1>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Opportunité vendeur
            </Badge>
            <Badge variant="outline">{currentStage}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>Créée le {formatDate(opportunity.created_at)}</span>
            {opportunity.source_channel && <span>{opportunity.source_channel}</span>}
            {estimate && <span>{estimate}</span>}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="destructive" className="w-full sm:w-auto" onClick={deleteOpportunity} disabled={deletingOpportunity}>
            {deletingOpportunity ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
            Supprimer
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-full shrink-0 bg-primary hover:bg-primary/90 sm:w-auto">
                <Plus className="mr-2 size-4" />
                Ajouter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => openEvent('note')}><StickyNote className="mr-2 size-4" /> Ajouter une note</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEvent('task')}><CheckCircle2 className="mr-2 size-4" /> Ajouter une tâche</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEvent('call')}><Phone className="mr-2 size-4" /> Planifier un appel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEvent('meeting')}><Calendar className="mr-2 size-4" /> Planifier un RDV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEvent('email')}><Mail className="mr-2 size-4" /> Logguer un email</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEvent('estimation')}><Building2 className="mr-2 size-4" /> Ajouter une étape estimation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
        >
          <TabsTrigger value="overview" className="min-h-10 flex-none rounded-md px-4 py-2 text-muted-foreground after:hidden data-active:bg-background data-active:text-brand data-active:shadow-sm sm:flex-1">Vue d’ensemble</TabsTrigger>
          <TabsTrigger value="estimation" className="min-h-10 flex-none rounded-md px-4 py-2 text-muted-foreground after:hidden data-active:bg-background data-active:text-brand data-active:shadow-sm sm:flex-1">Estimation</TabsTrigger>
          <TabsTrigger value="dossier" className="min-h-10 flex-none rounded-md px-4 py-2 text-muted-foreground after:hidden data-active:bg-background data-active:text-brand data-active:shadow-sm sm:flex-1">Suivi client</TabsTrigger>
          <TabsTrigger value="history" className="min-h-10 flex-none rounded-md px-4 py-2 text-muted-foreground after:hidden data-active:bg-background data-active:text-brand data-active:shadow-sm sm:flex-1">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <main className="space-y-5">
              <section className="rounded-xl border bg-card p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Étape en cours</h2>
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <span className="rounded-md border bg-muted/30 px-2 py-1 font-medium">{stageIndex + 1}/{STAGES.length}</span>
                      <span>{currentStage}</span>
                      {savingStage && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                  <Select value={currentStage} onValueChange={updateStage}>
                    <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ouverte depuis le {formatDate(opportunity.created_at)}.
                </p>

                <div className="mt-5 grid gap-2 sm:grid-cols-4">
                  {milestoneRows(opportunity).map((milestone) => (
                    <div key={milestone.label} className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{milestone.label}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium">{milestone.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border bg-card p-5">
                <h2 className="text-base font-semibold">Activités à venir</h2>
                <div className="mt-4 space-y-3">
                  {upcomingEvents.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                      Aucune activité à venir. Utilise le bouton Ajouter pour créer une tâche, un appel ou un RDV.
                    </div>
                  ) : upcomingEvents.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      action={
                        <EventActions
                          event={event}
                          completing={completingEventId === event.id}
                          deleting={deletingEventId === event.id}
                          onComplete={completeEvent}
                          onEdit={editEvent}
                          onDelete={deleteEvent}
                        />
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-xl border bg-card p-5">
                <h2 className="text-base font-semibold">Historique récent</h2>
                <Timeline events={recentEvents} emptyText="Aucune activité récente." onEdit={editEvent} onDelete={deleteEvent} deletingEventId={deletingEventId} />
              </section>
            </main>

            <aside className="space-y-5">
              <InfoCard
                title="Suivi client"
                icon={<FolderOpen className="size-4" />}
                action={opportunity.client_dossier ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={openClientPortalLinkFromOpportunity} disabled={openingClientLink}>
                      {openingClientLink ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ExternalLink className="mr-1 size-3.5" />}
                      Prévisualiser
                    </Button>
                    <Button variant="outline" size="sm" onClick={copyClientPortalUrlFromOpportunity} disabled={copyingClientLink}>
                      {copyingClientLink ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Copy className="mr-1 size-3.5" />}
                      Copier le lien
                    </Button>
                    <Button variant="outline" size="sm" onClick={inviteClientFromOpportunity} disabled={invitingClient}>
                      {invitingClient ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Mail className="mr-1 size-3.5" />}
                      Donner accès
                    </Button>
                    <Button variant="outline" size="sm" onClick={publishEstimationFromOpportunity} disabled={publishingEstimation || estimationPublished}>
                      {publishingEstimation ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Rocket className="mr-1 size-3.5" />}
                      Publier
                    </Button>
                  </div>
                ) : isPortalEligibleStage(currentStage) ? (
                  <Button variant="outline" size="sm" onClick={createDossier} disabled={creatingDossier}>
                    {creatingDossier ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Plus className="mr-1 size-3.5" />}
                    Créer
                  </Button>
                ) : null}
              >
                {opportunity.client_dossier ? (
                  <div className="space-y-3">
                    <Badge variant="outline" className="text-[11px]">
                      {CLIENT_DOSSIER_STATUS_LABELS[opportunity.client_dossier.status] ?? opportunity.client_dossier.status}
                    </Badge>
                    <Badge variant="outline" className={clientAccessSent ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                      {clientAccessSent ? 'Accès envoyé' : 'Accès à envoyer'}
                    </Badge>
                    <Badge variant="outline" className={estimationPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                      {estimationPublished ? 'Estimation publiée' : 'Estimation non publiée'}
                    </Badge>
                    <p className="text-xs text-muted-foreground">Lien permanent sécurisé : copiez-le pour le client, puis utilisez « Donner accès » au moment de la remise.</p>
                    <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                      <FileText className="size-4 text-primary" />
                      <span>{opportunity.client_dossier.documents_validated}/{opportunity.client_dossier.documents_total} documents validés</span>
                    </div>
                    {opportunity.client_dossier.documents_missing > 0 && (
                      <p className="text-xs text-amber-700">{opportunity.client_dossier.documents_missing} document(s) à traiter</p>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={openClientPortalLinkFromOpportunity} disabled={openingClientLink}>
                      {openingClientLink ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Eye className="mr-1 size-4" />}
                      Prévisualiser l’espace client
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={copyClientPortalUrlFromOpportunity} disabled={copyingClientLink}>
                      {copyingClientLink ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Copy className="mr-1 size-4" />}
                      Copier le lien client
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={publishEstimationFromOpportunity} disabled={publishingEstimation || estimationPublished}>
                      {publishingEstimation ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Rocket className="mr-1 size-4" />}
                      Publier l’estimation dans l’espace client
                    </Button>
                  </div>
                ) : isPortalEligibleStage(currentStage) ? (
                  <EmptyCardText>Suivi client non créé. Crée-le pour obtenir le lien client et préparer le suivi de vente.</EmptyCardText>
                ) : (
                  <EmptyCardText>Le suivi client sera disponible à partir de la remise de l’estimation.</EmptyCardText>
                )}
              </InfoCard>

              <InfoCard
                title="Bien"
                icon={<Home className="size-4" />}
                action={opportunity.property ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/properties/${opportunity.property.id}`}><ExternalLink className="mr-1 size-3.5" /> Ouvrir</Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPropertyDialogOpen(true)}>
                      <Link2 className="mr-1 size-3.5" /> Changer
                    </Button>
                    {editableProperty && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/app/properties/${opportunity.property.id}`}><Edit className="mr-1 size-3.5" /> Modifier</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setPropertyDialogOpen(true)}><Plus className="mr-1 size-3.5" /> Ajouter</Button>
                )}
              >
                {opportunity.property ? (
                  <div className="space-y-3">
                    <PropertyThumbnail title={opportunity.property.title} url={opportunity.property.thumbnail_url} />
                    <div>
                      <p className="line-clamp-2 font-medium">{opportunity.property.title ?? 'Bien en annonce'}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {opportunity.property.city && <span>{opportunity.property.city}</span>}
                        {opportunity.property.zipcode && <span>{opportunity.property.zipcode}</span>}
                        {opportunity.property.status && <Badge variant="outline" className="text-[10px]">{opportunity.property.status}</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Metric label="Prix" value={formatPrice(opportunity.property.price)} />
                      <Metric label="Surface" value={formatNumber(opportunity.property.surface, ' m²')} />
                      <Metric label="Vendeur" value={opportunity.property.seller_type ?? '—'} />
                      <Metric label="Source" value={opportunity.property.source ?? '—'} />
                    </div>
                    {!editableProperty && (
                      <p className="text-xs text-muted-foreground">Annonce importée : modification verrouillée.</p>
                    )}
                  </div>
                ) : (
                  <EmptyCardText>Aucun bien associé à cette opportunité.</EmptyCardText>
                )}
              </InfoCard>

              <InfoCard
                title="Contacts"
                icon={<UserRound className="size-4" />}
                action={opportunity.lead ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/leads/${opportunity.lead.id}`}><ExternalLink className="mr-1 size-3.5" /> Ouvrir</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/leads/${opportunity.lead.id}`}><Edit className="mr-1 size-3.5" /> Modifier</Link>
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setLeadDialogOpen(true)}><Plus className="mr-1 size-3.5" /> Ajouter</Button>
                )}
              >
                {opportunity.lead ? (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">{leadName(opportunity.lead)}</p>
                      <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {opportunity.lead.prospect?.phone && <p className="flex items-center gap-1.5"><Phone className="size-3.5" /> {opportunity.lead.prospect.phone}</p>}
                        {opportunity.lead.prospect?.email && <p className="flex items-center gap-1.5"><Mail className="size-3.5" /> {opportunity.lead.prospect.email}</p>}
                        {opportunity.lead.commune && <p className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {opportunity.lead.commune}</p>}
                      </div>
                    </div>
                    <Metric label="Source" value={opportunity.lead.source_channel ?? '—'} />
                    {opportunity.lead.next_action && <p className="text-sm text-muted-foreground">{opportunity.lead.next_action}</p>}
                  </div>
                ) : (
                  <EmptyCardText>Aucun contact associé à cette opportunité.</EmptyCardText>
                )}
              </InfoCard>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="estimation">
          <section className="rounded-xl border bg-card p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Estimation</h2>
                <p className="mt-1 text-sm text-muted-foreground">Bien, données techniques et avis de valeur, conservés sur l’opportunité.</p>
              </div>
              <Button onClick={savePreparation} disabled={savingPreparation} className="bg-primary hover:bg-primary/90">
                {savingPreparation ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Sauvegarder
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DraftField label="N° mandat" value={propertyDraft.mandate_number} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, mandate_number: value }))} />
              <DraftField label="Type de mandat prévu" value={propertyDraft.mandate_type} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, mandate_type: value }))} />
              <DraftField label="Type de bien" value={propertyDraft.type_bien} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, type_bien: value }))} />
              <DraftField label="Adresse / secteur" value={propertyDraft.adresse} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, adresse: value }))} />
              <DraftField label="Commune" value={propertyDraft.commune} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, commune: value }))} />
              <DraftField label="DPE" value={propertyDraft.dpe} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, dpe: value }))} />
              <DraftField label="Surface habitable" type="number" value={propertyDraft.surface} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, surface: value }))} />
              <DraftField label="Terrain / extérieur" type="number" value={propertyDraft.surface_terrain} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, surface_terrain: value }))} />
              <DraftField label="Pièces" type="number" value={propertyDraft.nb_pieces} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, nb_pieces: value }))} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <DraftArea label="État / travaux" value={propertyDraft.etat} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, etat: value }))} />
              <DraftArea label="Équipements" value={propertyDraft.equipements} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, equipements: value }))} />
              <DraftArea label="Contexte vendeur" value={propertyDraft.contexte} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, contexte: value }))} />
              <DraftArea label="Points de vigilance" value={propertyDraft.points_vigilance} onChange={(value) => setPropertyDraft((draft) => ({ ...draft, points_vigilance: value }))} />
            </div>
          </section>

          <section className="mt-5 rounded-xl border bg-card p-5">
            <div className="mb-5">
              <div>
                <h2 className="text-base font-semibold">Estimation & avis de valeur</h2>
                <p className="mt-1 text-sm text-muted-foreground">Prépare l’avis de valeur avant signature, sans créer de client.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <DraftField label="Prix retenu" type="number" value={professionalDraft.price} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price: value }))} />
              <DraftField label="Estimation basse" type="number" value={professionalDraft.price_low} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price_low: value }))} />
              <DraftField label="Estimation haute" type="number" value={professionalDraft.price_high} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, price_high: value }))} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <DraftArea label="Synthèse de l’avis" value={professionalDraft.summary} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, summary: value }))} rows={5} />
              <DraftArea label="Arguments de valeur" value={professionalDraft.arguments} onChange={(value) => setProfessionalDraft((draft) => ({ ...draft, arguments: value }))} rows={5} />
            </div>

            <ValuationReportEditor draft={professionalDraft} setDraft={setProfessionalDraft} />
          </section>
        </TabsContent>

        <TabsContent value="dossier">
          <div className="space-y-5">
            {opportunity.client_dossier ? (
              <DossierWorkspace dossierId={opportunity.client_dossier.id} opportunityId={opportunity.id} />
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
        onOpenChange={setEventDialogOpen}
        onDraftChange={setEventDraft}
        onSubmit={saveEvent}
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
        onOpenOpportunity={(opportunityId) => router.push(`/app/opportunities/${opportunityId}`)}
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
        onOpenOpportunity={(opportunityId) => router.push(`/app/opportunities/${opportunityId}`)}
      />
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

function DraftField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function DraftArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} />
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
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border bg-muted/20 p-4">
        <h3 className="text-sm font-semibold">Avis de valeur complet iad</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Rubriques reprises du PDF : couverture, situation, présentation, marché, concurrence, comparables, positionnement, conclusion, preuves iad et services.
        </p>
      </div>

      <ReportSection title="1. Couverture et destinataire">
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

      <ReportSection title="2. Plan de situation et cadastre">
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

      <ReportSection title="3. Présentation du bien">
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

      <ReportSection title="4. Tendance du marché local">
        <DraftArea label="Base de l’étude" value={draft.market_basis} onChange={(value) => set('market_basis', value)} rows={3} />
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Prix/m² bas" type="number" value={draft.market_price_per_sqm_low} onChange={(value) => set('market_price_per_sqm_low', value)} />
          <DraftField label="Prix/m² médian" type="number" value={draft.market_price_per_sqm_median} onChange={(value) => set('market_price_per_sqm_median', value)} />
          <DraftField label="Prix/m² haut" type="number" value={draft.market_price_per_sqm_high} onChange={(value) => set('market_price_per_sqm_high', value)} />
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

      <ReportSection title="5. Analyse de la concurrence">
        <DraftArea label="Critères de sélection" value={draft.competition_criteria} onChange={(value) => set('competition_criteria', value)} rows={4} />
        <DraftArea label="Méthodologie iad" value={draft.competition_methodology} onChange={(value) => set('competition_methodology', value)} rows={6} />
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Biens retenus" type="number" value={draft.competition_retained_count} onChange={(value) => set('competition_retained_count', value)} />
          <DraftField label="Bien en vente moyen" type="number" value={draft.active_average_price} onChange={(value) => set('active_average_price', value)} />
          <DraftField label="Bien en vente €/m²" type="number" value={draft.active_average_price_per_sqm} onChange={(value) => set('active_average_price_per_sqm', value)} />
          <DraftField label="Bien vendu moyen" type="number" value={draft.sold_average_price} onChange={(value) => set('sold_average_price', value)} />
          <DraftField label="Bien vendu €/m²" type="number" value={draft.sold_average_price_per_sqm} onChange={(value) => set('sold_average_price_per_sqm', value)} />
        </div>
      </ReportSection>

      <ReportSection title="6. Comparables vendus">
        <DraftJsonArea
          label="Comparables vendus JSON"
          value={draft.comparables_json}
          onChange={(value) => set('comparables_json', value)}
          rows={10}
          placeholder={'[\n  { "title": "Maison 7 p. 121 m²", "price": 431600, "price_per_sqm": 3567, "address": "4 Vallon des Eaux Vives", "status": "Vendu", "date_label": "il y a 10 mois" }\n]'}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Moyenne sélection €/m²" type="number" value={draft.comparables_summary_average_per_sqm} onChange={(value) => set('comparables_summary_average_per_sqm', value)} />
          <DraftField label="Prix bas €/m²" type="number" value={draft.comparables_summary_low_per_sqm} onChange={(value) => set('comparables_summary_low_per_sqm', value)} />
          <DraftField label="Prix haut €/m²" type="number" value={draft.comparables_summary_high_per_sqm} onChange={(value) => set('comparables_summary_high_per_sqm', value)} />
        </div>
      </ReportSection>

      <ReportSection title="7. Positionnement de votre bien">
        <div className="grid gap-4 md:grid-cols-3">
          <DraftField label="Prix de référence" type="number" value={draft.positioning_reference_price} onChange={(value) => set('positioning_reference_price', value)} />
          <DraftField label="Prix de référence €/m²" type="number" value={draft.positioning_reference_price_per_sqm} onChange={(value) => set('positioning_reference_price_per_sqm', value)} />
          <DraftField label="% moins chers" type="number" value={draft.positioning_cheaper_percent} onChange={(value) => set('positioning_cheaper_percent', value)} />
          <DraftField label="% plus grands" type="number" value={draft.positioning_larger_percent} onChange={(value) => set('positioning_larger_percent', value)} />
          <DraftField label="% moins chers et plus grands" type="number" value={draft.positioning_cheaper_larger_percent} onChange={(value) => set('positioning_cheaper_larger_percent', value)} />
          <DraftField label="Prix moyen concurrence €/m²" type="number" value={draft.positioning_competition_average_per_sqm} onChange={(value) => set('positioning_competition_average_per_sqm', value)} />
          <DraftField label="Fourchette basse €/m²" type="number" value={draft.positioning_low_per_sqm} onChange={(value) => set('positioning_low_per_sqm', value)} />
          <DraftField label="Médiane €/m²" type="number" value={draft.positioning_median_per_sqm} onChange={(value) => set('positioning_median_per_sqm', value)} />
          <DraftField label="Fourchette haute €/m²" type="number" value={draft.positioning_high_per_sqm} onChange={(value) => set('positioning_high_per_sqm', value)} />
          <DraftField label="Rang prix/m²" type="number" value={draft.positioning_rank} onChange={(value) => set('positioning_rank', value)} />
          <DraftField label="Total concurrence" type="number" value={draft.positioning_rank_total} onChange={(value) => set('positioning_rank_total', value)} />
          <DraftField label="Seuil 10% moins chers" type="number" value={draft.positioning_threshold_low_price} onChange={(value) => set('positioning_threshold_low_price', value)} />
          <DraftField label="Prix médian" type="number" value={draft.positioning_threshold_median_price} onChange={(value) => set('positioning_threshold_median_price', value)} />
          <DraftField label="Seuil 10% plus chers" type="number" value={draft.positioning_threshold_high_price} onChange={(value) => set('positioning_threshold_high_price', value)} />
        </div>
      </ReportSection>

      <ReportSection title="8. Recommandations et conclusion">
        <DraftArea label="Mes recommandations" value={draft.recommendations} onChange={(value) => set('recommendations', value)} rows={5} />
        <DraftArea label="Conclusion" value={draft.conclusion_text} onChange={(value) => set('conclusion_text', value)} rows={7} />
        <DraftArea label="Avertissement légal" value={draft.legal_notice} onChange={(value) => set('legal_notice', value)} rows={4} />
      </ReportSection>

      <ReportSection title="9. Preuves iad : biens vendus et avis clients">
        <DraftJsonArea
          label="Nos biens vendus JSON"
          value={draft.iad_sold_properties_json}
          onChange={(value) => set('iad_sold_properties_json', value)}
          rows={8}
          placeholder={'[\n  { "title": "Maison 5 p. 110 m²", "address": "122 Chemin du Vallon des Escourtines", "price": 359000, "price_per_sqm": 3264, "date_label": "il y a un an" }\n]'}
        />
        <DraftJsonArea
          label="Avis clients JSON"
          value={draft.client_reviews_json}
          onChange={(value) => set('client_reviews_json', value)}
          rows={8}
          placeholder={'[\n  { "title": "Sympathique et bienveillant", "author": "JessicaR", "rating": 5, "date": "3 juillet 2026", "content": "..." }\n]'}
        />
      </ReportSection>

      <ReportSection title="10. Les + iad et services iad">
        <div className="grid gap-4 lg:grid-cols-2">
          <DraftArea label="Les + iad" value={draft.iad_advantages} onChange={(value) => set('iad_advantages', value)} rows={6} />
          <DraftArea label="Les services iad" value={draft.iad_services} onChange={(value) => set('iad_services', value)} rows={6} />
        </div>
      </ReportSection>
    </div>
  )
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-background p-4">
      <h3 className="border-b pb-3 text-sm font-semibold text-foreground">{title}</h3>
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
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="font-mono text-xs"
      />
    </label>
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

function ActivityRow({ event, action }: { event: OpportunityEvent; action?: React.ReactNode }) {
  const config = EVENT_CONFIG[event.type]
  const Icon = config.icon
  return (
    <div className="rounded-lg border p-3">
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
            <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {formatDateTime(eventDate(event))}</span>
            {event.created_by && <span>{event.created_by}</span>}
            {event.completed_at && <span>Terminée le {formatDateTime(event.completed_at)}</span>}
          </div>
        </div>
        {action}
      </div>
    </div>
  )
}

function EventActions({
  event,
  completing,
  deleting,
  onComplete,
  onEdit,
  onDelete,
}: {
  event: OpportunityEvent
  completing?: boolean
  deleting?: boolean
  onComplete?: (event: OpportunityEvent) => void
  onEdit: (event: OpportunityEvent) => void
  onDelete: (event: OpportunityEvent) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {onComplete && !event.completed_at && ['task', 'call', 'meeting'].includes(event.type) && (
        <Button variant="outline" size="sm" onClick={() => onComplete(event)} disabled={completing}>
          {completing ? <Loader2 className="mr-1 size-4 animate-spin" /> : <CheckCircle2 className="mr-1 size-4" />}
          Terminée
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
        <Edit className="mr-1 size-4" />
        Modifier
      </Button>
      <Button variant="outline" size="sm" onClick={() => onDelete(event)} disabled={deleting}>
        {deleting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
        Supprimer
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
    return <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{emptyText}</div>
  }

  return (
    <div className="mt-4 space-y-4">
      {events.map((event) => (
        <div key={event.id} className="relative pl-6">
          <div className="absolute left-0 top-2 size-2 rounded-full bg-primary" />
          <div className="absolute bottom-[-18px] left-[3px] top-4 w-px bg-border last:hidden" />
          <ActivityRow
            event={event}
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
      ))}
    </div>
  )
}

function EventDialog({
  open,
  draft,
  saving,
  editing,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  open: boolean
  draft: EventDraft
  saving: boolean
  editing: boolean
  onOpenChange: (open: boolean) => void
  onDraftChange: (draft: EventDraft) => void
  onSubmit: () => void
}) {
  const config = EVENT_CONFIG[draft.type]
  const showDue = ['task', 'call', 'meeting'].includes(draft.type)
  const showMilestone = draft.type === 'estimation'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{config.label}</DialogTitle>
          <DialogDescription>Ajoute une activité à la timeline de cette opportunité.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showMilestone ? (
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Jalon</span>
              <Select value={draft.milestone} onValueChange={(value) => onDraftChange({ ...draft, milestone: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTIMATION_MILESTONES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          ) : (
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Titre</span>
              <Input value={draft.title} onChange={(e) => onDraftChange({ ...draft, title: e.target.value })} />
            </label>
          )}

          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Détails</span>
            <Textarea
              value={draft.content}
              onChange={(e) => onDraftChange({ ...draft, content: e.target.value })}
              rows={4}
              placeholder="Compte rendu, objectif, précision utile..."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Date de l’activité</span>
              <Input type="datetime-local" value={draft.occurred_at} onChange={(e) => onDraftChange({ ...draft, occurred_at: e.target.value })} />
            </label>
            {showDue && (
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Échéance</span>
                <Input type="datetime-local" value={draft.due_at} onChange={(e) => onDraftChange({ ...draft, due_at: e.target.value })} />
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Plus className="mr-1 size-4" />}
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter un contact</DialogTitle>
          <DialogDescription>Recherche dans les contacts vendeurs déjà présents.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Nom, téléphone, email..." className="pl-9" />
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg border p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement...</div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun contact trouvé</p>
            ) : rows.map((lead) => {
              const alreadyLinked = lead.opportunity && lead.opportunity.id !== opportunityId
              return (
                <div key={lead.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{leadOptionName(lead)}</p>
                        {alreadyLinked && <Badge variant="destructive" className="text-[10px]">déjà lié</Badge>}
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
                        <Button variant="outline" size="sm" onClick={() => onOpenOpportunity(lead.opportunity!.id)}>Voir l’opportunité</Button>
                        <Button size="sm" onClick={() => onAttachNewProject(lead)} disabled={attachingId === lead.id} className="bg-primary hover:bg-primary/90">
                          {attachingId === lead.id ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Plus className="mr-1 size-4" />}
                          Nouveau projet
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => onAttach(lead)} disabled={attachingId === lead.id} className="bg-primary hover:bg-primary/90">
                        {attachingId === lead.id ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Link2 className="mr-1 size-4" />}
                        Ajouter
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajouter un bien</DialogTitle>
          <DialogDescription>Recherche uniquement dans les biens déjà présents en base.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Recherche</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Titre, commune, CP..." className="pl-9" />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Tous</option>
                {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Statut</span>
              <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Tous</option>
                <option value="active">En ligne</option>
                <option value="online">Online</option>
                <option value="expired">Expiré</option>
                <option value="opportunity">Opportunité</option>
              </select>
            </label>
          </div>

          <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-lg border p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement...</div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun bien trouvé</p>
            ) : rows.map((property) => {
              const alreadyLinked = property.opportunity && property.opportunity.id !== opportunityId
              return (
                <div key={property.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md border bg-muted/30">
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
                          <p className="line-clamp-1 font-medium">{property.title ?? 'Bien en annonce'}</p>
                          {property.status && <Badge variant="outline" className="text-[10px]">{property.status}</Badge>}
                          {alreadyLinked && <Badge variant="destructive" className="text-[10px]">déjà lié</Badge>}
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
                      <Button variant="outline" size="sm" onClick={() => onOpenOpportunity(property.opportunity!.id)}>Voir l’opportunité</Button>
                    ) : (
                      <Button size="sm" onClick={() => onAttach(property)} disabled={attachingId === property.id} className="bg-primary hover:bg-primary/90">
                        {attachingId === property.id ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Link2 className="mr-1 size-4" />}
                        Ajouter
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

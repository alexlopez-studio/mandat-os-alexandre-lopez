import {
  BarChart3,
  Calendar,
  DoorOpen,
  Handshake,
  PenTool,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export type RdvTemplate = {
  title: string
  sms_template: string
  sms_reminder_hours?: number
  sms_reminder_1_trigger?: string
  sms_reminder_2_enabled?: boolean
  sms_reminder_2_hours?: number
  sms_reminder_2_trigger?: string
}

export type RdvTemplatesMap = Record<string, RdvTemplate>

export const MEETING_TYPES: Array<{ value: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [

  { value: 'rendez_vous_r1', label: "Rendez-vous découverte (R1)", icon: Handshake },
  { value: 'rendez_vous_r2', label: "Rendez-vous de remise d'estimation (R2)", icon: BarChart3 },
  { value: 'rendez_vous_suivi', label: "Point d'avancement (toutes les 3-4 semaines)", icon: TrendingUp },
  { value: 'rendez_vous_visite', label: "Rendez-vous de visite", icon: DoorOpen },
  { value: 'rendez_vous_ajustement', label: "Rendez-vous intermédiaire (Biens en vente & Ajustement prix)", icon: Target },
  { value: 'rendez_vous_signature', label: "Rendez-vous de signature de mandat", icon: PenTool },
  { value: 'rendez_vous_autre', label: "Autre rendez-vous", icon: Calendar },
]

export const DEFAULT_RDV_TEMPLATES: RdvTemplatesMap = {
  rendez_vous_r1: {
    title: "Rendez-vous découverte (R1)",
    sms_template: "Bonjour {{ client.first_name }}, je vous confirme notre rendez-vous découverte le {{ rdv.date }} à {{ rdv.time }} pour votre bien situé à {{ property.address }}. À très vite, {{ agent.name }}.",
    sms_reminder_hours: 24,
    sms_reminder_1_trigger: 'immediate',
    sms_reminder_2_enabled: true,
    sms_reminder_2_hours: 2,
    sms_reminder_2_trigger: 'eve_18h',
  },
  rendez_vous_r2: {
    title: "Remise de l'estimation (R2)",
    sms_template: "Bonjour {{ client.first_name }}, rendez-vous confirmé le {{ rdv.date }} à {{ rdv.time }} pour la présentation de votre avis de valeur. Cordialement, {{ agent.name }}.",
    sms_reminder_hours: 24,
    sms_reminder_1_trigger: 'immediate',
    sms_reminder_2_enabled: true,
    sms_reminder_2_hours: 2,
    sms_reminder_2_trigger: 'eve_18h',
  },
  rendez_vous_suivi: {
    title: "Point d'avancement commercial",
    sms_template: "Bonjour {{ client.first_name }}, nous avons rendez-vous le {{ rdv.date }} à {{ rdv.time }} pour faire un point d'étape sur la commercialisation. {{ agent.name }}.",
    sms_reminder_hours: 24,
    sms_reminder_1_trigger: 'immediate',
    sms_reminder_2_enabled: true,
    sms_reminder_2_hours: 2,
    sms_reminder_2_trigger: 'eve_18h',
  },
  rendez_vous_visite: {
    title: "Visite du bien",
    sms_template: "Bonjour {{ client.first_name }}, rappel pour la visite planifiée de votre bien le {{ rdv.date }} à {{ rdv.time }}. Merci, {{ agent.name }}.",
    sms_reminder_hours: 24,
    sms_reminder_1_trigger: 'immediate',
    sms_reminder_2_enabled: true,
    sms_reminder_2_hours: 2,
    sms_reminder_2_trigger: 'eve_18h',
  },
  rendez_vous_ajustement: {
    title: "Point stratégie & marché",
    sms_template: "Bonjour {{ client.first_name }}, rendez-vous le {{ rdv.date }} à {{ rdv.time }} pour étudier les retours du marché et ajuster notre stratégie prix. {{ agent.name }}.",
    sms_reminder_hours: 24,
    sms_reminder_1_trigger: 'immediate',
    sms_reminder_2_enabled: true,
    sms_reminder_2_hours: 2,
    sms_reminder_2_trigger: 'eve_18h',
  },
  rendez_vous_signature: {
    title: "Signature du mandat",
    sms_template: "Bonjour {{ client.first_name }}, rendez-vous confirmé le {{ rdv.date }} à {{ rdv.time }} pour la signature officielle du mandat. {{ agent.name }}.",
    sms_reminder_hours: 24,
    sms_reminder_1_trigger: 'immediate',
    sms_reminder_2_enabled: true,
    sms_reminder_2_hours: 2,
    sms_reminder_2_trigger: 'eve_18h',
  },
  rendez_vous_autre: {
    title: "Rendez-vous",
    sms_template: "Bonjour {{ client.first_name }}, je vous rappelle notre rendez-vous le {{ rdv.date }} à {{ rdv.time }}. Cordialement, {{ agent.name }}.",
    sms_reminder_hours: 24,
    sms_reminder_1_trigger: 'immediate',
    sms_reminder_2_enabled: true,
    sms_reminder_2_hours: 2,
    sms_reminder_2_trigger: 'eve_18h',
  },
}




export const LIQUID_VARIABLES = [
  { tag: '{{ client.first_name }}', label: 'Prénom du client', sample: 'Jean' },
  { tag: '{{ client.last_name }}', label: 'Nom du client', sample: 'Dupont' },
  { tag: '{{ rdv.date }}', label: 'Date du rendez-vous', sample: '15 mars 2026' },
  { tag: '{{ rdv.time }}', label: 'Heure du rendez-vous', sample: '14h30' },
  { tag: '{{ property.address }}', label: 'Adresse du bien', sample: '12 rue des Vignes' },
  { tag: '{{ agent.name }}', label: 'Nom du conseiller', sample: 'Alexandre Lopez' },
]

export function renderLiquidTemplate(
  template: string,
  context: {
    client?: { first_name?: string; last_name?: string }
    rdv?: { date?: string; time?: string; type?: string }
    property?: { address?: string; city?: string }
    agent?: { name?: string }
  }
): string {
  if (!template) return ''
  let result = template
  result = result.replace(/\{\{\s*client\.first_name\s*\}\}/g, context.client?.first_name || 'Monsieur/Madame')
  result = result.replace(/\{\{\s*client\.last_name\s*\}\}/g, context.client?.last_name || '')
  result = result.replace(/\{\{\s*rdv\.date\s*\}\}/g, context.rdv?.date || '[Date]')
  result = result.replace(/\{\{\s*rdv\.time\s*\}\}/g, context.rdv?.time || '[Heure]')
  result = result.replace(/\{\{\s*rdv\.type\s*\}\}/g, context.rdv?.type || 'rendez-vous')
  result = result.replace(/\{\{\s*property\.address\s*\}\}/g, context.property?.address || '[Adresse du bien]')
  result = result.replace(/\{\{\s*agent\.name\s*\}\}/g, context.agent?.name || 'Alexandre Lopez')
  return result
}

export function parseRdvTemplates(jsonRaw?: string | null): RdvTemplatesMap {
  if (!jsonRaw) return DEFAULT_RDV_TEMPLATES
  try {
    const parsed = typeof jsonRaw === 'string' ? JSON.parse(jsonRaw) : jsonRaw
    return {
      ...DEFAULT_RDV_TEMPLATES,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    }
  } catch {
    return DEFAULT_RDV_TEMPLATES
  }
}

export function roundToNext5Minutes(dateObj?: Date): string {
  const d = dateObj ? new Date(dateObj.getTime()) : new Date()
  d.setSeconds(0, 0)
  const minutes = d.getMinutes()
  const remainder = minutes % 5
  if (remainder !== 0) {
    d.setMinutes(minutes + (5 - remainder))
  }
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}


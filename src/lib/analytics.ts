'use client'

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function isDebugEnabled() {
  return process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'
}

export function isAnalyticsEnabled() {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === 'undefined') return

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  )

  if (window.gtag && isAnalyticsEnabled()) {
    window.gtag('event', name, cleanParams)
  }

  if (isDebugEnabled()) {
    console.debug('[analytics]', name, cleanParams)
  }
}

function normalizeLabel(label: string | null | undefined) {
  return (label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export function classifyTrackedLink(args: {
  href: string
  label?: string | null
  sourcePath: string
  origin: string
}) {
  const label = normalizeLabel(args.label)

  let url: URL
  try {
    url = new URL(args.href, args.origin)
  } catch {
    return null
  }

  const isInternal = url.origin === args.origin
  const targetPath = isInternal ? url.pathname : url.href
  const baseParams = {
    cta_label: label,
    source_path: args.sourcePath,
    target_path: targetPath,
  }

  if (args.href.startsWith('tel:')) {
    return { name: 'phone_click', params: { ...baseParams, cta_destination: 'phone' } }
  }

  if (!isInternal && url.hostname.includes('cal.com')) {
    return { name: 'appointment_click', params: { ...baseParams, cta_destination: 'appointment' } }
  }

  if (!isInternal) return null

  if (url.pathname === '/outils/vendre' || (url.hostname === 'www.iadfrance.fr' && url.pathname === '/conseiller-immobilier/alexandre.lopez/estimation')) {
    return { name: 'cta_click', params: { ...baseParams, cta_destination: 'seller_estimation_tool' } }
  }

  if (url.pathname === '/avis-de-valeur-immobilier') {
    return { name: 'cta_click', params: { ...baseParams, cta_destination: 'value_opinion_landing' } }
  }

  if (url.pathname === '/contact') {
    return { name: 'contact_click', params: { ...baseParams, cta_destination: 'contact' } }
  }

  if (url.pathname.startsWith('/marche/')) {
    return { name: 'local_page_click', params: { ...baseParams, cta_destination: 'local_market_page' } }
  }

  return null
}

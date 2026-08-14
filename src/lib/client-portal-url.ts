const DEFAULT_CLIENT_PORTAL_URL = 'https://espace.alexandrelopez.fr'
const DEFAULT_DEV_CLIENT_PORTAL_PORT = '3000'

export function getClientPortalUrl(reqOrOrigin?: Request | string | null): string {
  const envUrl = process.env.CLIENT_PORTAL_URL ?? process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL

  // 1. Browser context
  if (typeof window !== 'undefined') {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    if (isLocal) {
      if (envUrl && !envUrl.includes(':3002')) {
        return envUrl.replace(/\/+$/, '')
      }
      return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_DEV_CLIENT_PORTAL_PORT}`
    }
  }

  // 2. Request or origin provided (SSR / API routes)
  if (reqOrOrigin) {
    if (typeof reqOrOrigin === 'string') {
      try {
        const parsed = new URL(reqOrOrigin)
        const isLocal =
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname.endsWith('.local')
        if (isLocal) {
          if (envUrl && !envUrl.includes(':3002')) {
            return envUrl.replace(/\/+$/, '')
          }
          return `${parsed.protocol}//${parsed.hostname}:${DEFAULT_DEV_CLIENT_PORTAL_PORT}`
        }
      } catch {
        // ignore
      }
    } else if ('headers' in reqOrOrigin) {
      const host =
        reqOrOrigin.headers.get('x-forwarded-host') ??
        reqOrOrigin.headers.get('host') ??
        ''
      const proto =
        reqOrOrigin.headers.get('x-forwarded-proto') ??
        (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https')
      const hostname = host.split(':')[0]
      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local')

      if (isLocal) {
        if (envUrl && !envUrl.includes(':3002')) {
          return envUrl.replace(/\/+$/, '')
        }
        return `${proto}://${hostname}:${DEFAULT_DEV_CLIENT_PORTAL_PORT}`
      }
    }
  }

  // 3. Development mode (Node process fallback)
  if (process.env.NODE_ENV === 'development') {
    if (envUrl && !envUrl.includes(':3002')) {
      return envUrl.replace(/\/+$/, '')
    }
    return `http://localhost:${DEFAULT_DEV_CLIENT_PORTAL_PORT}`
  }

  return (envUrl ?? DEFAULT_CLIENT_PORTAL_URL).replace(/\/+$/, '')
}

export function buildClientPortalAuthRedirect(dossierId?: string | null, reqOrOrigin?: Request | string | null) {
  const url = new URL('/auth/callback', getClientPortalUrl(reqOrOrigin))
  if (dossierId) url.searchParams.set('dossier', dossierId)
  return url.toString()
}

export function buildClientPortalDossierUrl(publicToken: string, reqOrOrigin?: Request | string | null) {
  return new URL(`/dossier/${encodeURIComponent(publicToken)}`, getClientPortalUrl(reqOrOrigin)).toString()
}

export function buildClientPortalPreviewUrl(token: string, reqOrOrigin?: Request | string | null) {
  const url = new URL('/preview', getClientPortalUrl(reqOrOrigin))
  url.searchParams.set('token', token)
  return url.toString()
}


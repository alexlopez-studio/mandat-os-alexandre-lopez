const DEFAULT_CLIENT_PORTAL_URL = 'https://espace.alexandrelopez.fr'

export function getClientPortalUrl() {
  return (
    process.env.CLIENT_PORTAL_URL ??
    process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ??
    DEFAULT_CLIENT_PORTAL_URL
  ).replace(/\/+$/, '')
}

export function buildClientPortalAuthRedirect(dossierId?: string | null) {
  const url = new URL('/auth/callback', getClientPortalUrl())
  if (dossierId) url.searchParams.set('dossier', dossierId)
  return url.toString()
}

export function buildClientPortalPreviewUrl(token: string) {
  const url = new URL('/preview', getClientPortalUrl())
  url.searchParams.set('token', token)
  return url.toString()
}

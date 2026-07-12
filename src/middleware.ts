import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isDevAuthBypassEnabled } from '@/lib/dev-auth-bypass'

// Chemins accessibles sans session (auth elle-même)
const PUBLIC_ADMIN_PATHS = [
  '/admin/login',
  '/admin/mot-de-passe-oublie',
  '/admin/reset-password',
]

const PROTECTED_API_PREFIXES = [
  '/api/admin',
  '/api/ai',
  '/api/leads',
  '/api/market',
  '/api/radar',
]

const PUBLIC_API_PATHS = [
  '/api/market/webhooks/stream-estate',
]

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Rafraîchit la session sur toutes les routes internes.
  const { response, user } = await updateSession(req)

  const isProtectedPage = path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/app')
  const isProtectedApi =
    PROTECTED_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/')) &&
    !PUBLIC_API_PATHS.some((publicPath) => path === publicPath || path.startsWith(publicPath + '/'))
  const isProtected = isProtectedPage || isProtectedApi
  if (!isProtected) return response

  // En local uniquement, permet de travailler dans Mandat OS sans session Supabase.
  // En production, isDevAuthBypassEnabled() est toujours false.
  if (isDevAuthBypassEnabled()) {
    return response
  }

  // Pages publiques d'auth : on laisse passer (mais on garde les cookies rafraîchis)
  if (PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return response
  }

  // Toute autre route interne exige une session.
  // Fail-closed : pas de session => redirection vers le login.
  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 },
      )
    }

    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('redirect', path.startsWith('/dashboard') ? '/app/dashboard' : path)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/app/:path*',
    '/api/admin/:path*',
    '/api/ai/:path*',
    '/api/leads/:path*',
    '/api/market/:path*',
    '/api/radar/:path*',
  ],
}

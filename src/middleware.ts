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
]

const PUBLIC_API_PATHS = [
  '/api/market/webhooks/stream-estate',
  '/api/ai/voice-memo',
  // Veille & calendrier editorial : appeles par la skill Claude sans session.
  // La garde est portee par la route elle-meme (`isMachineOrAdmin`, secret
  // partage ou session admin) — voir `src/lib/api-machine-auth.ts`.
  '/api/market/news',
  '/api/market/content',
]

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Endpoints API publics (Webhook Stream Estate, Voice Memo Raccourcis iOS, News, Content)
  if (PUBLIC_API_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Pages publiques d'auth (login, reset password)
  if (PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // En local uniquement, permet de travailler dans Mandat OS sans session Supabase.
  if (isDevAuthBypassEnabled()) {
    return NextResponse.next()
  }

  // Rafraîchit la session sur toutes les routes internes protégées.
  const { response, user } = await updateSession(req)

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
  ],
}

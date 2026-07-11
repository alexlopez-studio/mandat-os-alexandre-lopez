import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Chemins accessibles sans session (auth elle-même)
const PUBLIC_ADMIN_PATHS = [
  '/admin/login',
  '/admin/mot-de-passe-oublie',
  '/admin/reset-password',
]

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Rafraîchit la session sur toutes les routes internes.
  const { response, user } = await updateSession(req)

  const isProtected = path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/app')
  if (!isProtected) return response

  // Pages publiques d'auth : on laisse passer (mais on garde les cookies rafraîchis)
  if (PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return response
  }

  // Toute autre route interne exige une session.
  // Fail-closed : pas de session => redirection vers le login.
  if (!user) {
    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('redirect', path.startsWith('/dashboard') ? '/app/dashboard' : path)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

// Middleware désactivé temporairement — matcher vide = aucune route interceptée
// Pour réactiver : remettre ['/admin/:path*', '/dashboard/:path*', '/app/:path*']
export const config = {
  matcher: [],
}

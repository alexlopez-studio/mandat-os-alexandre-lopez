import { NextRequest, NextResponse } from 'next/server'

/**
 * Scopes demandés au compte Google.
 *
 * `userinfo.email` est indispensable : sans lui l'appel `/oauth2/v2/userinfo`
 * du callback échoue et la connexion est enregistrée sans e-mail.
 *
 * Pour Drive on reste volontairement sur `drive.file`, qui ne donne accès qu'aux
 * fichiers créés ou ouverts depuis Mandat OS : c'est un scope non sensible, là
 * où un accès Drive complet imposerait une validation Google lourde.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  // `drive.file` ne montre que les fichiers créés par l'app : insuffisant pour
  // retrouver les documents clients existants, d'où `drive.readonly` qui ouvre
  // la recherche et la lecture sur tout le Drive. Scope restreint côté Google.
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
]

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/app/settings?section=integrations&google=missing_config', req.nextUrl.origin),
    )
  }

  const redirectUri = `${req.nextUrl.origin}/api/integrations/google/oauth/callback`
  const state = crypto.randomUUID()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  // `consent` force Google à renvoyer un refresh_token, y compris lors d'une
  // reconnexion : sans lui, seule la toute première autorisation en fournit un.
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '))
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url)
  res.cookies.set('mandat_os_google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/',
  })
  return res
}

import { NextRequest, NextResponse } from 'next/server'
import { encryptSecret } from '@/lib/ai/crypto'
import { adminDb } from '@/lib/ai/db'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const expectedState = req.cookies.get('mandat_os_google_oauth_state')?.value
    if (!code || !state || state !== expectedState) {
      return NextResponse.json({ success: false, error: 'Callback Google invalide' }, { status: 400 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.json({ success: false, error: 'Configuration OAuth Google incomplète' }, { status: 500 })
    }

    const redirectUri = `${req.nextUrl.origin}/api/integrations/google/oauth/callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const token = await tokenRes.json()
    if (!tokenRes.ok) {
      return NextResponse.json({ success: false, error: token.error_description ?? 'Token Google refusé' }, { status: 400 })
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const profile = await profileRes.json().catch(() => ({}))
    const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null
    const scopes = typeof token.scope === 'string' ? token.scope.split(' ') : []

    await adminDb()
      .from('google_connections')
      .insert({
        account_email: profile.email ?? null,
        encrypted_access_token: token.access_token ? encryptSecret(token.access_token) : null,
        encrypted_refresh_token: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        scopes,
        expires_at: expiresAt,
        status: 'active',
      })

    const res = NextResponse.redirect(new URL('/app/settings?section=ia', req.nextUrl.origin))
    res.cookies.delete('mandat_os_google_oauth_state')
    return res
  } catch (err) {
    console.error('[GET /api/integrations/google/oauth/callback]', err)
    return NextResponse.json({ success: false, error: 'Erreur connexion Google' }, { status: 500 })
  }
}

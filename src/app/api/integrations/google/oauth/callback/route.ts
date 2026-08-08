import { NextRequest, NextResponse } from 'next/server'
import { encryptSecret } from '@/lib/ai/crypto'
import { adminDb } from '@/lib/ai/db'

/**
 * Retour d'autorisation Google.
 *
 * Le compte Google est unique dans Mandat OS : on met à jour la connexion
 * existante au lieu d'en empiler une nouvelle à chaque autorisation. Le
 * `refresh_token` n'est réécrit que si Google en renvoie un — il n'est fourni
 * que lorsque `prompt=consent` est honoré, et l'écraser par `null` couperait
 * définitivement le renouvellement.
 */
export async function GET(req: NextRequest) {
  const settingsUrl = (params: string) =>
    new URL(`/app/settings?section=integrations&${params}`, req.nextUrl.origin)

  try {
    const error = req.nextUrl.searchParams.get('error')
    if (error) {
      // Google distingue plusieurs refus, et la distinction compte : un refus de
      // l'utilisateur se corrige en recliquant, un blocage par la politique
      // Workspace demande une autorisation de l'administrateur du domaine.
      // On propage le code tel quel pour l'afficher précisément.
      console.error('[GET /api/integrations/google/oauth/callback] refus Google:', error)
      return NextResponse.redirect(
        settingsUrl(`google=oauth_error&code=${encodeURIComponent(error)}`),
      )
    }

    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const expectedState = req.cookies.get('mandat_os_google_oauth_state')?.value
    if (!code || !state || state !== expectedState) {
      return NextResponse.redirect(settingsUrl('google=invalid_state'))
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(settingsUrl('google=missing_config'))
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
      console.error('[GET /api/integrations/google/oauth/callback] token refusé:', token)
      return NextResponse.redirect(settingsUrl('google=token_refused'))
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const profile = await profileRes.json().catch(() => ({}))
    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
      : null
    const scopes = typeof token.scope === 'string' ? token.scope.split(' ') : []

    const payload: Record<string, unknown> = {
      account_email: profile.email ?? null,
      encrypted_access_token: token.access_token ? encryptSecret(token.access_token) : null,
      scopes,
      expires_at: expiresAt,
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    }
    if (token.refresh_token) {
      payload.encrypted_refresh_token = encryptSecret(token.refresh_token)
    }

    const { data: existing } = await adminDb()
      .from('google_connections')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error: writeError } = existing?.id
      ? await adminDb().from('google_connections').update(payload).eq('id', existing.id)
      : await adminDb().from('google_connections').insert(payload)

    if (writeError) {
      console.error('[GET /api/integrations/google/oauth/callback] écriture:', writeError)
      return NextResponse.redirect(settingsUrl('google=storage_error'))
    }

    const res = NextResponse.redirect(settingsUrl('google=connected'))
    res.cookies.delete('mandat_os_google_oauth_state')
    return res
  } catch (err) {
    console.error('[GET /api/integrations/google/oauth/callback]', err)
    return NextResponse.redirect(settingsUrl('google=error'))
  }
}

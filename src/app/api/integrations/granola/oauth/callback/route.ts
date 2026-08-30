import { NextRequest, NextResponse } from 'next/server'

import { decryptSecret, encryptSecret } from '@/lib/ai/crypto'
import { ensureGranolaConnection, updateGranolaConnection } from '@/lib/integrations/granola/connection'
import { exchangeGranolaCode, type GranolaAuthServerMetadata } from '@/lib/integrations/granola/oauth'

/**
 * GET /api/integrations/granola/oauth/callback — retour d'autorisation Granola.
 *
 * Le jeu de jetons est chiffre avant stockage. `expires_at` est indispensable :
 * c'est lui qui declenche le rafraichissement silencieux, et son absence
 * ferait reapparaitre exactement le piege n° 1 (une synchronisation qui
 * s'arrete sans bruit quand le jeton expire).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const settingsUrl = (params: string) =>
    new URL(`/admin/market/settings?section=integrations&${params}`, req.nextUrl.origin)

  try {
    const error = req.nextUrl.searchParams.get('error')
    if (error) {
      return NextResponse.redirect(settingsUrl(`granola=oauth_error&code=${encodeURIComponent(error)}`))
    }

    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const expectedState = req.cookies.get('mandat_os_granola_oauth_state')?.value
    const verifier = req.cookies.get('mandat_os_granola_pkce')?.value

    if (!code || !state || !verifier || state !== expectedState) {
      return NextResponse.redirect(settingsUrl('granola=invalid_state'))
    }

    const connection = await ensureGranolaConnection()
    const metadata = (connection.oauth_metadata ?? {}) as unknown as GranolaAuthServerMetadata
    if (!metadata.token_endpoint || !connection.oauth_client_id) {
      return NextResponse.redirect(settingsUrl('granola=missing_client'))
    }

    const tokens = await exchangeGranolaCode({
      metadata,
      code,
      verifier,
      clientId: connection.oauth_client_id,
      clientSecret: connection.encrypted_oauth_client_secret
        ? decryptSecret(connection.encrypted_oauth_client_secret)
        : null,
      redirectUri: `${req.nextUrl.origin}/api/integrations/granola/oauth/callback`,
    })

    const patch: Record<string, unknown> = {
      encrypted_access_token: encryptSecret(tokens.access_token),
      token_expires_at: tokens.expires_at,
      scopes: tokens.scopes,
      status: 'active',
      last_error: null,
    }
    // Ne jamais ecraser un refresh_token existant par `null` : cela couperait
    // definitivement le renouvellement silencieux.
    if (tokens.refresh_token) patch.encrypted_refresh_token = encryptSecret(tokens.refresh_token)

    await updateGranolaConnection(connection.id, patch)

    const res = NextResponse.redirect(settingsUrl('granola=connected'))
    res.cookies.delete('mandat_os_granola_oauth_state')
    res.cookies.delete('mandat_os_granola_pkce')
    return res
  } catch (err) {
    console.error('[GET /api/integrations/granola/oauth/callback]', err)
    return NextResponse.redirect(
      settingsUrl(`granola=token_refused&detail=${encodeURIComponent(err instanceof Error ? err.message : 'erreur')}`),
    )
  }
}

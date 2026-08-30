import { NextRequest, NextResponse } from 'next/server'

import { encryptSecret } from '@/lib/ai/crypto'
import {
  ensureGranolaConnection,
  updateGranolaConnection,
} from '@/lib/integrations/granola/connection'
import {
  buildGranolaAuthorizeUrl,
  createPkcePair,
  discoverGranolaAuthServer,
  registerGranolaClient,
} from '@/lib/integrations/granola/oauth'
import { GRANOLA_MCP_URL } from '@/lib/integrations/granola/types'

/**
 * GET /api/integrations/granola/oauth/start — ouvre le consentement Granola.
 *
 * Le plan gratuit ne fournit pas de cle API : le serveur MCP distant
 * s'authentifie en OAuth. Granola n'ayant pas de console developpeur, le client
 * est enregistre dynamiquement (RFC 7591) a la premiere connexion, puis
 * reutilise.
 *
 * Le verificateur PKCE et l'etat voyagent en cookie httpOnly : ils ne doivent
 * jamais transiter par l'URL ni par la base.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const settingsUrl = (params: string) =>
    new URL(`/admin/market/settings?section=integrations&${params}`, req.nextUrl.origin)

  try {
    const connection = await ensureGranolaConnection()
    const serverUrl = connection.server_url ?? GRANOLA_MCP_URL
    const redirectUri = `${req.nextUrl.origin}/api/integrations/granola/oauth/callback`

    const metadata = await discoverGranolaAuthServer(serverUrl)

    let clientId = connection.oauth_client_id
    let clientSecret: string | null = null

    if (!clientId) {
      if (!metadata.registration_endpoint) {
        return NextResponse.redirect(settingsUrl('granola=no_registration_endpoint'))
      }
      const registered = await registerGranolaClient({
        registrationEndpoint: metadata.registration_endpoint,
        redirectUri,
      })
      clientId = registered.client_id
      clientSecret = registered.client_secret
    }

    const pkce = createPkcePair()
    const state = crypto.randomUUID()

    await updateGranolaConnection(connection.id, {
      oauth_client_id: clientId,
      ...(clientSecret ? { encrypted_oauth_client_secret: encryptSecret(clientSecret) } : {}),
      oauth_metadata: metadata as unknown as Record<string, unknown>,
      server_url: serverUrl,
    })

    const authorizeUrl = buildGranolaAuthorizeUrl({
      metadata,
      clientId,
      redirectUri,
      state,
      challenge: pkce.challenge,
    })

    const res = NextResponse.redirect(authorizeUrl)
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    }
    res.cookies.set('mandat_os_granola_oauth_state', state, cookieOptions)
    res.cookies.set('mandat_os_granola_pkce', pkce.verifier, cookieOptions)
    return res
  } catch (err) {
    console.error('[GET /api/integrations/granola/oauth/start]', err)
    return NextResponse.redirect(
      settingsUrl(`granola=start_error&detail=${encodeURIComponent(err instanceof Error ? err.message : 'erreur')}`),
    )
  }
}

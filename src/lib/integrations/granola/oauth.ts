import { createHash, randomBytes } from 'crypto'

import { GRANOLA_MCP_URL } from './types'

/**
 * OAuth du MCP distant Granola.
 *
 * Piege n° 1 du brief : `granola_connections.encrypted_api_key` avait ete
 * concue pour une cle statique, que le plan gratuit ne fournit pas. Un jeton
 * d'acces colle a sa place expirerait, et la synchronisation s'arreterait en
 * silence. D'ou ce module : decouverte du serveur d'autorisation,
 * enregistrement dynamique du client (RFC 7591), PKCE, puis rafraichissement.
 *
 * Aucun secret n'est ecrit ici : le stockage chiffre est du ressort de
 * `connection.ts` et des routes OAuth.
 */

export type GranolaAuthServerMetadata = {
  issuer?: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
  scopes_supported?: string[]
  code_challenge_methods_supported?: string[]
  resource?: string
}

export type GranolaTokenSet = {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  scopes: string[]
}

export type GranolaPkcePair = {
  verifier: string
  challenge: string
}

/** Verificateur PKCE et son empreinte S256 (le seul methode acceptee par MCP). */
export function createPkcePair(): GranolaPkcePair {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Decouvre le serveur d'autorisation protegeant le MCP.
 *
 * On suit l'ordre prevu par la specification : metadonnees de la ressource
 * protegee, puis metadonnees du serveur d'autorisation. Un serveur qui n'expose
 * ni l'une ni l'autre tombe sur les chemins par defaut, ce qui evite d'echouer
 * sur une implementation partielle.
 */
export async function discoverGranolaAuthServer(serverUrl = GRANOLA_MCP_URL): Promise<GranolaAuthServerMetadata> {
  const base = new URL(serverUrl)
  const origin = base.origin

  let issuer = origin
  let resource = serverUrl

  const protectedResource = await fetchJson(`${origin}/.well-known/oauth-protected-resource`)
  if (protectedResource) {
    const servers = protectedResource.authorization_servers
    if (Array.isArray(servers) && typeof servers[0] === 'string') issuer = servers[0]
    if (typeof protectedResource.resource === 'string') resource = protectedResource.resource
  }

  const issuerUrl = new URL(issuer)
  const candidates = [
    `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname === '/' ? '' : issuerUrl.pathname}`,
    `${issuerUrl.origin}/.well-known/openid-configuration`,
  ]

  for (const candidate of candidates) {
    const metadata = await fetchJson(candidate)
    if (metadata?.authorization_endpoint && metadata?.token_endpoint) {
      return {
        issuer: typeof metadata.issuer === 'string' ? metadata.issuer : issuer,
        authorization_endpoint: String(metadata.authorization_endpoint),
        token_endpoint: String(metadata.token_endpoint),
        registration_endpoint:
          typeof metadata.registration_endpoint === 'string' ? metadata.registration_endpoint : undefined,
        scopes_supported: Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported.map(String) : undefined,
        code_challenge_methods_supported: Array.isArray(metadata.code_challenge_methods_supported)
          ? metadata.code_challenge_methods_supported.map(String)
          : undefined,
        resource,
      }
    }
  }

  // Repli sur les chemins conventionnels : mieux vaut tenter l'autorisation et
  // laisser Granola refuser explicitement qu'echouer avant d'avoir demande.
  return {
    issuer,
    authorization_endpoint: `${issuerUrl.origin}/authorize`,
    token_endpoint: `${issuerUrl.origin}/token`,
    registration_endpoint: `${issuerUrl.origin}/register`,
    resource,
  }
}

/**
 * Enregistrement dynamique du client (RFC 7591).
 *
 * Granola n'expose pas de console developpeur : le client est cree a la volee
 * lors de la premiere connexion, puis reutilise via `oauth_client_id`.
 */
export async function registerGranolaClient(input: {
  registrationEndpoint: string
  redirectUri: string
}): Promise<{ client_id: string; client_secret: string | null }> {
  const res = await fetch(input.registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Mandat OS',
      redirect_uris: [input.redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.client_id) {
    throw new Error(asOauthError(json, `Enregistrement du client OAuth refuse (${res.status})`))
  }

  return {
    client_id: String(json.client_id),
    client_secret: typeof json.client_secret === 'string' ? json.client_secret : null,
  }
}

export function buildGranolaAuthorizeUrl(input: {
  metadata: GranolaAuthServerMetadata
  clientId: string
  redirectUri: string
  state: string
  challenge: string
  scopes?: string[]
}): string {
  const url = new URL(input.metadata.authorization_endpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // `resource` lie le jeton au serveur MCP vise (RFC 8707) : sans lui, certains
  // serveurs d'autorisation delivrent un jeton que le MCP refusera.
  if (input.metadata.resource) url.searchParams.set('resource', input.metadata.resource)
  const scopes = input.scopes ?? input.metadata.scopes_supported
  if (scopes?.length) url.searchParams.set('scope', scopes.join(' '))
  return url.toString()
}

export async function exchangeGranolaCode(input: {
  metadata: GranolaAuthServerMetadata
  code: string
  verifier: string
  clientId: string
  clientSecret: string | null
  redirectUri: string
}): Promise<GranolaTokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.verifier,
  })
  if (input.metadata.resource) body.set('resource', input.metadata.resource)
  if (input.clientSecret) body.set('client_secret', input.clientSecret)

  return postTokenEndpoint(input.metadata.token_endpoint, body)
}

export async function refreshGranolaTokens(input: {
  refreshToken: string
  clientId: string | null
  clientSecret: string | null
  metadata: Record<string, unknown>
  serverUrl: string
}): Promise<GranolaTokenSet> {
  const tokenEndpoint =
    typeof input.metadata.token_endpoint === 'string'
      ? input.metadata.token_endpoint
      : (await discoverGranolaAuthServer(input.serverUrl)).token_endpoint

  if (!input.clientId) throw new Error('invalid_client: aucun client OAuth enregistre pour Granola')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: input.clientId,
  })
  if (typeof input.metadata.resource === 'string') body.set('resource', input.metadata.resource)
  if (input.clientSecret) body.set('client_secret', input.clientSecret)

  return postTokenEndpoint(tokenEndpoint, body)
}

async function postTokenEndpoint(endpoint: string, body: URLSearchParams): Promise<GranolaTokenSet> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token) {
    throw new Error(asOauthError(json, `Jeton Granola refuse (${res.status})`))
  }

  return {
    access_token: String(json.access_token),
    refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expires_at: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : null,
    scopes: typeof json.scope === 'string' ? json.scope.split(' ').filter(Boolean) : [],
  }
}

async function fetchJson(url: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as Record<string, any>
  } catch {
    return null
  }
}

function asOauthError(json: Record<string, any>, fallback: string): string {
  const code = typeof json?.error === 'string' ? json.error : null
  const description = typeof json?.error_description === 'string' ? json.error_description : null
  if (code && description) return `${code}: ${description}`
  return code ?? description ?? fallback
}

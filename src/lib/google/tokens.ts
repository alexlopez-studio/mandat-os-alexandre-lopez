import { decryptSecret, encryptSecret } from '@/lib/ai/crypto'
import { adminDb } from '@/lib/ai/db'

/** Marge avant expiration : on renouvelle un jeton qui expire dans moins d'une minute. */
const REFRESH_MARGIN_MS = 60 * 1000

type GoogleConnection = {
  id: string
  account_email: string | null
  encrypted_access_token: string | null
  encrypted_refresh_token: string | null
  expires_at: string | null
  status: string
}

async function loadConnection(): Promise<GoogleConnection | null> {
  const { data } = await adminDb()
    .from('google_connections')
    .select('id, account_email, encrypted_access_token, encrypted_refresh_token, expires_at, status')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

/**
 * Jeton d'accès Google valide, renouvelé à la volée si nécessaire.
 *
 * Retourne `null` quand aucun compte n'est connecté ou quand le renouvellement
 * échoue — dans ce cas la connexion est marquée `error` avec le motif, pour que
 * les Réglages puissent l'afficher plutôt que d'échouer en silence.
 *
 * À utiliser comme unique point d'entrée pour appeler une API Google : ne jamais
 * lire `encrypted_access_token` directement ailleurs.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const connection = await loadConnection()
  if (!connection || connection.status === 'revoked') return null

  const notExpired =
    connection.expires_at && new Date(connection.expires_at).getTime() - REFRESH_MARGIN_MS > Date.now()

  if (notExpired && connection.encrypted_access_token) {
    try {
      return decryptSecret(connection.encrypted_access_token)
    } catch (err) {
      console.error('[google/tokens] déchiffrement du jeton impossible:', err)
    }
  }

  if (!connection.encrypted_refresh_token) {
    await markError(connection.id, 'Aucun refresh_token : reconnectez le compte Google')
    return null
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    await markError(connection.id, 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants')
    return null
  }

  let refreshToken = ''
  try {
    refreshToken = decryptSecret(connection.encrypted_refresh_token)
  } catch (decryptErr) {
    console.error('[google/tokens] Déchiffrement du refresh_token impossible:', decryptErr)
    await markError(connection.id, 'Clé de déchiffrement modifiée : reconnectez le compte Google', 'error')
    return null
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const token = await res.json()

    if (!res.ok || !token.access_token) {
      // `invalid_grant` = refresh_token expiré ou révoqué : reconnexion requise.
      await markError(
        connection.id,
        token.error === 'invalid_grant'
          ? 'Autorisation Google expirée : reconnectez le compte'
          : (token.error_description ?? 'Renouvellement du jeton refusé'),
        token.error === 'invalid_grant' ? 'revoked' : 'error',
      )
      return null
    }

    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
      : null

    await adminDb()
      .from('google_connections')
      .update({
        encrypted_access_token: encryptSecret(token.access_token),
        expires_at: expiresAt,
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    return token.access_token as string
  } catch (err) {
    console.error('[google/tokens] renouvellement impossible:', err)
    await markError(connection.id, 'Renouvellement du jeton impossible')
    return null
  }
}

/** Scopes réellement accordés par Google lors de la dernière autorisation. */
export async function getGoogleGrantedScopes(): Promise<string[]> {
  const { data } = await adminDb()
    .from('google_connections')
    .select('scopes')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Array.isArray(data?.scopes) ? (data.scopes as string[]) : []
}

async function markError(id: string, message: string, status: 'error' | 'revoked' = 'error') {
  await adminDb()
    .from('google_connections')
    .update({ status, last_error: message, updated_at: new Date().toISOString() })
    .eq('id', id)
}

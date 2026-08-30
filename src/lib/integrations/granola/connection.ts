import { decryptSecret, encryptSecret } from '@/lib/ai/crypto'
import { adminDb } from '@/lib/ai/db'

import { refreshGranolaTokens } from './oauth'
import { GRANOLA_MCP_URL, GRANOLA_RETENTION_DAYS, GRANOLA_STALE_ALERT_DAYS } from './types'

/** Marge avant expiration : on renouvelle un jeton qui expire dans moins d'une minute. */
const REFRESH_MARGIN_MS = 60 * 1000

export type GranolaConnection = {
  id: string
  label: string
  status: 'active' | 'revoked' | 'error'
  account_email: string | null
  server_url: string | null
  encrypted_access_token: string | null
  encrypted_refresh_token: string | null
  token_expires_at: string | null
  scopes: string[] | null
  oauth_client_id: string | null
  encrypted_oauth_client_secret: string | null
  oauth_metadata: Record<string, unknown> | null
  last_synced_at: string | null
  last_cursor: string | null
  last_error: string | null
  updated_at: string | null
}

const CONNECTION_COLUMNS =
  'id, label, status, account_email, server_url, encrypted_access_token, encrypted_refresh_token, token_expires_at, scopes, oauth_client_id, encrypted_oauth_client_secret, oauth_metadata, last_synced_at, last_cursor, last_error, updated_at'

/** Connexion Granola courante (une seule dans Mandat OS), tous statuts confondus. */
export async function loadGranolaConnection(): Promise<GranolaConnection | null> {
  const { data, error } = await adminDb()
    .from('granola_connections')
    .select(CONNECTION_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as GranolaConnection | null) ?? null
}

/** Cree la connexion si elle n'existe pas encore, et renvoie son id. */
export async function ensureGranolaConnection(): Promise<GranolaConnection> {
  const existing = await loadGranolaConnection()
  if (existing) return existing

  const { data, error } = await adminDb()
    .from('granola_connections')
    .insert({ label: 'Granola', status: 'error', server_url: GRANOLA_MCP_URL, last_error: 'Connexion OAuth jamais realisee' })
    .select(CONNECTION_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return data as GranolaConnection
}

export async function updateGranolaConnection(id: string, patch: Record<string, unknown>) {
  const { error } = await adminDb()
    .from('granola_connections')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Bascule la connexion en `error` (ou `revoked`) avec son motif.
 *
 * Sans cela une expiration de jeton arreterait la synchronisation en silence,
 * et la fenetre de 30 jours ferait le reste : les reunions non ingerees
 * seraient perdues sans que rien ne l'ait signale.
 */
export async function markGranolaError(id: string, message: string, status: 'error' | 'revoked' = 'error') {
  await updateGranolaConnection(id, { status, last_error: message })
  console.error(`[granola] connexion ${status}: ${message}`)
}

/**
 * Jeton d'acces Granola valide, renouvele a la volee si necessaire.
 *
 * Unique point d'entree pour appeler le MCP : ne jamais lire
 * `encrypted_access_token` ailleurs.
 */
export async function getGranolaAccessToken(): Promise<{ token: string; connection: GranolaConnection } | null> {
  const connection = await loadGranolaConnection()
  if (!connection) return null
  if (connection.status === 'revoked') return null

  const stillValid =
    connection.token_expires_at && new Date(connection.token_expires_at).getTime() - REFRESH_MARGIN_MS > Date.now()

  if (stillValid && connection.encrypted_access_token) {
    try {
      return { token: decryptSecret(connection.encrypted_access_token), connection }
    } catch (err) {
      console.error('[granola] dechiffrement du jeton impossible:', err)
    }
  }

  if (!connection.encrypted_refresh_token) {
    await markGranolaError(connection.id, 'Aucun refresh_token : reconnectez Granola depuis les Reglages')
    return null
  }

  let refreshToken = ''
  try {
    refreshToken = decryptSecret(connection.encrypted_refresh_token)
  } catch {
    await markGranolaError(
      connection.id,
      'Cle de chiffrement modifiee : reconnectez Granola depuis les Reglages',
      'revoked',
    )
    return null
  }

  try {
    const refreshed = await refreshGranolaTokens({
      refreshToken,
      clientId: connection.oauth_client_id,
      clientSecret: connection.encrypted_oauth_client_secret
        ? decryptSecret(connection.encrypted_oauth_client_secret)
        : null,
      metadata: connection.oauth_metadata ?? {},
      serverUrl: connection.server_url ?? GRANOLA_MCP_URL,
    })

    const patch: Record<string, unknown> = {
      encrypted_access_token: encryptSecret(refreshed.access_token),
      token_expires_at: refreshed.expires_at,
      status: 'active',
      last_error: null,
    }
    // Rotation de refresh_token : ne jamais ecraser par `null`, cela couperait
    // definitivement le renouvellement.
    if (refreshed.refresh_token) patch.encrypted_refresh_token = encryptSecret(refreshed.refresh_token)

    await updateGranolaConnection(connection.id, patch)
    return { token: refreshed.access_token, connection: { ...connection, ...patch } as GranolaConnection }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Renouvellement du jeton impossible'
    const revoked = /invalid_grant|invalid_client|unauthorized_client/i.test(message)
    await markGranolaError(
      connection.id,
      revoked ? 'Autorisation Granola expiree : reconnectez le compte' : message,
      revoked ? 'revoked' : 'error',
    )
    return null
  }
}

export type GranolaFreshness = {
  last_synced_at: string | null
  days_since_sync: number | null
  stale: boolean
  lost_window: boolean
  message: string | null
}

/**
 * Fraicheur de la synchronisation.
 *
 * Le plan gratuit n'expose que les 30 derniers jours : passe ce delai, les
 * reunions non ingerees sont perdues sans recours. L'alerte se declenche a 20
 * jours pour laisser dix jours de marge.
 */
export function assessGranolaFreshness(lastSyncedAt: string | null): GranolaFreshness {
  if (!lastSyncedAt) {
    return {
      last_synced_at: null,
      days_since_sync: null,
      stale: true,
      lost_window: false,
      message: 'Aucune synchronisation Granola realisee a ce jour.',
    }
  }

  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000)
  const lostWindow = days >= GRANOLA_RETENTION_DAYS
  const stale = days >= GRANOLA_STALE_ALERT_DAYS

  return {
    last_synced_at: lastSyncedAt,
    days_since_sync: days,
    stale,
    lost_window: lostWindow,
    message: lostWindow
      ? `Derniere synchronisation il y a ${days} jours : au-dela de ${GRANOLA_RETENTION_DAYS} jours, les reunions sortent de la fenetre du plan gratuit et sont definitivement perdues.`
      : stale
        ? `Derniere synchronisation il y a ${days} jours : il reste ${GRANOLA_RETENTION_DAYS - days} jours avant la perte definitive des reunions non ingerees.`
        : null,
  }
}

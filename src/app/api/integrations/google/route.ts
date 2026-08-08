import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/ai/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/google
 * État de la connexion Google, pour la carte des Réglages.
 * Ne renvoie jamais de jeton, même chiffré.
 */
export async function GET() {
  try {
    const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

    const { data, error } = await adminDb()
      .from('google_connections')
      .select('account_email, scopes, expires_at, status, last_synced_at, last_error, updated_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== '42P01') {
      console.error('[GET /api/integrations/google]', error)
      return NextResponse.json({ success: false, error: 'Lecture impossible' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      configured,
      connection: data && data.status === 'active' ? data : null,
    })
  } catch (err) {
    console.error('[GET /api/integrations/google]', err)
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/google
 * Révoque l'autorisation côté Google puis efface les jetons stockés.
 * On efface localement même si la révocation distante échoue : le but premier
 * est que Mandat OS ne détienne plus de jeton.
 */
export async function DELETE() {
  try {
    const { data } = await adminDb()
      .from('google_connections')
      .select('id, encrypted_refresh_token')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data?.id) {
      return NextResponse.json({ success: true, already_disconnected: true })
    }

    if (data.encrypted_refresh_token) {
      try {
        const { decryptSecret } = await import('@/lib/ai/crypto')
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: decryptSecret(data.encrypted_refresh_token) }),
        })
      } catch (revokeError) {
        console.error('[DELETE /api/integrations/google] révocation Google:', revokeError)
      }
    }

    const { error } = await adminDb().from('google_connections').delete().eq('id', data.id)
    if (error) {
      console.error('[DELETE /api/integrations/google]', error)
      return NextResponse.json({ success: false, error: 'Déconnexion impossible' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/integrations/google]', err)
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 })
  }
}

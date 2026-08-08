import { NextResponse } from 'next/server'
import { getGoogleAccessToken } from '@/lib/google/tokens'

export const dynamic = 'force-dynamic'

/**
 * Appels de vérification, un par service autorisé. Tous en lecture et sans
 * effet de bord : on veut savoir si le jeton passe, pas produire de données.
 */
const CHECKS: Array<{ key: string; label: string; url: string }> = [
  { key: 'identite', label: 'Identité', url: 'https://www.googleapis.com/oauth2/v2/userinfo' },
  {
    // Le scope accordé est `calendar.events` : il ouvre les événements d'un
    // agenda, pas la liste des agendas (qui exige `calendar.readonly`).
    key: 'agenda',
    label: 'Agenda',
    url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
  },
  { key: 'gmail', label: 'Gmail', url: 'https://gmail.googleapis.com/gmail/v1/users/me/profile' },
  { key: 'drive', label: 'Drive', url: 'https://www.googleapis.com/drive/v3/about?fields=user' },
]

/**
 * GET /api/integrations/google/test
 * Vérifie de bout en bout que la connexion Google est exploitable : jeton
 * valide (renouvelé si besoin), puis un appel réel par service.
 * Ne renvoie jamais le jeton ni le contenu des réponses.
 */
export async function GET() {
  const accessToken = await getGoogleAccessToken()

  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: 'Aucun jeton Google exploitable. Reconnectez le compte.' },
      { status: 409 },
    )
  }

  const results = await Promise.all(
    CHECKS.map(async (check) => {
      try {
        const res = await fetch(check.url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) return { ...check, ok: true, detail: null }

        const body = await res.json().catch(() => ({}))
        const reason = body?.error?.message ?? `HTTP ${res.status}`
        return { ...check, ok: false, detail: reason }
      } catch {
        return { ...check, ok: false, detail: 'Appel impossible' }
      }
    }),
  )

  return NextResponse.json({
    success: results.every((result) => result.ok),
    checks: results.map(({ key, label, ok, detail }) => ({ key, label, ok, detail })),
  })
}

import { NextRequest, NextResponse } from 'next/server'

const GEO_API = 'https://geo.api.gouv.fr/communes'
const FIELDS = 'nom,code,codesPostaux,departement,population'

export interface CommuneResult {
  nom: string
  code: string // INSEE code
  codesPostaux: string[]
  departement: { code: string; nom: string }
  population?: number
}

/**
 * GET /api/market/communes
 *
 * Recherche de communes via l'API officielle geo.api.gouv.fr.
 *
 * Paramètres :
 *   ?q=barjols          → recherche par nom (≥ 2 caractères)
 *   ?codePostal=83670   → toutes les communes d'un code postal
 *   ?code=83019         → commune par code INSEE exact
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const codePostal = searchParams.get('codePostal')?.trim()
  const code = searchParams.get('code')?.trim()

  if (!q && !codePostal && !code) {
    return NextResponse.json({ error: 'Paramètre q, codePostal ou code requis' }, { status: 400 })
  }

  try {
    const params = new URLSearchParams({ fields: FIELDS, limit: '20' })

    if (code) {
      params.set('code', code)
    } else if (codePostal) {
      params.set('codePostal', codePostal)
    } else if (q) {
      if (q.length < 2) return NextResponse.json({ communes: [] })
      params.set('nom', q)
      params.set('boost', 'population')
    }

    const res = await fetch(`${GEO_API}?${params}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 }, // cache 1h — les données communes changent peu
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Erreur API geo.gouv.fr' }, { status: 502 })
    }

    const data: CommuneResult[] = await res.json()
    return NextResponse.json({ communes: data })
  } catch (e) {
    console.error('[API /market/communes]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

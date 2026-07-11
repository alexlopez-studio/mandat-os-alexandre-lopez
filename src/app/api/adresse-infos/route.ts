import { NextRequest, NextResponse } from 'next/server'
import { findDpeNearby } from '@/lib/ademe'
import { findParcelByPoint } from '@/lib/cadastre'

/**
 * GET /api/adresse-infos?lat=...&lng=...&q=...
 *
 * Phase B v2 — câblé sur les libs typées :
 *  - DPE : recherche par adresse BAN sur l'API open data ADEME,
 *    puis recherche géographique en repli
 *  - Parcelle : APICarto IGN
 *
 * La réponse reste volontairement explicite : même si une donnée n'est pas
 * trouvée, le front reçoit un statut lisible pour éviter l'impression que
 * rien ne s'est passé après la saisie d'une adresse.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const latStr = searchParams.get('lat')
  const lngStr = searchParams.get('lng')
  const address = searchParams.get('q') ?? undefined

  if (!latStr || !lngStr) {
    return NextResponse.json(
      { error: 'lat et lng requis' },
      { status: 400 },
    )
  }

  const lat = Number(latStr)
  const lng = Number(lngStr)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: 'lat et lng invalides' },
      { status: 400 },
    )
  }

  const result: {
    dpe?: {
      lettre: string
      confidence: 'exact' | 'approximatif' | 'non_trouve'
      numero?: string
      adresse?: string | null
      annee_construction?: number | null
    }
    dpeStatus: 'found' | 'not_found'
    parcelle?: {
      id: string
      idu: string
      commune: string
      surface: number | null
    }
    parcelleStatus: 'found' | 'not_found'
    message: string
  } = {
    dpeStatus: 'not_found',
    parcelleStatus: 'not_found',
    message: 'Vérification terminée.',
  }

  const [dpeLookup, parcel] = await Promise.all([
    findDpeNearby({ lat, lng, address, radius: 500 }),
    findParcelByPoint({ lat, lng }),
  ])

  if (dpeLookup.dpe?.etiquette_dpe) {
    result.dpeStatus = 'found'
    result.dpe = {
      lettre: dpeLookup.dpe.etiquette_dpe,
      confidence: dpeLookup.confidence,
      numero: dpeLookup.dpe.numero_dpe,
      adresse: dpeLookup.dpe.adresse_ban,
      annee_construction: dpeLookup.dpe.annee_construction,
    }
  } else {
    result.dpe = {
      lettre: 'Non trouvé',
      confidence: 'non_trouve',
    }
  }

  if (parcel) {
    result.parcelleStatus = 'found'
    result.parcelle = {
      id: parcel.section + '-' + parcel.numero,
      idu: parcel.idu,
      commune: parcel.nom_com,
      surface: parcel.contenance_m2,
    }
  } else {
    result.parcelle = {
      id: 'Non trouvée',
      idu: '',
      commune: '',
      surface: null,
    }
  }

  if (result.dpeStatus === 'found' && result.parcelleStatus === 'found') {
    result.message = 'DPE et parcelle retrouvés.'
  } else if (result.dpeStatus === 'found') {
    result.message = 'DPE retrouvé. Parcelle non retrouvée automatiquement.'
  } else if (result.parcelleStatus === 'found') {
    result.message = 'Parcelle retrouvée. DPE non retrouvé automatiquement.'
  } else {
    result.message = 'Adresse vérifiée, mais aucun DPE ni aucune parcelle n’a été retrouvé automatiquement.'
  }

  return NextResponse.json(result)
}

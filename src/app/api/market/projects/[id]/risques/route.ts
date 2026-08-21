import { NextRequest, NextResponse } from 'next/server'
import { fetchPropertyRisks } from '@/lib/market/georisques'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Risques de la parcelle, pour preparer l'ERP.
 *
 * Lecture seule et purement informative : rien n'est ecrit en base, ni dans le
 * contexte de vente. Georisques renseigne, le conseiller decide.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('property_address, property_city, property_zipcode')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      console.error('[API /market/projects/[id]/risques] error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }
    if (!project) {
      return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
    }

    const row = project as {
      property_address: string | null
      property_city: string | null
      property_zipcode: string | null
    }

    const report = await fetchPropertyRisks({
      address: row.property_address,
      city: row.property_city,
      zipcode: row.property_zipcode,
    })

    // Pas d'adresse exploitable ou service indisponible : ce n'est pas une
    // erreur du dossier, le panneau affiche simplement son etat vide.
    return NextResponse.json({ success: true, report })
  } catch (err) {
    console.error('[API /market/projects/[id]/risques]', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'
import { purgeMarketPropertiesByZipcode } from '@/lib/market/property-cleanup'
import {
  deleteStreamEstateSavedSearchForZone,
  ensureStreamEstateSavedSearchForZone,
} from '@/lib/market/stream-estate-searches'

type ZonesUpdate = Database['public']['Tables']['monitored_zones']['Update']

/**
 * GET /api/market/zones/[id]
 * Détail d'une zone surveillée.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data: zone, error } = await supabaseAdmin
      .from('monitored_zones')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Zone introuvable' }, { status: 404 })
      }
      console.error('[API /market/zones/[id]] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    if (zone?.active) {
      await ensureStreamEstateSavedSearchForZone(zone)
    } else if (zone?.stream_estate_search_id) {
      await deleteStreamEstateSavedSearchForZone(zone.stream_estate_search_id)
      await supabaseAdmin
        .from('monitored_zones')
        .update({ stream_estate_search_id: null } as never)
        .eq('id', id)
    }

    return NextResponse.json({ zone })
  } catch (e) {
    console.error('[API /market/zones/[id]] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/market/zones/[id]
 * Met à jour une zone surveillée.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Vérifier que la zone existe
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('monitored_zones')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Zone introuvable' }, { status: 404 })
    }

    const updateData: ZonesUpdate = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.zipcode !== undefined) updateData.zipcode = body.zipcode
    if (body.city !== undefined) updateData.city = body.city
    if (body.insee_code !== undefined) updateData.insee_code = body.insee_code
    if (body.active !== undefined) updateData.active = Boolean(body.active)
    if (body.sync_frequency !== undefined) updateData.sync_frequency = body.sync_frequency

    const { data: zone, error } = await supabaseAdmin
      .from('monitored_zones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /market/zones/[id]] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ zone })
  } catch (e) {
    console.error('[API /market/zones/[id]] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/market/zones/[id]
 * Supprime une zone surveillée.
 * Cascade : supprime les biens associés si aucune autre zone active
 * ne surveille le même code postal.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('monitored_zones')
      .select('id, zipcode, stream_estate_search_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Zone introuvable' }, { status: 404 })
    }

    const zipcode = existing.zipcode
    const searchId = (existing as { stream_estate_search_id?: string | null }).stream_estate_search_id ?? null

    // Supprimer la zone
    const { error } = await supabaseAdmin
      .from('monitored_zones')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API /market/zones/[id]] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
    }

    await deleteStreamEstateSavedSearchForZone(searchId)

    // Vérifier si d'autres zones actives utilisent le même code postal
    const { count: remainingZones } = await supabaseAdmin
      .from('monitored_zones')
      .select('id', { count: 'exact', head: true })
      .eq('zipcode', zipcode)

    let deletedProperties = 0
    if (!remainingZones || remainingZones === 0) {
      // Plus aucune zone ne surveille ce code postal → purge des biens
      const purge = await purgeMarketPropertiesByZipcode(zipcode)
      if (purge.error) {
        console.error('[API /market/zones/[id]] property purge error:', purge.error)
        return NextResponse.json({ error: 'Zone supprimée, mais purge des biens impossible' }, { status: 500 })
      }
      deletedProperties = purge.deletedProperties
    }

    return NextResponse.json({ success: true, deleted_properties: deletedProperties })
  } catch (e) {
    console.error('[API /market/zones/[id]] DELETE', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

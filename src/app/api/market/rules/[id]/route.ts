import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

type RulesUpdate = Database['public']['Tables']['management_rules']['Update']

/**
 * GET /api/market/rules/[id]
 * Détail d'une règle de gestion.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data: rule, error } = await supabaseAdmin
      .from('management_rules')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Règle introuvable' }, { status: 404 })
      }
      console.error('[API /market/rules/[id]] GET error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (e) {
    console.error('[API /market/rules/[id]] GET', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/market/rules/[id]
 * Met à jour une règle de gestion.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Vérifier que la règle existe
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('management_rules')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Règle introuvable' }, { status: 404 })
    }

    // Champs modifiables
    const updateData: RulesUpdate = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.active !== undefined) updateData.active = Boolean(body.active)
    if (body.trigger_type !== undefined) updateData.trigger_type = body.trigger_type
    if (body.conditions_json !== undefined) updateData.conditions_json = body.conditions_json
    if (body.actions_json !== undefined) updateData.actions_json = body.actions_json
    if (body.priority !== undefined) updateData.priority = body.priority

    const { data: rule, error } = await supabaseAdmin
      .from('management_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /market/rules/[id]] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (e) {
    console.error('[API /market/rules/[id]] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/market/rules/[id]
 * Supprime une règle de gestion.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('management_rules')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Règle introuvable' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('management_rules')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API /market/rules/[id]] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API /market/rules/[id]] DELETE', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
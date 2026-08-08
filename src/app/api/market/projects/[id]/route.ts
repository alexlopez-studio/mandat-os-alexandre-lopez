import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      console.error('[API /market/projects/[id]] error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }
    if (!project) {
      return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
    }

    return NextResponse.json({ project }, { status: 200 })
  } catch (error) {
    console.error('[API /market/projects/[id]] error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params
    const body = await req.json()

    const payload: Database['public']['Tables']['projects']['Update'] = {}
    if ('stage' in body && typeof body.stage === 'string' && body.stage.trim()) {
      payload.stage = body.stage.trim()
    }
    if ('priority' in body) payload.priority = body.priority || 'normal'
    if ('next_action' in body) payload.next_action = body.next_action || null
    if ('due_date' in body) payload.due_date = body.due_date || null
    if ('active' in body) payload.active = typeof body.active === 'boolean' ? body.active : null

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .update(payload)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error || !project) {
      console.error('[API /market/projects/[id]] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du projet' }, { status: 500 })
    }

    return NextResponse.json({ project }, { status: 200 })
  } catch (error) {
    console.error('[API /market/projects/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

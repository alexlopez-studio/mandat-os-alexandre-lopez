import { NextRequest, NextResponse } from 'next/server'

import { isMachineOrAdmin } from '@/lib/api-machine-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { NewsStatus } from '@/types/supabase'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set<string>([
  'new',
  'reviewed',
  'newsletter',
  'published',
  'archived',
])

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const params = await props.params
    const body = await req.json()
    const status = body?.status

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // `updated_at` est pose par le trigger `news_items_updated_at` (migration 052).
    const { data, error } = await supabaseAdmin
      .from('news_items')
      .update({ status: status as NewsStatus })
      .eq('id', params.id)
      .select('*')
      .single()

    if (error || !data) {
      console.error('[API /market/news/[id]] PATCH', error)
      return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (error) {
    console.error('[API /market/news/[id]] PATCH', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isMachineOrAdmin(req))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const params = await props.params
    const { error } = await supabaseAdmin.from('news_items').delete().eq('id', params.id)

    if (error) {
      console.error('[API /market/news/[id]] DELETE', error)
      return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API /market/news/[id]] DELETE', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

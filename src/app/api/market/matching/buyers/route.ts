/**
 * GET /api/market/matching/buyers
 * Retourne la liste des acheteurs (buyer_criteria) actifs
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: buyers, error } = await supabaseAdmin
      .from('buyer_criteria')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[API /matching/buyers]', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({ buyers: buyers ?? [] })
  } catch (e) {
    console.error('[API /matching/buyers]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
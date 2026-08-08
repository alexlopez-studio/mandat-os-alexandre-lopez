import { NextRequest, NextResponse } from 'next/server'
import { scanBuyerLeadsFromGmail } from '@/lib/email-scanner/buyer-leads-scanner'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest) {
  try {
    const { data: events, error } = await supabaseAdmin
      .from('lead_events')
      .select('id, lead_id, payload, created_at')
      .eq('kind', 'email' as never)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('[API /api/cron/scan-emails] GET error:', error)
      return NextResponse.json({ error: 'Erreur lecture historique' }, { status: 500 })
    }

    return NextResponse.json({ success: true, history: events || [] })
  } catch (e) {
    console.error('[API /api/cron/scan-emails] GET exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 15))

    const summary = await scanBuyerLeadsFromGmail(limit)

    if (!summary.success) {
      return NextResponse.json({ error: summary.error || 'Erreur lors du scan' }, { status: 400 })
    }

    return NextResponse.json(summary)
  } catch (e) {
    console.error('[API /api/cron/scan-emails] POST exception:', e)
    return NextResponse.json({ error: 'Erreur serveur lors de la numérisation' }, { status: 500 })
  }
}

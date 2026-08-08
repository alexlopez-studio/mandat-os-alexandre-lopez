import { NextRequest, NextResponse } from 'next/server'
import { scanBuyerLeadsFromGmail } from '@/lib/email-scanner/buyer-leads-scanner'
import { getCurrentAdmin } from '@/lib/auth'

/**
 * Scan des e-mails acquéreurs.
 *
 *  - GET  : appelé par le cron Vercel (les crons ne savent émettre que des GET).
 *           Protégé par CRON_SECRET dès que la variable est définie.
 *  - POST : déclenchement manuel depuis l'écran Acquéreurs, réservé à un admin
 *           connecté.
 *
 * La route consomme des appels IA et lit la boîte Gmail : la laisser ouverte,
 * comme c'était le cas, permettait à n'importe qui de déclencher les deux.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // limite plan Hobby Vercel

function parseLimit(req: NextRequest) {
  const raw = Number(new URL(req.url).searchParams.get('limit'))
  return Math.min(50, Math.max(1, raw || 15))
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else if (!(await getCurrentAdmin())) {
    // Sans CRON_SECRET configuré, on n'ouvre pas la route pour autant : seule
    // une session admin peut la déclencher.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const summary = await scanBuyerLeadsFromGmail(parseLimit(req))
  return NextResponse.json(summary, { status: summary.success ? 200 : 400 })
}

export async function POST(req: NextRequest) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const summary = await scanBuyerLeadsFromGmail(parseLimit(req))
    if (!summary.success) {
      return NextResponse.json({ error: summary.error || 'Erreur lors du scan' }, { status: 400 })
    }
    return NextResponse.json(summary)
  } catch (e) {
    console.error('[API /api/cron/scan-emails] POST exception:', e)
    return NextResponse.json({ error: 'Erreur serveur lors de la numérisation' }, { status: 500 })
  }
}

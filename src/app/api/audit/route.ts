import { NextRequest, NextResponse } from 'next/server'
import { calculerAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = calculerAudit(body)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[API /audit]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

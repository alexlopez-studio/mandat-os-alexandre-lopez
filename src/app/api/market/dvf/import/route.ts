import { NextRequest, NextResponse } from 'next/server'
import { importDvfCommune } from '@/lib/dvf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const inseeCode = String(body.insee_code ?? '').trim()

    if (!inseeCode) {
      return NextResponse.json({ error: 'insee_code requis' }, { status: 400 })
    }

    const result = await importDvfCommune({
      inseeCode,
      communeName: body.name ? String(body.name) : null,
      zipcode: body.zipcode ? String(body.zipcode) : null,
      year: body.year ?? null,
    })

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error('[API /market/dvf/import] POST', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erreur import DVF',
    }, { status: 500 })
  }
}

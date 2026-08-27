import { NextRequest, NextResponse } from 'next/server'
import {
  listBonsDeVisite,
  saveBonDeVisite,
  updateBonDeVisiteEmailStatus,
} from '@/lib/bon-de-visite/storage'
import type { CreateBonDeVisiteInput } from '@/lib/bon-de-visite/types'
import { sendBonDeVisiteEmail } from '@/lib/resend'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100

    const bons = await listBonsDeVisite({ search, projectId, limit })
    return NextResponse.json({ bons, total: bons.length })
  } catch (error) {
    console.error('[API /market/bons-de-visite] GET error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des bons de visite' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBonDeVisiteInput

    // Validations
    if (!body.property_address?.trim()) {
      return NextResponse.json({ error: "L'adresse du bien est obligatoire" }, { status: 400 })
    }
    if (!body.property_city?.trim()) {
      return NextResponse.json({ error: 'La commune du bien est obligatoire' }, { status: 400 })
    }
    if (!body.visitors || !Array.isArray(body.visitors) || body.visitors.length === 0) {
      return NextResponse.json({ error: 'Au moins un visiteur doit être renseigné' }, { status: 400 })
    }

    for (let i = 0; i < body.visitors.length; i++) {
      const v = body.visitors[i]
      if (!v.first_name?.trim() || !v.last_name?.trim()) {
        return NextResponse.json(
          { error: `Nom et prénom requis pour le visiteur #${i + 1}` },
          { status: 400 }
        )
      }
      if (!v.cni_number?.trim()) {
        return NextResponse.json(
          { error: `Numéro de pièce d'identité requis pour le visiteur #${i + 1} (${v.first_name} ${v.last_name})` },
          { status: 400 }
        )
      }
      if (v.email?.trim() && !v.email.includes('@')) {
        return NextResponse.json(
          { error: `Adresse e-mail invalide pour le visiteur #${i + 1} (${v.first_name} ${v.last_name})` },
          { status: 400 }
        )
      }
    }

    if (!body.signature_data_url?.startsWith('data:image/')) {
      return NextResponse.json({ error: 'La signature tactile est requise' }, { status: 400 })
    }

    // Enregistrement & Synchronisation
    const bon = await saveBonDeVisite(body)

    // Envoi des emails aux visiteurs qui ont fourni une adresse e-mail
    const origin = req.headers.get('origin') || req.headers.get('host') || 'http://localhost:3002'
    const siteUrl = origin.startsWith('http') ? origin : `http://${origin}`

    const emailableVisitors = bon.visitors.filter((v) => v.email && v.email.includes('@'))
    let sentCount = 0

    for (const visitor of emailableVisitors) {
      try {
        const ok = await sendBonDeVisiteEmail({
          bon,
          recipient: visitor,
          siteUrl,
        })
        if (ok) sentCount++
      } catch (err) {
        console.error(`[API /market/bons-de-visite] Failed to send email to ${visitor.email}:`, err)
      }
    }

    const emailStatus =
      emailableVisitors.length === 0
        ? 'sent'
        : sentCount === emailableVisitors.length
        ? 'sent'
        : sentCount > 0
        ? 'partial'
        : 'failed'

    await updateBonDeVisiteEmailStatus(bon.id, emailStatus)
    bon.email_status = emailStatus
    bon.email_sent_at = new Date().toISOString()

    return NextResponse.json(
      {
        success: true,
        bon,
        public_url: `${siteUrl}/bon-de-visite/${bon.token}`,
        emails_sent: sentCount,
        emails_total: emailableVisitors.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API /market/bons-de-visite] POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la création du bon de visite' }, { status: 500 })
  }
}

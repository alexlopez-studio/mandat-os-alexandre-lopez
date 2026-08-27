import { NextRequest, NextResponse } from 'next/server'
import { getBonDeVisiteById, updateBonDeVisiteEmailStatus } from '@/lib/bon-de-visite/storage'
import { sendBonDeVisiteEmail } from '@/lib/resend'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bon = await getBonDeVisiteById(id)
    if (!bon) {
      return NextResponse.json({ error: 'Bon de visite introuvable' }, { status: 404 })
    }

    const origin = req.headers.get('origin') || req.headers.get('host') || 'http://localhost:3002'
    const siteUrl = origin.startsWith('http') ? origin : `http://${origin}`

    let sentCount = 0
    for (const visitor of bon.visitors) {
      if (!visitor.email) continue
      try {
        const ok = await sendBonDeVisiteEmail({
          bon,
          recipient: visitor,
          siteUrl,
        })
        if (ok) sentCount++
      } catch (err) {
        console.error(`[API /market/bons-de-visite/[id]/resend] Error for ${visitor.email}:`, err)
      }
    }

    const emailStatus =
      sentCount === bon.visitors.length
        ? 'sent'
        : sentCount > 0
        ? 'partial'
        : 'failed'

    await updateBonDeVisiteEmailStatus(bon.id, emailStatus)

    return NextResponse.json({
      success: true,
      sent_count: sentCount,
      total_count: bon.visitors.length,
      email_status: emailStatus,
    })
  } catch (error) {
    console.error('[API /market/bons-de-visite/[id]/resend] POST error:', error)
    return NextResponse.json({ error: 'Erreur lors du renvoi des emails' }, { status: 500 })
  }
}

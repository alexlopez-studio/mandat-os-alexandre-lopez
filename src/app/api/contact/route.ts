import { NextRequest, NextResponse } from 'next/server'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'Site Alex Lopez <contact@alexlopez-provence.fr>'
const TO = 'alexlopez.studio@gmail.com'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * POST /api/contact
 *
 * Phase B (hotfix) : la route ne persiste plus rien côté DB. Elle forwarde le
 * message au mailbox admin (`alexlopez.studio@gmail.com`) via Resend, avec
 * `reply_to` positionné sur l'email du prospect pour pouvoir répondre directement.
 *
 * Migration vers une table dédiée (`contacts` ou `lead_events kind=note`) à
 * décider quand le dashboard admin Phase B sera opérationnel.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = asString(body?.email)
    const message = asString(body?.message)

    if (!email || !message) {
      return NextResponse.json(
        { error: 'Email et message requis' },
        { status: 400 },
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[Contact API] RESEND_API_KEY manquant')
      return NextResponse.json(
        { error: 'Service indisponible' },
        { status: 503 },
      )
    }

    const prenom = asString(body?.prenom)
    const nom = asString(body?.nom)
    const telephone = asString(body?.telephone)
    const sujet = asString(body?.sujet)
    const commune = asString(body?.commune)
    const fullName = `${prenom} ${nom}`.trim()
    const subject = sujet ? `[Contact] ${sujet}` : '[Contact] Nouveau message'

    const htmlLines: string[] = []
    if (fullName)
      htmlLines.push(`<p><strong>De :</strong> ${escapeHtml(fullName)}</p>`)
    htmlLines.push(`<p><strong>Email :</strong> ${escapeHtml(email)}</p>`)
    if (telephone)
      htmlLines.push(
        `<p><strong>Téléphone :</strong> ${escapeHtml(telephone)}</p>`,
      )
    if (commune)
      htmlLines.push(`<p><strong>Commune :</strong> ${escapeHtml(commune)}</p>`)
    if (sujet)
      htmlLines.push(`<p><strong>Sujet :</strong> ${escapeHtml(sujet)}</p>`)
    htmlLines.push('<hr style="margin:16px 0;border:0;border-top:1px solid #E2E8F0"/>')
    htmlLines.push(
      `<p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(message)}</p>`,
    )
    const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#0F172A;padding:16px">${htmlLines.join(
      '',
    )}</body></html>`

    const textLines = [
      fullName ? `De : ${fullName}` : null,
      `Email : ${email}`,
      telephone ? `Téléphone : ${telephone}` : null,
      commune ? `Commune : ${commune}` : null,
      sujet ? `Sujet : ${sujet}` : null,
      '',
      message,
    ]
      .filter((line): line is string => line !== null)
      .join('\n')

    try {
      const r = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          reply_to: email,
          subject,
          html,
          text: textLines,
        }),
      })
      if (!r.ok) {
        console.error('[Contact API] Resend non-OK :', await r.text())
        return NextResponse.json(
          { error: 'Erreur envoi message' },
          { status: 502 },
        )
      }
    } catch (err) {
      console.error('[Contact API] Resend network error :', err)
      return NextResponse.json(
        { error: 'Erreur réseau' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Contact API] Error :', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

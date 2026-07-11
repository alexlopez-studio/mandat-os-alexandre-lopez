export interface GoldenListing {
  id: string
  title: string | null
  city: string | null
  zipcode: string | null
  property_type: string | null
  price: number | null
  surface: number | null
  score: number
  days_online: number
  price_drops_count: number
  total_drop_percent: number | null
  is_relisted: boolean
  url: string | null
}

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function phaseLabel(score: number): string {
  if (score >= 71) return '🟡 Fenêtre d\'or'
  return '🔴 Golden'
}

function signalTags(l: GoldenListing): string {
  const tags: string[] = []
  if (l.days_online >= 90) tags.push(`${l.days_online}j en ligne`)
  if (l.price_drops_count >= 2) tags.push(`${l.price_drops_count} baisses de prix`)
  else if (l.price_drops_count === 1) tags.push('1 baisse de prix')
  if (l.total_drop_percent && l.total_drop_percent >= 3)
    tags.push(`−${l.total_drop_percent.toFixed(1)}% au total`)
  if (l.is_relisted) tags.push('Republié')
  return tags.map((t) => `<span style="display:inline-block;background:#fef9c3;color:#713f12;border:1px solid #fde68a;border-radius:4px;padding:2px 8px;font-size:12px;margin:2px 2px 0 0">${t}</span>`).join('')
}

export function buildGoldenAlertEmail(listings: GoldenListing[]): {
  subject: string
  html: string
  text: string
} {
  const count = listings.length
  const subject = count === 1
    ? '🟡 1 nouvelle fenêtre d\'or MandatFinder'
    : `🟡 ${count} nouvelles fenêtres d\'or MandatFinder`

  const cards = listings.map((l) => {
    const priceStr = l.price ? `${fmt(l.price)} €` : 'Prix NC'
    const surfaceStr = l.surface ? `${l.surface} m²` : ''
    const priceM2 = l.price && l.surface ? `· ${fmt(Math.round(l.price / l.surface))} €/m²` : ''
    const typeStr = l.property_type ?? ''
    const locationStr = [l.city, l.zipcode].filter(Boolean).join(' ')
    const urlHtml = l.url
      ? `<a href="${l.url}" style="display:inline-block;margin-top:12px;background:#1d4ed8;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">Voir l'annonce →</a>`
      : ''

    return `
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:16px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <span style="font-size:13px;font-weight:700;color:#111">${l.title ?? 'Annonce sans titre'}</span>
    <span style="background:#fef08a;color:#713f12;font-weight:700;font-size:13px;padding:4px 10px;border-radius:20px">Score ${l.score}</span>
  </div>
  <p style="margin:0 0 4px;color:#6b7280;font-size:13px">${typeStr}${typeStr && locationStr ? ' · ' : ''}${locationStr}</p>
  <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111">${priceStr} ${surfaceStr} ${priceM2}</p>
  <div style="margin-bottom:8px">${signalTags(l)}</div>
  ${urlHtml}
</div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;padding:0 16px">

  <!-- Header -->
  <div style="background:#1d4ed8;border-radius:10px 10px 0 0;padding:24px 28px">
    <p style="margin:0;color:#bfdbfe;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">MandatFinder</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700">${subject}</h1>
  </div>

  <!-- Body -->
  <div style="background:#f9fafb;padding:24px 28px">
    <p style="margin:0 0 20px;color:#374151;font-size:14px">
      ${count === 1
        ? 'Un bien vient de passer en phase <strong>fenêtre d\'or</strong> — c\'est le moment d\'appeler.'
        : `${count} biens viennent de passer en phase <strong>fenêtre d'or</strong> — c'est le moment d'appeler.`}
    </p>
    ${cards}
    <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">
      Généré automatiquement par le pipeline MandatFinder ·
      <a href="https://site-alex-lopez-provence.vercel.app/app/radar" style="color:#6b7280">Voir le Radar complet</a>
    </p>
  </div>

</div>
</body>
</html>`

  const text = [
    subject,
    '',
    ...listings.map((l) => {
      const signals: string[] = []
      if (l.days_online >= 30) signals.push(`${l.days_online}j en ligne`)
      if (l.price_drops_count > 0) signals.push(`${l.price_drops_count} baisse(s)`)
      if (l.is_relisted) signals.push('republié')
      return [
        `• ${l.title ?? 'Annonce sans titre'} — Score ${l.score}`,
        `  ${l.property_type ?? ''} ${l.city ?? ''} ${l.zipcode ?? ''}`.trim(),
        `  ${l.price ? fmt(l.price) + ' €' : 'Prix NC'}${l.surface ? ' · ' + l.surface + ' m²' : ''}`,
        signals.length ? `  Signaux : ${signals.join(', ')}` : '',
        l.url ? `  ${l.url}` : '',
      ].filter(Boolean).join('\n')
    }),
    '',
    'Radar complet : https://site-alex-lopez-provence.vercel.app/app/radar',
  ].join('\n')

  return { subject, html, text }
}

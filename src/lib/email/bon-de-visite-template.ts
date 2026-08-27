import type { BonDeVisite, VisitorInfo } from '../bon-de-visite/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateFr(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return isoDate
  }
}

export function buildBonDeVisiteEmail(params: {
  bon: BonDeVisite
  recipient: VisitorInfo
  documentUrl: string
}): {
  subject: string
  html: string
  text: string
} {
  const { bon, recipient, documentUrl } = params
  const safeUrl = escapeHtml(documentUrl)
  const formattedDate = formatDateFr(bon.visit_at)
  const greeting = recipient.first_name?.trim()
    ? `Bonjour ${escapeHtml(recipient.first_name.trim())},`
    : 'Bonjour,'

  const propertyLabel = [
    bon.property_type || 'Bien immobilier',
    bon.property_city ? `à ${bon.property_city}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const subject = `Votre bon de recherche, d'indication et de visite — ${bon.reference} (${propertyLabel})`

  const visitorsListHtml = bon.visitors
    .map(
      (v) =>
        `<tr>
          <td style="padding:6px 0;font-size:14px;color:#334155;border-bottom:1px solid #F1F5F9">
            <strong>${escapeHtml(v.first_name)} ${escapeHtml(v.last_name)}</strong>
          </td>
          <td style="padding:6px 0;font-size:13px;color:#64748B;text-align:right;border-bottom:1px solid #F1F5F9">
            CNI n° ${escapeHtml(v.cni_number)}
          </td>
        </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
          
          <!-- En-tête -->
          <tr>
            <td style="padding:32px 32px 16px;background:#ffffff">
              <div style="font-size:12px;font-weight:700;color:#0077B6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">iad France · Alexandre Lopez</div>
              <h1 style="margin:0;font-size:20px;font-weight:800;color:#0F172A;line-height:1.3">BON DE RECHERCHE, D'INDICATION ET DE VISITE</h1>
              <div style="font-size:14px;font-weight:600;color:#475569;margin-top:4px">${greeting}</div>
            </td>
          </tr>

          <!-- Message principal -->
          <tr>
            <td style="padding:0 32px 20px">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">
                Nous vous remercions pour la visite effectuée ce jour. Vous trouverez ci-dessous la confirmation ainsi que l'accès sécurisé à votre <strong>bon de visite certifié et signé</strong>.
              </p>
            </td>
          </tr>

          <!-- Carte Récapitulatif Bien & Visite -->
          <tr>
            <td style="padding:0 32px 24px">
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:12px">
                      <span style="font-size:12px;color:#64748B;text-transform:uppercase;font-weight:600;display:block">Réf. Bon de visite</span>
                      <strong style="font-size:15px;color:#0F172A">${escapeHtml(bon.reference)}</strong>
                    </td>
                    <td style="padding-bottom:12px;text-align:right">
                      <span style="font-size:12px;color:#64748B;text-transform:uppercase;font-weight:600;display:block">Date de visite</span>
                      <strong style="font-size:14px;color:#0F172A">${escapeHtml(formattedDate)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:8px;border-top:1px solid #E2E8F0">
                      <span style="font-size:12px;color:#64748B;text-transform:uppercase;font-weight:600;display:block">Bien visité</span>
                      <div style="font-size:15px;font-weight:700;color:#0F172A;margin-top:2px">
                        ${escapeHtml(bon.property_address)}, ${escapeHtml(bon.property_zipcode || '')} ${escapeHtml(bon.property_city)}
                      </div>
                      ${
                        bon.property_price
                          ? `<div style="font-size:13px;color:#0077B6;font-weight:600;margin-top:4px">Prix de présentation : ${bon.property_price.toLocaleString('fr-FR')} €</div>`
                          : ''
                      }
                    </td>
                  </tr>
                </table>

                <!-- Liste des visiteurs -->
                <div style="margin-top:16px;padding-top:12px;border-top:1px solid #E2E8F0">
                  <span style="font-size:12px;color:#64748B;text-transform:uppercase;font-weight:600;display:block;margin-bottom:8px">Visiteur(s) enregistré(s)</span>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${visitorsListHtml}
                  </table>
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA Bouton -->
          <tr>
            <td align="center" style="padding:0 32px 28px">
              <a href="${safeUrl}" style="display:inline-block;background:#0077B6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;font-size:15px;box-shadow:0 2px 4px rgba(0,119,182,0.2)">
                Consulter / Télécharger le bon signé
              </a>
            </td>
          </tr>

          <!-- Rappel légal succinct -->
          <tr>
            <td style="padding:0 32px 20px">
              <div style="font-size:12px;line-height:1.5;color:#64748B;background:#F1F5F9;padding:12px 16px;border-radius:8px">
                <strong>Rappel :</strong> Ce document atteste de votre visite par l'intermédiaire d'Alexandre Lopez (iad France). Il emporte engagement de ne pas négocier l'acquisition de ce bien directement avec le vendeur ou un autre tiers pendant la durée légale.
              </div>
            </td>
          </tr>

          <!-- Séparateur -->
          <tr>
            <td style="padding:0 32px 8px">
              <hr style="border:none;border-top:1px solid #E2E8F0;margin:0">
            </td>
          </tr>

          <!-- Signature & Contact conseiller -->
          <tr>
            <td style="padding:20px 32px 28px">
              <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#475569">
                Je reste à votre entière disposition pour tout renseignement complémentaire, transmission des diagnostics ou organisation d'une contre-visite.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <strong style="font-size:14px;color:#0F172A">${escapeHtml(bon.advisor_name)}</strong><br>
                    <span style="font-size:13px;color:#64748B">Conseiller immobilier indépendant · iad France</span><br>
                    <span style="font-size:12px;color:#94A3B8">${escapeHtml(bon.advisor_rsac)}</span>
                  </td>
                  <td style="text-align:right">
                    <a href="tel:+33613180168" style="color:#0077B6;text-decoration:none;font-weight:700;font-size:14px">${escapeHtml(bon.advisor_phone)}</a><br>
                    <a href="mailto:${escapeHtml(bon.advisor_email)}" style="color:#64748B;text-decoration:none;font-size:12px">${escapeHtml(bon.advisor_email)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    recipient.first_name?.trim() ? `Bonjour ${recipient.first_name.trim()},` : 'Bonjour,',
    '',
    `Voici la copie certifiée de votre bon de visite (${bon.reference}).`,
    '',
    `Bien visité : ${bon.property_address}, ${bon.property_zipcode || ''} ${bon.property_city}`,
    `Date de la visite : ${formattedDate}`,
    bon.property_price ? `Prix de présentation : ${bon.property_price.toLocaleString('fr-FR')} €` : '',
    '',
    `Consulter et télécharger votre bon de visite signé :`,
    documentUrl,
    '',
    `Visiteurs : ${bon.visitors.map((v) => `${v.first_name} ${v.last_name} (CNI ${v.cni_number})`).join(', ')}`,
    '',
    'Je reste à votre entière disposition pour toute question ou document complémentaire.',
    '',
    `${bon.advisor_name} - ${bon.advisor_phone}`,
    `${bon.advisor_email}`,
    'iad France',
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}

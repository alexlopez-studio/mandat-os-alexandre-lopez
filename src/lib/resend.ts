import { buildMagicLinkEmail, type MagicLinkType } from './email/magic-link-template'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'Alex Lopez <estimation@alexlopez-provence.fr>'

export async function sendMagicLinkEmail(params: {
	to: string
	prenom: string | null
	token: string
	type: MagicLinkType
	siteUrl: string
}): Promise<boolean> {
	const apiKey = process.env.RESEND_API_KEY
	if (!apiKey) return false

	const { to, prenom, token, type, siteUrl } = params
	const magicLinkUrl = `${siteUrl}/resultats/${token}`

	const { subject, html, text } = buildMagicLinkEmail({ prenom, magicLinkUrl, type })

	try {
		const r = await fetch(RESEND_API, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from: FROM,
				to: [to],
				subject,
				html,
				text,
			}),
		})
		return r.ok
	} catch {
		return false
	}
}

export async function sendClientPortalInviteEmail(params: {
	to: string
	prenom: string | null
	magicLinkUrl: string
}): Promise<boolean> {
	const apiKey = process.env.RESEND_API_KEY
	if (!apiKey) return false

	const greeting = params.prenom?.trim() ? `Bonjour ${escapeHtml(params.prenom.trim())},` : 'Bonjour,'
	const safeUrl = escapeHtml(params.magicLinkUrl)
	const subject = 'Votre espace vendeur est prêt — Alex Lopez Provence'
	const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
<tr><td style="padding:32px 32px 8px"><h1 style="margin:0;font-size:22px;font-weight:700;color:#0F172A">${greeting}</h1></td></tr>
<tr><td style="padding:0 32px 24px"><p style="margin:0;font-size:15px;line-height:1.6;color:#475569">Votre espace vendeur est ouvert. Vous y retrouverez la synthèse de votre projet, les prochaines étapes et les documents utiles au dossier de vente.</p></td></tr>
<tr><td align="center" style="padding:8px 32px 32px"><a href="${safeUrl}" style="display:inline-block;background:#0077B6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;font-size:15px">Accéder à mon espace</a></td></tr>
<tr><td style="padding:0 32px 24px"><p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748B">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p><p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;word-break:break-all"><a href="${safeUrl}" style="color:#0077B6;text-decoration:underline">${safeUrl}</a></p></td></tr>
<tr><td style="padding:0 32px 8px"><hr style="border:none;border-top:1px solid #E2E8F0;margin:0"></td></tr>
<tr><td style="padding:24px 32px"><p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Une question ? Appelez-moi directement au <a href="tel:+33613180168" style="color:#0077B6;text-decoration:none;font-weight:700">06 13 18 01 68</a>.</p><p style="margin:0;font-size:13px;line-height:1.5;color:#64748B"><strong style="color:#0F172A">Alex Lopez</strong><br>Conseiller iad<br><a href="https://alexlopez-provence.fr" style="color:#0077B6;text-decoration:none">alexlopez-provence.fr</a></p></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

	const text = [
		params.prenom?.trim() ? `Bonjour ${params.prenom.trim()},` : 'Bonjour,',
		'',
		'Votre espace vendeur est ouvert.',
		'Vous y retrouverez la synthèse de votre projet, les prochaines étapes et les documents utiles au dossier de vente.',
		'',
		`Accéder à mon espace : ${params.magicLinkUrl}`,
		'',
		'Une question ? Appelez-moi directement au 06 13 18 01 68.',
	].join('\n')

	try {
		const r = await fetch(RESEND_API, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from: FROM,
				to: [params.to],
				subject,
				html,
				text,
			}),
		})
		return r.ok
	} catch {
		return false
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

export type { MagicLinkType }

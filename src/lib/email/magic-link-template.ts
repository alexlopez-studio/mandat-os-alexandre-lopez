export type MagicLinkType = 'vendre' | 'acheter' | 'audit'

export type MagicLinkEmailInput = {
	prenom: string | null
	magicLinkUrl: string
	type: MagicLinkType
}

export type MagicLinkEmailContent = {
	subject: string
	html: string
	text: string
}

type Copy = {
	subject: string
	intro: string
	cta: string
}

const COPY: Record<MagicLinkType, Copy> = {
	vendre: {
		subject: 'Votre estimation personnalisée est prête — Alex Lopez Provence',
		intro:
			'Votre estimation immobilière a bien été générée. Retrouvez ci-dessous votre première zone de valeur indicative, à conserver et à affiner avec un avis de valeur complet sur le terrain.',
		cta: 'Consulter mon estimation',
	},
	acheter: {
		subject: 'Votre recherche acheteur est enregistrée — Alex Lopez Provence',
		intro:
			"Votre recherche acheteur a bien été enregistrée. Retrouvez ci-dessous le récapitulatif de votre projet et consultez à tout moment les biens correspondants à vos critères.",
		cta: 'Voir mon espace acheteur',
	},
	audit: {
		subject: 'Votre audit immobilier est prêt — Alex Lopez Provence',
		intro:
			'Votre audit immobilier a bien été enregistré. Retrouvez ci-dessous votre rapport personnalisé, avec des recommandations concrètes pour valoriser votre bien.',
		cta: 'Voir mon audit',
	},
}

const NBSP = '\u00a0'

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

export function buildMagicLinkEmail({
	prenom,
	magicLinkUrl,
	type,
}: MagicLinkEmailInput): MagicLinkEmailContent {
	const copy = COPY[type]
	if (!copy) {
		throw new Error(`Unknown magic link type: ${type}`)
	}

	const trimmedPrenom = prenom ? prenom.trim() : ''
	const hasPrenom = trimmedPrenom.length > 0

	const greetingHtml = hasPrenom ? `Bonjour ${escapeHtml(trimmedPrenom)},` : 'Bonjour,'
	const greetingText = hasPrenom ? `Bonjour ${trimmedPrenom},` : 'Bonjour,'

	const safeUrl = escapeHtml(magicLinkUrl)
	const safeSubject = escapeHtml(copy.subject)

	const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
<tr><td style="padding:32px 32px 8px">
<h1 style="margin:0;font-size:22px;font-weight:600;color:#0F172A">${greetingHtml}</h1>
</td></tr>
<tr><td style="padding:0 32px 24px">
<p style="margin:0;font-size:15px;line-height:1.6;color:#475569">${copy.intro}</p>
</td></tr>
<tr><td align="center" style="padding:8px 32px 32px">
<a href="${safeUrl}" style="display:inline-block;background:#0077B6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:600;font-size:15px">${copy.cta}${NBSP}→</a>
</td></tr>
<tr><td style="padding:0 32px 24px">
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748B">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur${NBSP}:</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;word-break:break-all"><a href="${safeUrl}" style="color:#0077B6;text-decoration:underline">${safeUrl}</a></p>
</td></tr>
<tr><td style="padding:0 32px 8px"><hr style="border:none;border-top:1px solid #E2E8F0;margin:0"></td></tr>
<tr><td style="padding:24px 32px">
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#0F172A">Une question ou besoin d'un avis de valeur complet${NBSP}?</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Appelez-moi directement au <a href="tel:+33613180168" style="color:#0077B6;text-decoration:none;font-weight:600">06${NBSP}13${NBSP}18${NBSP}01${NBSP}68</a>.</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748B"><strong style="color:#0F172A">Alex Lopez</strong><br>Conseiller iad${NBSP}+ RSAC<br><a href="https://alexandrelopez.fr" style="color:#0077B6;text-decoration:none">alexandrelopez.fr</a></p>
</td></tr>
</table>
<p style="font-size:11px;color:#94A3B8;margin:16px 0 0;max-width:560px;line-height:1.5">Vous recevez cet email car vous avez fait une demande sur alexandrelopez.fr. Ce lien est personnel et valable 30${NBSP}jours.</p>
</td></tr>
</table>
</body>
</html>`

	const textLines = [
		greetingText,
		'',
		copy.intro,
		'',
		`${copy.cta} : ${magicLinkUrl}`,
		'',
		"Une question ou besoin d'un avis de valeur complet ?",
		'Appelez-moi directement au 06 13 18 01 68.',
		'',
		'Alex Lopez',
		'Conseiller iad + RSAC',
		'https://alexandrelopez.fr',
		'',
		'---',
		'Vous recevez cet email car vous avez fait une demande sur alexandrelopez.fr.',
		'Ce lien est personnel et valable 30 jours.',
	]

	return {
		subject: copy.subject,
		html,
		text: textLines.join('\n'),
	}
}

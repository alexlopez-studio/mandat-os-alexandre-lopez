import { describe, it, expect } from 'vitest'
import { buildMagicLinkEmail } from '../magic-link-template'

const MAGIC_URL = 'https://alexlopez-provence.fr/resultats/abc.def.ghi'

describe('buildMagicLinkEmail', () => {
	it('returns vendre subject, html and text containing greeting + url + cta', () => {
		const out = buildMagicLinkEmail({ prenom: 'Marie', magicLinkUrl: MAGIC_URL, type: 'vendre' })

		expect(out.subject).toBe('Votre estimation est prête — Alex Lopez Provence')
		expect(out.html).toContain('Bonjour Marie,')
		expect(out.html).toContain(MAGIC_URL)
		expect(out.html).toContain('Voir mon estimation')
		expect(out.text).toContain('Bonjour Marie,')
		expect(out.text).toContain(MAGIC_URL)
		expect(out.text).toContain('Voir mon estimation')
	})

	it('uses acheter copy when type is acheter', () => {
		const out = buildMagicLinkEmail({ prenom: 'Paul', magicLinkUrl: MAGIC_URL, type: 'acheter' })

		expect(out.subject).toContain('recherche acheteur')
		expect(out.html).toContain('Voir mon espace acheteur')
		expect(out.text).toContain('Voir mon espace acheteur')
	})

	it('uses audit copy when type is audit', () => {
		const out = buildMagicLinkEmail({ prenom: 'Sophie', magicLinkUrl: MAGIC_URL, type: 'audit' })

		expect(out.subject).toContain('audit immobilier')
		expect(out.html).toContain('Voir mon audit')
		expect(out.text).toContain('Voir mon audit')
	})

	it('falls back to a neutral greeting when prenom is null', () => {
		const out = buildMagicLinkEmail({ prenom: null, magicLinkUrl: MAGIC_URL, type: 'vendre' })

		expect(out.html).toContain('>Bonjour,<')
		expect(out.html).not.toContain('Bonjour ,')
		expect(out.text.startsWith('Bonjour,')).toBe(true)
	})

	it('falls back to a neutral greeting when prenom is whitespace only', () => {
		const out = buildMagicLinkEmail({ prenom: '   ', magicLinkUrl: MAGIC_URL, type: 'vendre' })

		expect(out.html).toContain('>Bonjour,<')
		expect(out.text.startsWith('Bonjour,')).toBe(true)
	})

	it('trims whitespace around prenom', () => {
		const out = buildMagicLinkEmail({ prenom: '  Léa  ', magicLinkUrl: MAGIC_URL, type: 'vendre' })

		expect(out.html).toContain('Bonjour Léa,')
		expect(out.text).toContain('Bonjour Léa,')
	})

	it('escapes HTML special chars in prenom to prevent XSS', () => {
		const out = buildMagicLinkEmail({
			prenom: '<script>alert(1)</script>',
			magicLinkUrl: MAGIC_URL,
			type: 'vendre',
		})

		expect(out.html).not.toContain('<script>alert(1)</script>')
		expect(out.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
	})

	it('escapes HTML special chars in the magic link URL', () => {
		const dangerous = 'https://example.com/x?a=1&b="2"'
		const out = buildMagicLinkEmail({ prenom: null, magicLinkUrl: dangerous, type: 'vendre' })

		expect(out.html).toContain('&amp;')
		expect(out.html).toContain('&quot;')
		expect(out.html).not.toContain('a=1&b="2"')
		// plain text keeps raw url for usability
		expect(out.text).toContain(dangerous)
	})

	it('throws when type is unknown', () => {
		expect(() =>
			buildMagicLinkEmail({
				prenom: null,
				magicLinkUrl: MAGIC_URL,
				// @ts-expect-error invalid type on purpose
				type: 'foo',
			}),
		).toThrow(/Unknown magic link type/)
	})
})

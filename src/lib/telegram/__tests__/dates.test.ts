import { describe, expect, it } from 'vitest'
import { formatFrenchDate, parseFrenchDate } from '@/lib/telegram/dates'

/** Vendredi 7 août 2026 — le jour où le bug a été constaté. */
const VENDREDI = new Date('2026-08-07T17:42:00Z')

function iso(input: string, today = VENDREDI) {
  const parsed = parseFrenchDate(input, today)
  return parsed.ok ? parsed.iso : `ÉCHEC: ${parsed.error}`
}

describe('parseFrenchDate', () => {
  it('accepte les formats qu’Alexandre a réellement tapés ce jour-là', () => {
    expect(iso('2026-08-10')).toBe('2026-08-10')
    expect(iso('10/08/2026')).toBe('2026-08-10')
    expect(iso('10 août 2026')).toBe('2026-08-10')
    expect(iso('lundi 10 août 2026')).toBe('2026-08-10')
  })

  it('résout « lundi prochain », l’expression qui bloquait tout', () => {
    expect(iso('lundi prochain')).toBe('2026-08-10')
    expect(iso('lundi')).toBe('2026-08-10')
    expect(iso('ce lundi')).toBe('2026-08-10')
  })

  it('choisit la prochaine occurrence, jamais le jour même', () => {
    const lundi = new Date('2026-08-10T08:00:00Z')
    expect(iso('lundi', lundi)).toBe('2026-08-17')
  })

  it('gère les dates relatives courantes', () => {
    expect(iso('demain')).toBe('2026-08-08')
    expect(iso('après-demain')).toBe('2026-08-09')
    expect(iso("aujourd'hui")).toBe('2026-08-07')
    expect(iso('dans 15 jours')).toBe('2026-08-22')
    expect(iso('dans 2 semaines')).toBe('2026-08-21')
    expect(iso('dans 1 mois')).toBe('2026-09-07')
  })

  it('complète l’année manquante vers l’avenir', () => {
    expect(iso('10/08')).toBe('2026-08-10')
    // Le 5 janvier est déjà passé en août : c'est celui de l'an prochain.
    expect(iso('05/01')).toBe('2027-01-05')
    expect(iso('1er septembre')).toBe('2026-09-01')
  })

  it('accepte l’année sur deux chiffres', () => {
    expect(iso('10/08/26')).toBe('2026-08-10')
  })

  it('refuse une date inexistante au lieu de la décaler en silence', () => {
    const parsed = parseFrenchDate('31/02/2026', VENDREDI)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) throw new Error('refus attendu')
    expect(parsed.error).toContain("n'existe pas")
  })

  it('refuse ce qu’il ne comprend pas, avec un message exploitable', () => {
    for (const entree of ['', '   ', 'un de ces jours', 'quand il pourra', null, 42]) {
      const parsed = parseFrenchDate(entree as unknown, VENDREDI)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.error).toContain('AAAA-MM-JJ')
    }
  })

  it('ne laisse jamais passer une chaîne qui casserait Postgres', () => {
    // Reproduction du bug : cette valeur partait concaténée en base.
    const parsed = parseFrenchDate('lundi prochainT09:00:00Z', VENDREDI)
    expect(parsed.ok).toBe(false)
  })
})

describe('formatFrenchDate', () => {
  it('rend une date lisible pour la confirmation', () => {
    expect(formatFrenchDate('2026-08-10')).toBe('lundi 10 août 2026')
  })
})

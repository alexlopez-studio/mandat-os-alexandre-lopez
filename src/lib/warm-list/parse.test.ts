import { describe, it, expect } from 'vitest'
import { parseVCard, parseCsv, parseImport } from './parse'

describe('parseVCard', () => {
  it('parse un vCard simple', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Jean Dupont',
      'N:Dupont;Jean;;;',
      'TEL;TYPE=CELL:+33 6 12 34 56 78',
      'EMAIL:jean.dupont@email.fr',
      'ORG:Boulangerie Dupont',
      'NOTE:Voisin sympa',
      'END:VCARD',
    ].join('\n')
    const [c] = parseVCard(vcf)
    expect(c.full_name).toBe('Jean Dupont')
    expect(c.phone).toBe('+33612345678')
    expect(c.email).toBe('jean.dupont@email.fr')
    expect(c.relation).toBe('Boulangerie Dupont')
    expect(c.notes).toBe('Voisin sympa')
  })

  it('parse plusieurs vCards et reconstruit le nom depuis N', () => {
    const vcf = [
      'BEGIN:VCARD', 'N:Martin;Marie;;;', 'TEL:0601020304', 'END:VCARD',
      'BEGIN:VCARD', 'FN:Paul Bernard', 'END:VCARD',
    ].join('\n')
    const contacts = parseVCard(vcf)
    expect(contacts).toHaveLength(2)
    expect(contacts[0].full_name).toBe('Marie Martin')
    expect(contacts[1].full_name).toBe('Paul Bernard')
  })
})

describe('parseCsv', () => {
  it('parse un CSV avec en-têtes FR', () => {
    const csv = 'Nom complet,Téléphone,Email,Relation\nMarie Leclerc,06 11 22 33 44,marie@x.fr,Amie'
    const [c] = parseCsv(csv)
    expect(c.full_name).toBe('Marie Leclerc')
    expect(c.phone).toBe('0611223344')
    expect(c.email).toBe('marie@x.fr')
    expect(c.relation).toBe('Amie')
  })

  it('reconstruit le nom depuis First/Last name (export Google) et gère les guillemets', () => {
    const csv = 'First Name,Last Name,Phone 1 - Value\n"Jean","Dupont, Jr","+33 6 00 00 00 00"'
    const [c] = parseCsv(csv)
    expect(c.full_name).toBe('Jean Dupont, Jr')
    expect(c.phone).toBe('+33600000000')
  })

  it('détecte le séparateur point-virgule', () => {
    const csv = 'name;email\nLuc;luc@x.fr'
    const [c] = parseCsv(csv)
    expect(c.full_name).toBe('Luc')
    expect(c.email).toBe('luc@x.fr')
  })
})

describe('parseImport', () => {
  it('route vers vCard selon le contenu', () => {
    const vcf = 'BEGIN:VCARD\nFN:Test\nEND:VCARD'
    expect(parseImport('contacts.txt', vcf)).toHaveLength(1)
  })
  it('route vers CSV selon l’extension', () => {
    const csv = 'name\nAlice'
    expect(parseImport('contacts.csv', csv)[0].full_name).toBe('Alice')
  })
})

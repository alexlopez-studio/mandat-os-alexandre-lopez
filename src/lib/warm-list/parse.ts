/**
 * Parseurs d'import pour la Liste Chaude.
 *
 * Supporte :
 *   - vCard (.vcf) — un ou plusieurs contacts (BEGIN:VCARD … END:VCARD)
 *   - CSV          — détection d'en-têtes courants (FR/EN, Google, Outlook, iCloud)
 *
 * Aucune dépendance externe : parseurs maison volontairement minimalistes
 * mais robustes aux cas courants (guillemets CSV, valeurs repliées vCard,
 * encodage des virgules/points-virgules dans le champ N).
 */

export type ParsedContact = {
  full_name: string
  phone?: string
  email?: string
  relation?: string
  notes?: string
}

// ─────────────────────────────────────────────────────────────
// vCard
// ─────────────────────────────────────────────────────────────

/** Déplie les lignes repliées (RFC 6350 : continuation = ligne commençant par espace/tab). */
function unfoldVCardLines(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** Sépare le nom de propriété (avec ses paramètres) de la valeur. */
function splitVCardLine(line: string): { name: string; params: string[]; value: string } {
  const colon = line.indexOf(':')
  if (colon === -1) return { name: line.toUpperCase(), params: [], value: '' }
  const left = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const [name, ...params] = left.split(';')
  return { name: name.toUpperCase(), params: params.map((p) => p.toUpperCase()), value }
}

/** Décode les valeurs encodées en quoted-printable (rare mais présent sur de vieux exports). */
function decodeValue(value: string, params: string[]): string {
  let v = value
  if (params.some((p) => p.includes('QUOTED-PRINTABLE'))) {
    v = v
      .replace(/=\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  }
  return v.trim()
}

export function parseVCard(raw: string): ParsedContact[] {
  const contacts: ParsedContact[] = []
  const lines = unfoldVCardLines(raw)

  let current: ParsedContact | null = null
  let nFallback = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const upper = trimmed.toUpperCase()

    if (upper === 'BEGIN:VCARD') {
      current = { full_name: '' }
      nFallback = ''
      continue
    }
    if (upper === 'END:VCARD') {
      if (current) {
        if (!current.full_name && nFallback) current.full_name = nFallback
        if (current.full_name || current.phone || current.email) {
          contacts.push(current)
        }
      }
      current = null
      continue
    }
    if (!current) continue

    const { name, params, value } = splitVCardLine(trimmed)
    const decoded = decodeValue(value, params)

    if (name === 'FN') {
      current.full_name = decoded
    } else if (name === 'N' && !nFallback) {
      // N = Famille;Prénom;Complément;Préfixe;Suffixe
      const parts = decoded.split(';').map((p) => p.trim())
      const [family, given] = parts
      nFallback = [given, family].filter(Boolean).join(' ').trim()
    } else if (name === 'TEL' && !current.phone) {
      current.phone = normalizePhone(decoded)
    } else if (name === 'EMAIL' && !current.email) {
      current.email = decoded.toLowerCase()
    } else if (name === 'ORG' && !current.relation) {
      current.relation = decoded.replace(/;+$/, '').replace(/;/g, ' · ').trim() || undefined
    } else if (name === 'NOTE' && !current.notes) {
      current.notes = decoded || undefined
    }
  }

  return contacts
}

// ─────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────

/** Parse une ligne CSV en respectant les guillemets et le séparateur donné. */
function parseCsvRow(row: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (inQuotes) {
      if (ch === '"') {
        if (row[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/** Détecte le séparateur le plus probable (virgule, point-virgule, tabulation). */
function detectSeparator(headerLine: string): string {
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = -1
  for (const sep of candidates) {
    const count = parseCsvRow(headerLine, sep).length
    if (count > bestCount) {
      bestCount = count
      best = sep
    }
  }
  return best
}

const HEADER_ALIASES: Record<keyof ParsedContact, string[]> = {
  // NB : 'first name'/'prénom'/'nom' sont volontairement absents ici — ils sont
  // gérés par la reconstruction prénom + nom plus bas (colonnes séparées).
  full_name: [
    'full name', 'name', 'nom complet', 'nom et prénom', 'display name', 'contact',
  ],
  phone: [
    'phone', 'phone 1 - value', 'mobile', 'téléphone', 'telephone', 'tel',
    'phone number', 'numéro', 'numero', 'portable', 'mobile phone',
  ],
  email: [
    'email', 'e-mail', 'email 1 - value', 'e-mail address', 'mail', 'courriel',
    'email address',
  ],
  relation: ['relation', 'lien', 'organization', 'organisation', 'société', 'societe', 'company', 'org', 'groupe', 'group'],
  notes: ['notes', 'note', 'remarque', 'remarques', 'commentaire', 'comment'],
}

function matchHeader(header: string): keyof ParsedContact | null {
  const h = header.toLowerCase().trim()
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof ParsedContact, string[]][]) {
    if (aliases.includes(h)) return field
  }
  return null
}

export function parseCsv(raw: string): ParsedContact[] {
  const text = raw.replace(/^﻿/, '') // strip BOM
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const sep = detectSeparator(lines[0])
  const headers = parseCsvRow(lines[0], sep)

  // Map colonne → champ
  const colMap = headers.map((h) => matchHeader(h))

  // Repère les colonnes "First name" / "Last name" séparées (Google/Outlook)
  const firstNameIdx = headers.findIndex((h) =>
    ['first name', 'prénom', 'prenom', 'given name'].includes(h.toLowerCase().trim()),
  )
  const lastNameIdx = headers.findIndex((h) =>
    ['last name', 'nom', 'family name', 'surname', 'nom de famille'].includes(h.toLowerCase().trim()),
  )

  const contacts: ParsedContact[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i], sep)
    const c: ParsedContact = { full_name: '' }

    colMap.forEach((field, idx) => {
      const val = (cells[idx] ?? '').trim()
      if (!val || !field) return
      if (field === 'phone') c.phone = c.phone || normalizePhone(val)
      else if (field === 'email') c.email = c.email || val.toLowerCase()
      else if (field === 'full_name') c.full_name = c.full_name || val
      else c[field] = c[field] || val
    })

    // Reconstruit le nom depuis prénom + nom si pas de colonne "full name"
    if (!c.full_name && (firstNameIdx >= 0 || lastNameIdx >= 0)) {
      const first = firstNameIdx >= 0 ? (cells[firstNameIdx] ?? '').trim() : ''
      const last = lastNameIdx >= 0 ? (cells[lastNameIdx] ?? '').trim() : ''
      c.full_name = [first, last].filter(Boolean).join(' ').trim()
    }

    if (c.full_name || c.phone || c.email) {
      if (!c.full_name) c.full_name = c.email || c.phone || 'Sans nom'
      contacts.push(c)
    }
  }

  return contacts
}

// ─────────────────────────────────────────────────────────────
// Aide commune
// ─────────────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned
}

/**
 * Parse un fichier importé selon son nom/type.
 * Renvoie la liste des contacts détectés (non dédupliqués).
 */
export function parseImport(filename: string, content: string): ParsedContact[] {
  const lower = filename.toLowerCase()
  const looksVcard = lower.endsWith('.vcf') || /BEGIN:VCARD/i.test(content)
  if (looksVcard) return parseVCard(content)
  return parseCsv(content)
}

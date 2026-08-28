/**
 * Helpers et types pour le profil enrichi, coordonnées et automatisations relationnelles d'un contact.
 */

export interface ContactProfileMeta {
  civilite?: 'M.' | 'Mme' | '' | null
  salutation?: string | null
  address?: string | null
  birth_date?: string | null
  wishes_enabled?: boolean
  transaction_date?: string | null
  review_request?: string | null
  recommendation_request?: string | null
  is_future_seller?: boolean
  do_not_contact?: boolean
  relation_note?: string | null
}

export function parseContactMeta(relationStr: string | null | undefined): ContactProfileMeta {
  if (!relationStr) {
    return { wishes_enabled: true }
  }

  try {
    if (relationStr.startsWith('{') && relationStr.endsWith('}')) {
      const parsed = JSON.parse(relationStr)
      return {
        wishes_enabled: true,
        ...parsed,
      }
    }
  } catch {}

  return {
    relation_note: relationStr,
    wishes_enabled: true,
  }
}

export function serializeContactMeta(meta: ContactProfileMeta): string {
  return JSON.stringify(meta)
}

export function generateSalutation(firstName?: string | null, civilite?: string | null): string {
  const name = firstName?.trim() || ''
  if (!name) return '« Bonjour, »'
  if (civilite && civilite.trim()) {
    return `« Bonjour ${civilite.trim()} ${name}, »`
  }
  return `« Bonjour ${name}, »`
}

export function formatFrenchDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

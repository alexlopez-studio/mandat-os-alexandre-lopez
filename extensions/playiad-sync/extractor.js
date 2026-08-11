// Mandat OS — lecture des leads acquéreurs dans le DOM Playiad.
//
// Ce fichier ne fait que définir une fonction : aucun effet de bord, pour qu'il
// puisse être injecté deux fois sans risque (content script déclaratif ET
// injection à la demande par le service worker).
globalThis.mandatOsExtractLeads = function mandatOsExtractLeads() {
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const PHONE_RE = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/
  const NAME_RE = /^[A-ZÀ-Ý][\p{L}'’-]+(?:\s+[\p{L}'’-]+){1,2}$/u

  const ROW_SELECTOR = [
    'tbody tr',
    'tr',
    '[data-lead-id]',
    '[data-id]',
    'li',
    '.card',
    '[class*="lead"]',
    '[class*="buyer"]',
    '[class*="prospect"]',
    '[class*="contact"]',
  ].join(', ')

  function normalizePhone(raw) {
    if (!raw) return null
    let digits = raw.replace(/[^\d+]/g, '')
    if (digits.startsWith('+33')) digits = '0' + digits.slice(3)
    else if (digits.startsWith('0033')) digits = '0' + digits.slice(4)
    digits = digits.replace(/\D/g, '')
    return digits.length === 10 ? digits : null
  }

  function titleCase(value) {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  function pickName(cells) {
    // Le vrai nom, tel qu'affiche dans sa propre cellule.
    const strict = cells.find((c) => NAME_RE.test(c))
    if (strict) return strict
    // Repli sur la partie locale de l'e-mail (prenom.nom@…), remise en casse.
    const email = cells.map((c) => c.match(EMAIL_RE)).find(Boolean)
    if (email) {
      const local = email[0].split('@')[0].replace(/[._-]+/g, ' ').trim()
      if (local && !/^\d+$/.test(local)) return titleCase(local)
    }
    return ''
  }

  function readLead(el) {
    const text = el.innerText || ''
    if (!text.trim() || text.length > 2000) return null

    const emailMatch = text.match(EMAIL_RE)
    const phoneMatch = text.match(PHONE_RE)
    if (!emailMatch && !phoneMatch) return null

    // `innerText` d'une ligne de tableau separe les cellules par une TABULATION,
    // pas par un retour a la ligne : decouper sur les seuls `\n` collerait le
    // nom a la cellule suivante et aucun nom ne serait jamais reconnu.
    const cells = text
      .split(/[\n\t]+/)
      .map((c) => c.trim())
      .filter(Boolean)

    const nameParts = pickName(cells).split(/\s+/).filter(Boolean)

    let budgetMax = null
    const budgetMatch = text.match(/(\d[\d\s. ]{2,})\s*(?:€|euros?)/i)
    if (budgetMatch) {
      const val = Number(budgetMatch[1].replace(/[\s. ]/g, ''))
      if (Number.isFinite(val) && val > 10000) budgetMax = val
    }

    const refMatch = text.match(/(?:ref|réf|annonce)\s*[:#]?\s*([a-zA-Z0-9-]{3,})/i)
    const typeMatch = text.match(/\b(appartement|maison|villa|terrain|immeuble|local|studio)\b/i)

    return {
      // Identifiant réel de Playiad uniquement : un identifiant dérivé de la
      // position dans la liste changerait à chaque nouveau lead.
      playiad_id: el.getAttribute('data-lead-id') || el.getAttribute('data-id') || null,
      first_name: nameParts[0] || null,
      last_name: nameParts.slice(1).join(' ') || null,
      email: emailMatch ? emailMatch[0].toLowerCase() : null,
      phone: phoneMatch ? normalizePhone(phoneMatch[0]) : null,
      source: 'Playiad (iad France)',
      property_ref: refMatch ? refMatch[1] : null,
      property_type: typeMatch ? typeMatch[1].toLowerCase() : null,
      budget_max: budgetMax,
      message: text.replace(/\s+/g, ' ').trim().slice(0, 400),
      _textLength: text.length,
    }
  }

  const byKey = new Map()

  document.querySelectorAll(ROW_SELECTOR).forEach((el) => {
    const lead = readLead(el)
    if (!lead) return
    const key = lead.email || lead.phone
    if (!key) return
    // Les sélecteurs se recoupent : un même acquéreur ressort via la ligne de
    // tableau et via son conteneur. On garde la correspondance la plus courte,
    // c'est-à-dire l'élément le plus proche de la donnée.
    const previous = byKey.get(key)
    if (!previous || lead._textLength < previous._textLength) byKey.set(key, lead)
  })

  return {
    url: location.href,
    title: document.title,
    // Diagnostic : permet de distinguer « page de connexion » de « page vide ».
    rowsScanned: document.querySelectorAll(ROW_SELECTOR).length,
    leads: [...byKey.values()].map(({ _textLength, ...lead }) => lead),
  }
}

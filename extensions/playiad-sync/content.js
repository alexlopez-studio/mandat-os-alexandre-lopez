// Mandat OS — Content Script Playiad Sync (playiad.com/buyers/leads)
(function () {
  console.log('[Mandat OS Extension] Content script actif sur Playiad (https://www.playiad.com/buyers/leads).')

  function extractLeadsFromDOM() {
    const leads = []

    // 1. Recherche élargie de sélecteurs pour les cartes / lignes de leads acquéreurs
    const elements = document.querySelectorAll('tr, .lead-card, .buyer-card, .prospect-card, .card, [class*="lead"], [class*="buyer"], [class*="prospect"], [data-id], .table tbody tr')

    elements.forEach((el, index) => {
      const text = el.innerText || ''
      if (!text.trim() || text.length > 2000) return

      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      const phoneMatch = text.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/)
      const playiadIdAttr = el.getAttribute('data-id') || el.getAttribute('data-lead-id') || `playiad-lead-${index}`

      if (emailMatch || phoneMatch) {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        const nameCandidate = lines.find((l) => !l.includes('@') && !l.match(/\d{9,}/) && l.length < 40) || ''
        const nameParts = nameCandidate.split(/\s+/)

        const firstName = nameParts[0] || 'Acquéreur'
        const lastName = nameParts.slice(1).join(' ') || 'Playiad'

        // Détection budget (€)
        let budgetMax = null
        const budgetMatch = text.match(/(\d[\d\s._]{3,})\s*(?:€|euros)/i)
        if (budgetMatch) {
          const val = Number(budgetMatch[1].replace(/[\s._]/g, ''))
          if (!Number.isNaN(val) && val > 10000) budgetMax = val
        }

        // Détection titre du bien / référence
        const refMatch = text.match(/(?:ref|réf|annonce)\s*[:#]?\s*([a-zA-Z0-9-]+)/i)
        const propertyRef = refMatch ? refMatch[1] : null

        leads.push({
          playiad_id: playiadIdAttr,
          first_name: firstName,
          last_name: lastName,
          email: emailMatch ? emailMatch[0] : null,
          phone: phoneMatch ? phoneMatch[0].replace(/[\s.-]/g, '') : null,
          source: 'Playiad (iad France)',
          property_ref: propertyRef,
          budget_max: budgetMax,
          message: text.substring(0, 400),
        })
      }
    })

    // Éliminer les doublons par email ou phone au sein de la page
    const uniqueLeads = []
    const seen = new Set()
    for (const lead of leads) {
      const key = lead.email || lead.phone || lead.playiad_id
      if (!seen.has(key)) {
        seen.add(key)
        uniqueLeads.push(lead)
      }
    }

    return uniqueLeads
  }

  function injectSyncButton() {
    if (document.getElementById('mandat-os-sync-btn')) return

    const btn = document.createElement('button')
    btn.id = 'mandat-os-sync-btn'
    btn.innerHTML = '⚡ Synchroniser avec Mandat OS'
    btn.style.position = 'fixed'
    btn.style.bottom = '24px'
    btn.style.right = '24px'
    btn.style.zIndex = '999999'
    btn.style.backgroundColor = '#00A0E2'
    btn.style.color = '#ffffff'
    btn.style.border = 'none'
    btn.style.borderRadius = '30px'
    btn.style.padding = '14px 24px'
    btn.style.fontSize = '14px'
    btn.style.fontWeight = 'bold'
    btn.style.boxShadow = '0 6px 20px rgba(0, 160, 226, 0.45)'
    btn.style.cursor = 'pointer'
    btn.style.transition = 'all 0.2s ease'

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)'
    })

    btn.addEventListener('click', async () => {
      btn.innerHTML = '⏳ Synchronisation en cours…'
      btn.disabled = true

      const leads = extractLeadsFromDOM()

      if (leads.length === 0) {
        alert('Aucun lead acquéreur détecté sur cette page. Assurez-vous d’être sur la liste des acquéreurs Playiad (https://www.playiad.com/buyers/leads).')
        btn.innerHTML = '⚡ Synchroniser avec Mandat OS'
        btn.disabled = false
        return
      }

      chrome.storage.sync.get(['mandatOsUrl'], async (data) => {
        const baseUrl = data.mandatOsUrl || 'https://preview.alexlopez-provence.fr'
        const endpoint = `${baseUrl.replace(/\/$/, '')}/api/integrations/playiad/sync`

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads }),
          })

          const json = await res.json()

          if (res.ok && json.success) {
            alert(`✅ ${json.createdCount} nouveau(x) projet(s) acquéreur(s) créé(s) dans Mandat OS ! (${json.skippedCount || 0} déjà présent(s)).`)
          } else {
            alert(`❌ Erreur lors de la synchronisation : ${json.error || 'Erreur inconnue'}`)
          }
        } catch (err) {
          alert(`❌ Erreur réseau ou serveur inaccessible : ${err.message}`)
        } finally {
          btn.innerHTML = '⚡ Synchroniser avec Mandat OS'
          btn.disabled = false
        }
      })
    })

    document.body.appendChild(btn)
  }

  // Tenter l'injection au chargement et après le chargement des données AJAX
  setTimeout(injectSyncButton, 1000)
  setTimeout(injectSyncButton, 3000)
  setInterval(injectSyncButton, 5000)
})()

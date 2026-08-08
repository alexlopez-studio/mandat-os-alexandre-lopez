// Mandat OS — Content Script Playiad Sync
(function () {
  console.log('[Mandat OS Extension] Content script chargé sur Playiad.')

  function extractLeadsFromDOM() {
    const leads = []

    // 1. Détection des lignes de tableau ou cartes de contacts acquéreurs
    const rows = document.querySelectorAll('tr, .lead-item, .card-prospect, .list-group-item, [data-lead-id]')

    rows.forEach((row, index) => {
      const text = row.innerText || ''
      if (!text.trim()) return

      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      const phoneMatch = text.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/)
      const playiadIdAttr = row.getAttribute('data-lead-id') || row.getAttribute('data-id') || `playiad-row-${index}`

      if (emailMatch || phoneMatch) {
        // Extraction approximative du nom (premiers mots)
        const nameLines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        const nameCandidate = nameLines.find((l) => !l.includes('@') && !l.match(/\d{9,}/) && l.length < 40) || ''
        const nameParts = nameCandidate.split(/\s+/)

        const firstName = nameParts[0] || 'Acquéreur'
        const lastName = nameParts.slice(1).join(' ') || 'Playiad'

        leads.push({
          playiad_id: playiadIdAttr,
          first_name: firstName,
          last_name: lastName,
          email: emailMatch ? emailMatch[0] : null,
          phone: phoneMatch ? phoneMatch[0].replace(/[\s.-]/g, '') : null,
          source: 'Playiad (iad France)',
          message: text.substring(0, 300),
        })
      }
    })

    return leads
  }

  function injectSyncButton() {
    if (document.getElementById('mandat-os-sync-btn')) return

    const btn = document.createElement('button')
    btn.id = 'mandat-os-sync-btn'
    btn.innerHTML = '⚡ Synchroniser avec Mandat OS'
    btn.style.position = 'fixed'
    btn.style.bottom = '20px'
    btn.style.right = '20px'
    btn.style.zIndex = '999999'
    btn.style.backgroundColor = '#00A0E2'
    btn.style.color = '#ffffff'
    btn.style.border = 'none'
    btn.style.borderRadius = '30px'
    btn.style.padding = '12px 20px'
    btn.style.fontSize = '14px'
    btn.style.fontWeight = 'bold'
    btn.style.boxShadow = '0 4px 12px rgba(0, 160, 226, 0.4)'
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
        alert('Aucun lead acquéreur détecté sur cette page. Assurez-vous d’être sur la liste des acquéreurs Playiad.')
        btn.innerHTML = '⚡ Synchroniser avec Mandat OS'
        btn.disabled = false
        return
      }

      // Lire l'URL du serveur Mandat OS depuis le stockage ou utiliser la valeur par défaut
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

  // Injecter le bouton au chargement
  setTimeout(injectSyncButton, 1500)
})()

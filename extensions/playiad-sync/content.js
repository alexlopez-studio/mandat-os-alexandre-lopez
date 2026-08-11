// Mandat OS — bouton de synchronisation injecté dans les pages Playiad.
//
// La lecture du DOM vit dans `extractor.js` (chargé juste avant celui-ci) : ce
// script ne fait que l'interface. Il ne parle jamais directement à l'API,
// l'envoi est délégué au service worker, seul détenteur de la clé.
(function () {
  const BUTTON_ID = 'mandat-os-sync-btn'

  function setButtonState(btn, label, disabled) {
    btn.textContent = label
    btn.disabled = disabled
    btn.style.opacity = disabled ? '0.7' : '1'
  }

  function injectSyncButton() {
    if (document.getElementById(BUTTON_ID)) return

    const btn = document.createElement('button')
    btn.id = BUTTON_ID
    btn.textContent = '⚡ Synchroniser avec Mandat OS'
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '999999',
      backgroundColor: '#00A0E2',
      color: '#ffffff',
      border: 'none',
      borderRadius: '30px',
      padding: '14px 24px',
      fontSize: '14px',
      fontWeight: 'bold',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 6px 20px rgba(0, 160, 226, 0.45)',
      cursor: 'pointer',
    })

    btn.addEventListener('click', async () => {
      const { leads } = globalThis.mandatOsExtractLeads()

      if (leads.length === 0) {
        window.alert(
          'Aucun lead acquéreur détecté sur cette page.\n\n' +
            'Vérifiez que vous êtes bien sur la liste des acquéreurs et que les lignes sont chargées.',
        )
        return
      }

      setButtonState(btn, `⏳ Envoi de ${leads.length} lead(s)…`, true)

      try {
        const result = await chrome.runtime.sendMessage({ action: 'sync_leads', leads })
        if (result && result.ok) {
          window.alert(
            `✅ ${result.createdCount} nouveau(x) projet(s) acquéreur(s) créé(s).\n` +
              `${result.skippedCount} déjà connu(s), ${result.errorCount} en erreur.`,
          )
        } else {
          window.alert(`❌ ${(result && result.error) || 'Synchronisation impossible'}`)
        }
      } catch (err) {
        window.alert(`❌ Erreur : ${err.message}`)
      } finally {
        setButtonState(btn, '⚡ Synchroniser avec Mandat OS', false)
      }
    })

    document.body.appendChild(btn)
  }

  // Les listes Playiad se remplissent en AJAX : réagir aux mutations plutôt que
  // de sonder la page indéfiniment.
  injectSyncButton()
  new MutationObserver(() => injectSyncButton()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
})()

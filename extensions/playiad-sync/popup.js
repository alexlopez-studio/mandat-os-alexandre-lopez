const DEFAULTS = {
  mandatOsUrl: 'https://app.alexandrelopez.fr',
  syncKey: '',
  leadsUrl: 'https://www.playiad.com/buyers/leads',
  autoSyncEnabled: true,
  intervalMinutes: 360,
}

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('mandatUrl')
  const keyInput = document.getElementById('syncKey')
  const leadsInput = document.getElementById('leadsUrl')
  const intervalSelect = document.getElementById('interval')
  const autoSyncCheckbox = document.getElementById('autoSync')
  const saveBtn = document.getElementById('saveBtn')
  const dryRunBtn = document.getElementById('dryRunBtn')
  const statusDiv = document.getElementById('status')

  function setStatus(message, kind = '') {
    statusDiv.textContent = message
    statusDiv.className = `status ${kind}`.trim()
  }

  chrome.storage.sync.get(DEFAULTS, (data) => {
    urlInput.value = data.mandatOsUrl
    keyInput.value = data.syncKey
    leadsInput.value = data.leadsUrl
    intervalSelect.value = String(data.intervalMinutes)
    autoSyncCheckbox.checked = data.autoSyncEnabled !== false
  })

  saveBtn.addEventListener('click', () => {
    const config = {
      mandatOsUrl: urlInput.value.trim() || DEFAULTS.mandatOsUrl,
      syncKey: keyInput.value.trim(),
      leadsUrl: leadsInput.value.trim() || DEFAULTS.leadsUrl,
      intervalMinutes: Number(intervalSelect.value) || DEFAULTS.intervalMinutes,
      autoSyncEnabled: autoSyncCheckbox.checked,
    }

    chrome.storage.sync.set(config, () => {
      chrome.runtime.sendMessage({ action: 'reschedule' }, () => {
        setStatus(
          config.syncKey
            ? 'Configuration enregistrée.'
            : 'Enregistré, mais la clé de synchronisation est vide : les imports seront refusés.',
          config.syncKey ? 'ok' : 'error',
        )
      })
    })
  })

  /**
   * Ouvre Playiad, lit la page et demande au serveur ce qu'il ferait, sans rien
   * ecrire. C'est le moyen de verifier que l'extraction lit les bonnes lignes
   * avant de laisser tourner l'import automatique.
   */
  dryRunBtn.addEventListener('click', () => {
    dryRunBtn.disabled = true
    setStatus('Ouverture de Playiad et lecture de la page…')

    chrome.runtime.sendMessage({ action: 'run_scan_now', dryRun: true }, (result) => {
      dryRunBtn.disabled = false

      // Sans cette lecture, toute erreur du service worker (worker endormi,
      // exception au demarrage, permission manquante) se presenterait comme
      // une absence de reponse, sans indice sur la cause reelle.
      if (chrome.runtime.lastError) {
        setStatus(
          `Le service de l’extension n’a pas répondu :\n${chrome.runtime.lastError.message}\n\n` +
            'Rechargez l’extension depuis chrome://extensions, puis réessayez.',
          'error',
        )
        return
      }

      if (!result || !result.ok) {
        setStatus(`Échec : ${(result && result.error) || 'aucune réponse du service'}`, 'error')
        return
      }

      const lines = [
        `${result.leadCount} lead(s) lu(s) sur ${result.rowsScanned} ligne(s) parcourue(s).`,
        `${result.createdCount} seraient importé(s), ${result.skippedCount} déjà connu(s), ${result.errorCount} inexploitable(s).`,
        '',
        ...result.results.slice(0, 10).map((r) => `• ${r.name} — ${r.status}${r.reason ? ` (${r.reason})` : ''}`),
      ]
      if (result.results.length > 10) lines.push(`… et ${result.results.length - 10} autre(s)`)

      setStatus(lines.join('\n'), 'ok')
    })
  })
})

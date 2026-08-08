// Mandat OS — Background Service Worker for Playiad Auto-Sync
const ALARM_NAME = 'playiad_auto_sync'

// Configurer l'alarme de synchronisation automatique lors de l'installation / démarrage
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Mandat OS Background] Extension installée. Configuration de l’auto-sync (15 min).')
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 })
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 })
})

// Déclenchement de la synchronisation automatique par l'alarme Chrome
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return

  chrome.storage.sync.get(['autoSyncEnabled', 'mandatOsUrl'], async (config) => {
    if (config.autoSyncEnabled === false) {
      console.log('[Mandat OS Background] Auto-sync désactivée dans les options.')
      return
    }

    const baseUrl = config.mandatOsUrl || 'https://app.alexandrelopez.fr'
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/integrations/playiad/sync`

    // Rechercher un onglet Playiad ouvert
    const tabs = await chrome.tabs.query({ url: ['https://*.playiad.com/*', 'https://*.playiad.fr/*'] })

    if (!tabs || tabs.length === 0) {
      console.log('[Mandat OS Background] Aucun onglet Playiad ouvert actuellement.')
      return
    }

    const playiadTab = tabs[0]
    if (!playiadTab.id) return

    try {
      // Demander l'extraction des leads au content script de l'onglet Playiad
      const response = await chrome.tabs.sendMessage(playiadTab.id, { action: 'extract_leads' })

      if (response && Array.isArray(response.leads) && response.leads.length > 0) {
        const syncRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: response.leads }),
        })

        const json = await syncRes.json()

        if (syncRes.ok && json.success && json.createdCount > 0) {
          // Afficher une notification de bureau discrète
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'popup.html', // ou icône
            title: 'Mandat OS — Nouveaux Acquéreurs Playiad',
            message: `📥 ${json.createdCount} nouveau(x) projet(s) acquéreur(s) créé(s) automatiquement dans Mandat OS !`,
            priority: 2,
          })
        }
      }
    } catch (err) {
      console.error('[Mandat OS Background] Erreur auto-sync:', err)
    }
  })
})

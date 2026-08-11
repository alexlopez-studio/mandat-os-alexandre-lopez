// Mandat OS — service worker de l'extension Playiad.
//
// Il détient la configuration (URL, clé de synchronisation), pilote le scan
// périodique et centralise les appels à l'API : le script injecté dans la page
// Playiad ne voit jamais la clé.

const ALARM_NAME = 'playiad_auto_sync'
const DEFAULTS = {
  mandatOsUrl: 'https://app.alexandrelopez.fr',
  syncKey: '',
  leadsUrl: 'https://www.playiad.com/buyers/leads',
  autoSyncEnabled: true,
  // Playiad n'est pas une source temps réel : quatre passages par jour
  // suffisent et restent discrets côté serveur.
  intervalMinutes: 360,
}

const TAB_LOAD_TIMEOUT_MS = 30000
const TAB_POLL_MS = 500
// Marge après `complete` pour laisser la liste se remplir en AJAX.
const AJAX_SETTLE_MS = 4000

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (stored) => resolve({ ...DEFAULTS, ...stored }))
  })
}

async function scheduleAlarm() {
  const { intervalMinutes } = await getConfig()
  await chrome.alarms.clear(ALARM_NAME)
  // `delayInMinutes` est indispensable : sans lui, le premier declenchement
  // n'a lieu qu'une periode complete apres le demarrage de Chrome. Un
  // navigateur relance chaque matin ne scannerait donc quasiment jamais.
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 2,
    periodInMinutes: Math.max(15, Number(intervalMinutes) || 360),
  })
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title,
    message,
    priority: 1,
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Attend la fin du chargement en interrogeant l'onglet.
 *
 * Volontairement en polling plutot qu'en `tabs.onUpdated` : chaque appel
 * `tabs.get` est une API extension, ce qui repousse la mise en veille du
 * service worker (30 s d'inactivite en MV3). Un simple `setTimeout` ne le
 * ferait pas et le worker pourrait etre tue avant la reponse.
 */
async function waitForTabLoad(tabId) {
  const deadline = Date.now() + TAB_LOAD_TIMEOUT_MS

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    if (!tab) throw new Error('L’onglet Playiad a été fermé pendant le chargement.')
    if (tab.status === 'complete') {
      await sleep(AJAX_SETTLE_MS)
      return tab
    }
    await sleep(TAB_POLL_MS)
  }

  throw new Error('Playiad n’a pas fini de charger dans le délai imparti.')
}

/**
 * Lit les leads dans un onglet en injectant `extractor.js` a la demande.
 *
 * On n'utilise pas le content script declaratif : il ne se charge que sur les
 * domaines listes dans le manifeste, alors que l'URL des leads est configurable.
 * L'injection explicite fonctionne sur toute page couverte par host_permissions.
 */
async function readLeadsFromTab(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['extractor.js'] })

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.mandatOsExtractLeads(),
  })

  return injection?.result ?? { leads: [], rowsScanned: 0, url: '', title: '' }
}

/** Envoie les leads à Mandat OS. `dryRun` simule sans rien écrire. */
async function pushLeads(leads, { dryRun = false } = {}) {
  const config = await getConfig()

  if (!config.syncKey) {
    return {
      ok: false,
      error: 'Clé de synchronisation non renseignée dans les options de l’extension.',
    }
  }

  const endpoint = `${config.mandatOsUrl.replace(/\/$/, '')}/api/integrations/playiad/sync`

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mandat-os-key': config.syncKey },
      body: JSON.stringify({ leads, dryRun }),
    })
  } catch (err) {
    return { ok: false, error: `Serveur injoignable sur ${endpoint} (${err.message})` }
  }

  if (res.status === 404) {
    return {
      ok: false,
      error:
        `Endpoint introuvable (404) sur ${endpoint}.\n` +
        'Cette version de Mandat OS n’a pas encore la route de synchronisation : ' +
        'vérifiez l’URL, ou pointez sur un serveur où elle est déployée.',
    }
  }

  let json = {}
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: `Réponse illisible de ${endpoint} (HTTP ${res.status})` }
  }

  if (res.status === 401) {
    return {
      ok: false,
      error:
        'Clé refusée par Mandat OS (401). La clé de l’extension doit être identique à ' +
        'PLAYIAD_SYNC_SECRET côté serveur — et cette variable doit exister sur ce serveur.',
    }
  }
  if (!res.ok || !json.success) {
    return { ok: false, error: json.error || `Erreur serveur (HTTP ${res.status})` }
  }

  return {
    ok: true,
    dryRun: Boolean(json.dryRun),
    createdCount: json.createdCount || 0,
    skippedCount: json.skippedCount || 0,
    errorCount: json.errorCount || 0,
    results: json.results || [],
  }
}

/**
 * Ouvre la liste des acquéreurs dans un onglet en arrière-plan, en lit les
 * leads puis referme. Ne dépend pas d'un onglet Playiad déjà ouvert, sinon le
 * scan périodique ne se déclencherait quasiment jamais.
 *
 * En contrepartie la session Playiad doit être active : sinon la page de
 * connexion s'affiche et la lecture est vide, ce que l'on signale explicitement.
 */
async function scanPlayiad({ dryRun = false } = {}) {
  const config = await getConfig()
  let tab = null

  try {
    tab = await chrome.tabs.create({ url: config.leadsUrl, active: false })
    await waitForTabLoad(tab.id)

    const page = await readLeadsFromTab(tab.id)

    if (page.leads.length === 0) {
      const looksLikeLogin = /login|connexion|signin|auth/i.test(`${page.url} ${page.title}`)
      return {
        ok: false,
        error: looksLikeLogin
          ? `Playiad a affiché une page de connexion (${page.title}). Ouvrez Playiad et connectez-vous, puis relancez.`
          : `Aucun lead lu sur ${page.url} (${page.rowsScanned} ligne(s) parcourue(s)). Vérifiez l’URL de la page des leads.`,
        leadCount: 0,
        rowsScanned: page.rowsScanned,
      }
    }

    const result = await pushLeads(page.leads, { dryRun })
    return { ...result, leadCount: page.leads.length, rowsScanned: page.rowsScanned }
  } catch (err) {
    return { ok: false, error: err.message || String(err) }
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {})
  }
}

chrome.runtime.onInstalled.addListener(scheduleAlarm)
chrome.runtime.onStartup.addListener(scheduleAlarm)

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return

  const { autoSyncEnabled } = await getConfig()
  if (!autoSyncEnabled) return

  const result = await scanPlayiad()

  if (!result.ok) {
    console.warn('[Mandat OS] Scan automatique interrompu :', result.error)
    return
  }
  if (result.createdCount > 0) {
    notify(
      'Mandat OS — Nouveaux acquéreurs',
      `${result.createdCount} nouveau(x) projet(s) acquéreur(s) importé(s) depuis Playiad.`,
    )
  }
})

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'sync_leads') {
    pushLeads(request.leads, { dryRun: request.dryRun })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (request.action === 'run_scan_now') {
    scanPlayiad({ dryRun: request.dryRun })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (request.action === 'reschedule') {
    scheduleAlarm()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  return false
})

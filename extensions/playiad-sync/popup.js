document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('mandatUrl')
  const autoSyncCheckbox = document.getElementById('autoSync')
  const saveBtn = document.getElementById('saveBtn')
  const statusDiv = document.getElementById('status')

  chrome.storage.sync.get(['mandatOsUrl', 'autoSyncEnabled'], (data) => {
    if (data.mandatOsUrl) {
      urlInput.value = data.mandatOsUrl
    }
    if (typeof data.autoSyncEnabled === 'boolean') {
      autoSyncCheckbox.checked = data.autoSyncEnabled
    }
  })

  saveBtn.addEventListener('click', () => {
    const val = urlInput.value.trim()
    const isAutoSync = autoSyncCheckbox.checked

    chrome.storage.sync.set({ mandatOsUrl: val, autoSyncEnabled: isAutoSync }, () => {
      statusDiv.innerText = 'Configuration enregistrée !'
      setTimeout(() => {
        statusDiv.innerText = ''
      }, 2500)
    })
  })
})

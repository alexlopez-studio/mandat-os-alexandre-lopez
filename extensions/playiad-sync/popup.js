document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('mandatUrl')
  const saveBtn = document.getElementById('saveBtn')
  const statusDiv = document.getElementById('status')

  chrome.storage.sync.get(['mandatOsUrl'], (data) => {
    if (data.mandatOsUrl) {
      urlInput.value = data.mandatOsUrl
    }
  })

  saveBtn.addEventListener('click', () => {
    const val = urlInput.value.trim()
    chrome.storage.sync.set({ mandatOsUrl: val }, () => {
      statusDiv.innerText = 'Configuration enregistrée !'
      setTimeout(() => {
        statusDiv.innerText = ''
      }, 2500)
    })
  })
})

import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'

async function smoke() {
  await import('../out/main/index.js')
  await app.whenReady()
  const window = BrowserWindow.getAllWindows()[0]
  assert.ok(window, 'A janela principal deve existir')
  const errors = []
  window.webContents.on('preload-error', (_event, _path, error) => errors.push(error.message))
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message)
  })
  if (window.webContents.isLoading()) {
    await new Promise((resolve, reject) => {
      window.webContents.once('did-finish-load', resolve)
      window.webContents.once('did-fail-load', (_event, code, description) => reject(new Error(`${code}: ${description}`)))
    })
  }
  const state = await window.webContents.executeJavaScript(`(async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      heading: document.querySelector('h1')?.textContent,
      background: getComputedStyle(document.body).backgroundColor,
      node: typeof window.require,
      api: Object.keys(window.downloader).sort(),
      invalid: await window.downloader.inspectVideo('https://youtube.com.evil.test/watch?v=BaW_jenozKc')
    };
  })()`)
  assert.deepEqual(errors, [], 'A interface deve carregar sem erros de CSP ou preload')
  assert.match(state.heading, /Seu vídeo/)
  assert.equal(state.background, 'rgb(16, 18, 23)')
  assert.equal(state.node, 'undefined')
  assert.deepEqual(state.api, ['cancelDownload', 'chooseDirectory', 'inspectVideo', 'onDownloadEvent', 'startDownload'])
  assert.equal(state.invalid.ok, false)
  assert.match(state.invalid.error, /link de um vídeo/)
  console.log('SMOKE OK: React, CSS, preload isolado e validação IPC funcionando no build compilado.')
}

const timer = setTimeout(() => { console.error('Timeout no smoke test.'); app.exit(1) }, 20000)
smoke().then(() => { clearTimeout(timer); app.quit() }).catch((error) => {
  clearTimeout(timer)
  console.error(error)
  app.exit(1)
})

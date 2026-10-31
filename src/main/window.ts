import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function createWindow(): BrowserWindow {
  const directory = fileURLToPath(new URL('.', import.meta.url))
  const window = new BrowserWindow({
    width: 1180, height: 820, minWidth: 800, minHeight: 680,
    backgroundColor: '#101217', title: 'YouTube Downloader', autoHideMenuBar: true,
    webPreferences: { preload: join(directory, '../preload/index.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.webContents.session.setPermissionCheckHandler(() => false)
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(directory, '../renderer/index.html'))
  return window
}

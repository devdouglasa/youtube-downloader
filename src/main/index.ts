import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { channels } from '../shared/contracts'
import { DownloadService } from './downloads/service'
import { resolveTools } from './downloads/tools'
import { registerIPC } from './ipc'
import { createWindow } from './window'

let window: BrowserWindow | null = null
let service: DownloadService | undefined
let mayQuit = false
let closing = false

const openWindow = (): void => {
  window = createWindow()
  window.on('close', (event) => {
    if (!mayQuit) { event.preventDefault(); app.quit() }
  })
  window.on('closed', () => { window = null })
}

app.whenReady().then(() => {
  service = new DownloadService(() => resolveTools(join(app.getAppPath(), 'resources/bin')),
    join(app.getPath('temp'), 'youtube-downloader'), (event) => {
      if (window && !window.isDestroyed()) window.webContents.send(channels.event, event)
    })
  registerIPC(() => window, service)
  openWindow()
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openWindow() })
}).catch((error: unknown) => { console.error(error); app.quit() })

app.on('before-quit', (event) => {
  if (mayQuit) return
  event.preventDefault()
  if (closing) return
  closing = true
  void (service?.cancel() ?? Promise.resolve()).finally(() => { mayQuit = true; app.quit() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

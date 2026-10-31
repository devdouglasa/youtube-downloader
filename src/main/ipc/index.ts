import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { DownloadRequest, Result } from '../../shared/contracts'
import { channels } from '../../shared/contracts'
import { userMessage } from '../downloads/errors'
import type { DownloadService } from '../downloads/service'

export function registerIPC(getWindow: () => BrowserWindow | null, service: DownloadService): void {
  let chosenDirectory: string | null = null
  const handle = <T>(channel: string, action: (value: unknown) => T | Promise<T>): void => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, value: unknown): Promise<Result<T>> => {
      try {
        const window = getWindow()
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
          event.senderFrame?.url !== window.webContents.getURL()) throw new Error('Origem de comunicação não autorizada.')
        return { ok: true, value: await action(value) }
      } catch (error) { console.error(`[${channel}]`, error); return { ok: false, error: userMessage(error) } }
    })
  }
  handle(channels.inspect, (url) => service.inspectVideo(url))
  handle(channels.directory, async () => {
    const window = getWindow()
    if (!window) throw new Error('Janela indisponível.')
    const result = await dialog.showOpenDialog(window, { title: 'Escolha onde salvar o vídeo',
      defaultPath: chosenDirectory ?? app.getPath('downloads'), properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled) return null
    chosenDirectory = result.filePaths[0] ?? null
    return chosenDirectory
  })
  handle(channels.start, (input) => {
    if (!input || typeof input !== 'object') throw new Error('Pedido de download inválido.')
    const request = input as DownloadRequest
    if (!chosenDirectory || request.directory !== chosenDirectory) throw new Error('Escolha a pasta de destino usando o seletor.')
    return service.startDownload(request)
  })
  handle(channels.cancel, () => service.cancel())
}

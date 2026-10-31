import { contextBridge, ipcRenderer } from 'electron'
import { channels, type DownloaderAPI, type DownloadEvent } from '../shared/contracts'

const api: DownloaderAPI = {
  inspectVideo: (url) => ipcRenderer.invoke(channels.inspect, url),
  chooseDirectory: () => ipcRenderer.invoke(channels.directory),
  startDownload: (request) => ipcRenderer.invoke(channels.start, request),
  cancelDownload: () => ipcRenderer.invoke(channels.cancel),
  onDownloadEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DownloadEvent): void => listener(data)
    ipcRenderer.on(channels.event, handler)
    return () => ipcRenderer.removeListener(channels.event, handler)
  }
}
contextBridge.exposeInMainWorld('downloader', api)

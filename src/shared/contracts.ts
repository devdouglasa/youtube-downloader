export interface VideoInfo {
  url: string
  title: string
  duration: number | null
  qualities: number[]
  hasAudio: boolean
}

export type DownloadMode = 'video' | 'audio'

export type DownloadStatus = 'downloading' | 'processing' | 'completed' | 'cancelled' | 'error'

export interface DownloadEvent {
  id: string
  status: DownloadStatus
  percent?: number
  speed?: number
  eta?: number
  path?: string
  message?: string
}

export type DownloadRequest = {
  url: string
  directory: string
} & ({ mode: 'video'; quality: number | 'best' } | { mode: 'audio' })

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface DownloaderAPI {
  inspectVideo(url: string): Promise<Result<VideoInfo>>
  chooseDirectory(): Promise<Result<string | null>>
  startDownload(request: DownloadRequest): Promise<Result<string>>
  cancelDownload(): Promise<Result<void>>
  onDownloadEvent(listener: (event: DownloadEvent) => void): () => void
}

export const channels = {
  inspect: 'video:inspect',
  directory: 'download:directory',
  start: 'download:start',
  cancel: 'download:cancel',
  event: 'download:event'
} as const

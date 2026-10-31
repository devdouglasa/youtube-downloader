export interface VideoInfo {
  url: string
  title: string
  duration: number | null
  qualities: number[]
}

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

export interface DownloadRequest {
  url: string
  quality: number | 'best'
  directory: string
}

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

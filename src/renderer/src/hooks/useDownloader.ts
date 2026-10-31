import { useEffect, useRef, useState } from 'react'
import type { DownloadEvent, Result, VideoInfo } from '../../../shared/contracts'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.value
}

export function useDownloader() {
  const [url, setUrl] = useState('')
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [quality, setQuality] = useState<number | 'best'>('best')
  const [directory, setDirectory] = useState('')
  const [event, setEvent] = useState<DownloadEvent | null>(null)
  const [error, setError] = useState('')
  const [inspecting, setInspecting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const taskId = useRef<string | null>(null)
  const terminalId = useRef<string | null>(null)
  const pendingEvents = useRef<DownloadEvent[]>([])
  const active = event?.status === 'downloading' || event?.status === 'processing'
  const busy = inspecting || starting || active || cancelling || choosing

  useEffect(() => window.downloader.onDownloadEvent((update) => {
    if (!taskId.current) { pendingEvents.current.push(update); return }
    if (update.id !== taskId.current) return
    if (['completed', 'cancelled', 'error'].includes(update.status)) terminalId.current = update.id
    if (terminalId.current && terminalId.current !== update.id) return
    setEvent(update)
  }), [])

  const report = (e: unknown): void => setError(e instanceof Error ? e.message : 'Não foi possível concluir a operação.')

  const inspect = async (): Promise<void> => {
    setError(''); setVideo(null); setEvent(null); setInspecting(true)
    taskId.current = null; terminalId.current = null; pendingEvents.current = []
    try { setVideo(unwrap(await window.downloader.inspectVideo(url))); setQuality('best') }
    catch (e) { report(e) }
    finally { setInspecting(false); setCancelling(false) }
  }

  const chooseDirectory = async (): Promise<void> => {
    setError(''); setChoosing(true)
    try { const chosen = unwrap(await window.downloader.chooseDirectory()); if (chosen) setDirectory(chosen) }
    catch (e) { report(e) }
    finally { setChoosing(false) }
  }

  const start = async (): Promise<void> => {
    if (!video) return
    setError(''); setStarting(true); setEvent(null)
    taskId.current = null; terminalId.current = null; pendingEvents.current = []
    try {
      const id = unwrap(await window.downloader.startDownload({ url: video.url, quality, directory }))
      taskId.current = id
      const queued = pendingEvents.current.filter((update) => update.id === id)
      const latest = queued.at(-1)
      if (latest && ['completed', 'cancelled', 'error'].includes(latest.status)) terminalId.current = id
      setEvent(latest ?? { id, status: 'downloading' })
      pendingEvents.current = []
    } catch (e) { report(e) }
    finally { setStarting(false) }
  }

  const cancel = async (): Promise<void> => {
    setCancelling(true)
    try { unwrap(await window.downloader.cancelDownload()) } catch (e) { report(e) }
    finally { setCancelling(false) }
  }

  const changeUrl = (value: string): void => { setUrl(value); setVideo(null); setEvent(null); setError('') }

  return { url, changeUrl, video, quality, setQuality, directory, event, error, inspecting, starting, choosing,
    cancelling, active, busy, inspect, chooseDirectory, start, cancel }
}

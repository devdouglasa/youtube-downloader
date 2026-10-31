import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import type { DownloadEvent } from '../src/shared/contracts'
import { DownloadService } from '../src/main/downloads/service'
import { resolveTools } from '../src/main/downloads/tools'
import { runTool } from '../src/main/downloads/runner'

it.skipIf(!process.env.LIVE_VIDEO_URL).each(['video', 'audio'] as const)('baixa %s com ferramentas reais e confirma codecs', async (mode) => {
  const root = await mkdtemp(join(tmpdir(), 'downloader-live-'))
  const destination = join(root, 'Vídeos com espaços e acentos')
  await mkdir(destination)
  const tools = resolveTools(resolve('resources/bin'))
  try {
    const events: DownloadEvent[] = []
    let finish!: (event: DownloadEvent) => void
    const completion = new Promise<DownloadEvent>((resolve) => { finish = resolve })
    const service = new DownloadService(() => tools, join(root, 'temp'), (event) => {
      events.push(event)
      if (['error', 'completed', 'cancelled'].includes(event.status)) finish(event)
    })
    const video = await service.inspectVideo(process.env.LIVE_VIDEO_URL)
    console.log('Vídeo consultado:', video.title, video.qualities)
    service.startDownload(mode === 'audio'
      ? { url: video.url, directory: destination, mode }
      : { url: video.url, directory: destination, mode, quality: Math.min(...video.qualities) })
    const timeout = setTimeout(() => { void service.cancel() }, 180000)
    const event = await completion.finally(() => clearTimeout(timeout))
    expect(event.status, event.message).toBe('completed')
    expect(event.path).toMatch(mode === 'audio' ? /\.mp3$/i : /\.mp4$/i)
    expect(events.some((event) => event.status === 'downloading' && (event.percent ?? 0) > 0)).toBe(true)
    expect(events.some((event) => event.status === 'processing')).toBe(true)
    const result = await promisify(execFile)(tools.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name:format=format_name', '-of', 'json', event.path!], { windowsHide: true })
    const data = JSON.parse(result.stdout) as { streams: { codec_type: string; codec_name: string }[]; format: { format_name: string } }
    if (mode === 'audio') {
      expect(data.format.format_name).toBe('mp3')
      expect(data.streams).toEqual([expect.objectContaining({ codec_type: 'audio', codec_name: 'mp3' })])
    } else {
      expect(data.format.format_name.split(',')).toContain('mp4')
      expect(data.streams.map((s) => s.codec_type)).toEqual(expect.arrayContaining(['video', 'audio']))
      expect(data.streams.find((s) => s.codec_type === 'video')?.codec_name).toBe('h264')
      expect(data.streams.find((s) => s.codec_type === 'audio')?.codec_name).toBe('aac')
    }
    expect(await readdir(join(root, 'temp'))).toEqual([])
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }) }
}, 250000)

it.skipIf(!process.env.LIVE_VIDEO_URL || process.platform !== 'win32')('cancela também os subprocessos no Windows', async () => {
  let descendant: number | undefined
  const controller = new AbortController()
  const script = `const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e',"console.log('ready');setInterval(()=>{},1000)"],{windowsHide:true});
    child.stdout.once('data',()=>console.log(child.pid));setInterval(()=>{},1000);`
  try {
    await expect(runTool(process.execPath, ['-e', script], controller.signal, (line) => {
      descendant = Number(line)
      controller.abort()
    })).rejects.toThrow('cancelada')
    expect(descendant).toBeGreaterThan(0)
    expect(() => process.kill(descendant!, 0)).toThrow()
  } finally {
    if (descendant) { try { process.kill(descendant) } catch { /* Already terminated. */ } }
  }
}, 15000)

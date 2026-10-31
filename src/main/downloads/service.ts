import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, copyFile, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import type { DownloadEvent, DownloadRequest, VideoInfo } from '../../shared/contracts'
import { userMessage } from './errors'
import { compatibleQualities, type VideoFormat } from './formats'
import { parseProgress } from './progress'
import { CancelledError, runTool, type RunTool } from './runner'
import { baseArguments, downloadArguments, type Tools } from './tools'
import { normalizeVideoUrl } from './url'

interface ActiveTask { controller: AbortController; done: Promise<unknown>; committing: boolean }

export class DownloadService {
  private active: ActiveTask | null = null
  private inspected: VideoInfo | null = null

  constructor(
    private readonly getTools: () => Tools,
    private readonly tempRoot: string,
    private readonly emit: (event: DownloadEvent) => void,
    private readonly run: RunTool = runTool
  ) {}

  private assertIdle(): void {
    if (this.active) throw new Error('Já existe uma operação em andamento. Aguarde ou cancele antes de continuar.')
  }

  async inspectVideo(input: unknown): Promise<VideoInfo> {
    this.assertIdle()
    const url = normalizeVideoUrl(input)
    const tools = this.getTools()
    const controller = new AbortController()
    const task: ActiveTask = { controller, done: Promise.resolve(), committing: false }
    this.active = task
    this.inspected = null
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, 60000)
    task.done = (async () => {
      let raw = ''
      await this.run(tools.ytdlp, [...baseArguments(tools), '--skip-download', '--dump-single-json', '--', url], controller.signal, (line) => {
        raw += line
        if (raw.length > 8 * 1024 * 1024) throw new Error('Os metadados do vídeo excederam o limite permitido.')
      })
      if (controller.signal.aborted) throw new CancelledError()
      const data = JSON.parse(raw) as { title?: string; duration?: number; is_live?: boolean; live_status?: string;
        formats?: VideoFormat[] }
      if (data.is_live || data.live_status === 'is_upcoming' || data.live_status === 'post_live') {
        throw new Error('Esta versão aceita vídeos gravados. Aguarde a transmissão ser finalizada e processada.')
      }
      const qualities = compatibleQualities(data.formats ?? [])
      const hasAudio = (data.formats ?? []).some((format) => Boolean(format.acodec && format.acodec !== 'none'))
      if (!qualities.length && !hasAudio) throw new Error('Este vídeo não oferece áudio nem formatos MP4 compatíveis. Tente outro vídeo ou atualize o yt-dlp.')
      const info: VideoInfo = { url, title: data.title ?? 'Vídeo sem título',
        duration: typeof data.duration === 'number' ? data.duration : null, qualities, hasAudio }
      this.inspected = info
      return info
    })()
    try { return await task.done as VideoInfo }
    catch (error) { if (timedOut) throw new Error('A consulta demorou demais. Verifique a conexão e tente novamente.', { cause: error }); throw error }
    finally { clearTimeout(timer); if (this.active === task) this.active = null }
  }

  startDownload(request: DownloadRequest): string {
    this.assertIdle()
    const url = normalizeVideoUrl(request.url)
    if (request.mode !== 'video' && request.mode !== 'audio') throw new Error('Selecione vídeo MP4 ou áudio MP3.')
    if (!this.inspected || this.inspected.url !== url) throw new Error('Consulte o vídeo antes de baixar.')
    if (request.mode === 'video') {
      if (!this.inspected.qualities.length) throw new Error('Não há vídeo H.264/AAC disponível. Você pode escolher apenas áudio MP3, se disponível.')
      if (request.quality !== 'best' && !this.inspected.qualities.includes(request.quality)) throw new Error('Selecione uma qualidade disponível.')
    } else if (!this.inspected.hasAudio) throw new Error('Este vídeo não possui uma faixa de áudio disponível.')
    const tools = this.getTools()
    const id = randomUUID()
    const task: ActiveTask = { controller: new AbortController(), done: Promise.resolve(), committing: false }
    this.active = task
    // Defer execution so callers receive the task identifier before the first event.
    task.done = Promise.resolve().then(() => this.download(id, task, tools, { ...request, url }))
    return id
  }

  private async download(id: string, task: ActiveTask, tools: Tools, request: DownloadRequest): Promise<void> {
    let temp: string | undefined
    let terminal: DownloadEvent
    try {
      await access(request.directory, constants.W_OK)
      await mkdir(this.tempRoot, { recursive: true })
      temp = await mkdtemp(join(this.tempRoot, 'download-'))
      if (task.controller.signal.aborted) throw new CancelledError()
      let output: string | undefined
      this.emit({ id, status: 'downloading' })
      await this.run(tools.ytdlp, downloadArguments(tools, request.url, request.mode === 'video' ? request.quality : 'best', temp, request.mode), task.controller.signal, (line) => {
        if (line.startsWith('APP_FILE:')) {
          const value: unknown = JSON.parse(line.slice('APP_FILE:'.length))
          if (typeof value === 'string') output = value
        }
        const progress = parseProgress(line)
        if (progress) this.emit({ id, ...progress })
      })
      if (task.controller.signal.aborted) throw new CancelledError()
      if (!output) throw new Error('A ferramenta terminou sem informar o arquivo final.')
      const source = await realpath(output)
      if (dirname(source) !== await realpath(temp)) throw new Error('A ferramenta retornou um arquivo fora da pasta temporária.')
      const extension = request.mode === 'audio' ? 'mp3' : 'mp4'
      if (extname(source).toLowerCase() !== `.${extension}`) throw new Error(`Não foi possível finalizar o arquivo em ${extension.toUpperCase()}. Atualize o yt-dlp e o FFmpeg e tente novamente.`)
      if (task.controller.signal.aborted) throw new CancelledError()
      // From this point the exclusive final copy is atomic from the task's perspective.
      task.committing = true
      this.emit({ id, status: 'processing', message: 'Salvando o arquivo na pasta escolhida…' })
      const destination = await saveWithoutOverwrite(source, request.directory)
      terminal = { id, status: 'completed', path: destination, percent: 100 }
    } catch (error) {
      const cancelled = task.controller.signal.aborted || error instanceof CancelledError
      if (!cancelled) console.error('[download]', error)
      terminal = { id, status: cancelled ? 'cancelled' : 'error', message: cancelled ? 'Download cancelado.' : userMessage(error) }
    } finally {
      if (temp) {
        try { await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
        catch (error) { console.error('[temporary-cleanup]', error) }
      }
      if (this.active === task) this.active = null
    }
    this.emit(terminal!)
  }

  async cancel(): Promise<void> {
    const task = this.active
    if (!task) return
    if (!task.committing) task.controller.abort()
    await task.done.catch(() => undefined)
  }
}

export async function saveWithoutOverwrite(source: string, directory: string): Promise<string> {
  const filename = basename(source)
  const extension = extname(filename)
  const stem = filename.slice(0, filename.length - extension.length)
  for (let index = 0; index < 10000; index++) {
    const destination = join(directory, index ? `${stem} (${index})${extension}` : filename)
    try { await copyFile(source, destination, constants.COPYFILE_EXCL); return destination }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  }
  throw new Error('Há muitos arquivos com o mesmo nome na pasta de destino.')
}

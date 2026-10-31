import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DownloadEvent } from '../src/shared/contracts'
import { LineReader, parseProgress } from '../src/main/downloads/progress'
import { CancelledError, runTool, type RunTool } from '../src/main/downloads/runner'
import { DownloadService } from '../src/main/downloads/service'
import { downloadArguments, type Tools } from '../src/main/downloads/tools'
import { normalizeVideoUrl } from '../src/main/downloads/url'

const url = 'https://www.youtube.com/watch?v=BaW_jenozKc'
const tools: Tools = { ytdlp: 'yt-dlp.exe', ffmpeg: 'C:\\tools with spaces\\ffmpeg.exe', ffprobe: 'ffprobe.exe', deno: 'deno.exe' }
const metadata = JSON.stringify({ title: 'Vídeo de teste', duration: 10, formats: [
  { height: 1080, vcodec: 'avc1' }, { height: 720, vcodec: 'vp9' }, { height: 720, vcodec: 'avc1' }, { vcodec: 'none' }
] })

describe('URLs', () => {
  it.each([
    url, 'https://youtu.be/BaW_jenozKc?t=1', 'https://www.youtube.com/shorts/BaW_jenozKc',
    'https://m.youtube.com/watch?v=BaW_jenozKc&list=PLtest', 'https://youtube.com/embed/BaW_jenozKc'
  ])('normaliza %s para um único vídeo', (input) => expect(normalizeVideoUrl(input)).toBe(url))
  it.each([
    'http://youtu.be/BaW_jenozKc', 'https://youtube.com.evil.test/watch?v=BaW_jenozKc',
    'https://youtube.com/playlist?list=PLtest', 'https://youtube.com/@canal',
    'https://user:pass@youtube.com/watch?v=BaW_jenozKc', 'file:///etc/passwd',
    'https://youtu.be/BaW_jenozKc/extra', 'https://youtube.com/watch?v=invalid', null,
    'https://youtube.com:444/watch?v=BaW_jenozKc'
  ])('rejeita %s', (input) => expect(() => normalizeVideoUrl(input)).toThrow())
})

describe('argumentos e protocolo de progresso', () => {
  it('mantém caminhos como argumentos separados e limita a resolução sem transcodificar', () => {
    const args = downloadArguments(tools, url, 720, 'C:\\Vídeos com acentos\\temporário')
    expect(args).toContain('bv*[height<=720]+ba/b[height<=720]')
    expect(args).toContain('C:\\Vídeos com acentos\\temporário')
    expect(args).toContain(tools.ffmpeg)
    expect(args).toContain('--ignore-config')
    expect(args).toContain('--no-playlist')
    expect(args.slice(-2)).toEqual(['--', url])
    expect(args).not.toContain('--recode-video')
    expect(args[args.indexOf('--merge-output-format') + 1]).toBe('mp4')
    expect(args[args.indexOf('--remux-video') + 1]).toBe('mp4')
    expect(() => downloadArguments(tools, url, NaN, 'temp')).toThrow()
  })
  it('reconstitui linhas fragmentadas e ignora dados inválidos', () => {
    const events: unknown[] = []
    const reader = new LineReader((line) => { const event = parseProgress(line); if (event) events.push(event) })
    reader.push('APP_PROG')
    reader.push('RESS:{"downloaded_bytes":50,"total_')
    reader.push('bytes":100,"speed":1024,"eta":2}\r\nAPP_PHASE:proce')
    reader.push('ssing\nAPP_PROGRESS:invalid\nAPP_PROGRESS:{"eta":"NA"}')
    reader.flush()
    expect(events).toEqual([{ status: 'downloading', percent: 50, speed: 1024, eta: 2 },
      { status: 'processing' }, { status: 'downloading', percent: undefined, speed: undefined, eta: undefined }])
  })
})

describe('serviço de download', () => {
  let root: string
  let destination: string
  let events: DownloadEvent[]
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'downloader-test-'))
    destination = join(root, 'Vídeos com espaços e acentos')
    await mkdir(destination)
    events = []
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true, maxRetries: 5 }) })
  const inspectOr = (download: RunTool): RunTool => async (file, args, signal, onLine) => {
    if (args.includes('--dump-single-json')) { onLine(metadata); return }
    await download(file, args, signal, onLine)
  }
  const waitUntil = async (predicate: () => boolean): Promise<void> => {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise((resolve) => setTimeout(resolve, 10)) }
    throw new Error('Timeout aguardando estado do teste.')
  }
  const service = (run: RunTool): DownloadService => new DownloadService(() => tools, join(root, 'temp'), (event) => events.push(event), run)
  const request = () => ({ url, quality: 'best' as const, directory: destination })

  it('inspeciona formatos, bloqueia concorrência e preserva arquivo existente', async () => {
    const s = service(inspectOr(async (_file, args, _signal, line) => {
      const folder = args[args.indexOf('--paths') + 1]
      const output = join(folder, 'Vídeo [BaW_jenozKc].mp4')
      await writeFile(output, 'novo vídeo')
      line('APP_PHASE:processing')
      line(`APP_FILE:${JSON.stringify(output)}`)
    }))
    const info = await s.inspectVideo(url)
    expect(info.qualities).toEqual([1080, 720])
    await writeFile(join(destination, 'Vídeo [BaW_jenozKc].mp4'), 'original')
    const id = s.startDownload(request())
    expect(() => s.startDownload(request())).toThrow('andamento')
    await expect(s.inspectVideo(url)).rejects.toThrow('andamento')
    await waitUntil(() => events.some((event) => event.status === 'completed'))
    const final = events.at(-1)!
    expect(final.id).toBe(id)
    expect(final.path).toBe(join(destination, 'Vídeo [BaW_jenozKc] (1).mp4'))
    expect(await readFile(join(destination, 'Vídeo [BaW_jenozKc].mp4'), 'utf8')).toBe('original')
    expect(await readFile(final.path!, 'utf8')).toBe('novo vídeo')
    expect(await readdir(join(root, 'temp'))).toEqual([])
  })

  it.each(['downloading', 'processing'] as const)('cancela durante %s e limpa temporários', async (phase) => {
    let running = false
    const s = service(inspectOr(async (_file, _args, signal, line) => {
      running = true
      line(`APP_PHASE:${phase}`)
      await new Promise<void>((_resolve, reject) => {
        if (signal.aborted) reject(new CancelledError())
        else signal.addEventListener('abort', () => reject(new CancelledError()), { once: true })
      })
    }))
    await s.inspectVideo(url)
    s.startDownload(request())
    await waitUntil(() => running)
    await s.cancel()
    expect(events.at(-1)?.status).toBe('cancelled')
    expect(await readdir(destination)).toEqual([])
    expect(await readdir(join(root, 'temp'))).toEqual([])
    expect(() => s.startDownload(request())).not.toThrow()
    await s.cancel()
  })

  it('cancela consulta e permite nova operação', async () => {
    const s = service(async (_file, _args, signal) => new Promise<void>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new CancelledError()), { once: true })
    }))
    const pending = s.inspectVideo(url)
    const rejection = expect(pending).rejects.toThrow('cancelada')
    await s.cancel()
    await rejection
  })

  it('transforma falha de rede em erro e libera o serviço', async () => {
    const s = service(inspectOr(async () => { throw new Error('Unable to download: network error') }))
    await s.inspectVideo(url)
    s.startDownload(request())
    await waitUntil(() => events.some((event) => event.status === 'error'))
    expect(events.at(-1)?.message).toContain('conexão')
    expect(await readdir(join(root, 'temp'))).toEqual([])
    await expect(s.inspectVideo(url)).resolves.toHaveProperty('title')
  })

  it('rejeita arquivo final fora do temporário e qualidade não consultada', async () => {
    const outside = join(destination, 'outside.mp4')
    await writeFile(outside, 'preservar')
    const s = service(inspectOr(async (_file, _args, _signal, line) => { line(`APP_FILE:${JSON.stringify(outside)}`) }))
    await s.inspectVideo(url)
    expect(() => s.startDownload({ ...request(), quality: 480 })).toThrow('qualidade')
    s.startDownload(request())
    await waitUntil(() => events.some((event) => event.status === 'error'))
    expect(await readFile(outside, 'utf8')).toBe('preservar')
    expect(events.at(-1)?.message).toContain('fora da pasta')
  })

  it('não publica um arquivo final que não seja MP4', async () => {
    const s = service(inspectOr(async (_file, args, _signal, line) => {
      const output = join(args[args.indexOf('--paths') + 1], 'video.webm')
      await writeFile(output, 'resultado inesperado')
      line(`APP_FILE:${JSON.stringify(output)}`)
    }))
    await s.inspectVideo(url)
    s.startDownload(request())
    await waitUntil(() => events.some((event) => event.status === 'error'))
    expect(events.at(-1)?.message).toContain('MP4')
    expect(await readdir(destination)).toEqual([])
    expect(await readdir(join(root, 'temp'))).toEqual([])
  })
})

describe('executor de processos real', () => {
  it('decodifica UTF-8 e descarrega última linha sem quebra', async () => {
    const lines: string[] = []
    await runTool(process.execPath, ['-e', "process.stdout.write('Vídeo\\núltima')"], new AbortController().signal, (line) => lines.push(line))
    expect(lines).toEqual(['Vídeo', 'última'])
  })
  it('reporta código de saída e diagnóstico', async () => {
    await expect(runTool(process.execPath, ['-e', "console.error('diagnóstico');process.exit(3)"],
      new AbortController().signal, () => undefined)).rejects.toThrow('diagnóstico')
  })
  it('interrompe um processo ativo', async () => {
    const controller = new AbortController()
    await expect(runTool(process.execPath, ['-e', "console.log('ready');setInterval(()=>{},1000)"],
      controller.signal, () => controller.abort())).rejects.toThrow('cancelada')
  })
})

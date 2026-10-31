import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'
import type { DownloadMode } from '../../shared/contracts'

export interface Tools { ytdlp: string; ffmpeg: string; ffprobe: string; deno: string }

export function resolveTools(binDirectory: string): Tools {
  const find = (name: string): string => {
    const filename = process.platform === 'win32' ? `${name}.exe` : name
    const folders = [binDirectory, ...(process.env.PATH ?? '').split(delimiter).filter(Boolean)]
    for (const folder of folders) {
      const path = join(folder, filename)
      try { accessSync(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK); return path } catch { /* Try next location. */ }
    }
    throw new Error(`Ferramenta ausente: ${filename}. Consulte resources/bin/README.md e execute npm run tools:check.`)
  }
  return { ytdlp: find('yt-dlp'), ffmpeg: find('ffmpeg'), ffprobe: find('ffprobe'), deno: find('deno') }
}

export function baseArguments(tools: Tools): string[] {
  return ['--ignore-config', '--no-playlist', '--no-colors', '--encoding', 'utf-8',
    '--js-runtimes', `deno:${tools.deno}`, '--ffmpeg-location', tools.ffmpeg,
    '--socket-timeout', '30', '--retries', '3']
}

export function downloadArguments(tools: Tools, url: string, quality: number | 'best', directory: string, mode: DownloadMode = 'video'): string[] {
  if (quality !== 'best' && (!Number.isInteger(quality) || quality <= 0)) throw new Error('Qualidade inválida.')
  const limit = quality === 'best' ? '' : `[height<=${quality}]`
  const mediaArguments = mode === 'audio'
    ? ['--format', 'ba/b[acodec!=none]', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0']
    : ['--format', `bv[ext=mp4][vcodec^=avc1]${limit}+ba[ext=m4a][acodec^=mp4a]/b[ext=mp4][vcodec^=avc1][acodec^=mp4a]${limit}`,
      '--merge-output-format', 'mp4', '--remux-video', 'mp4']
  return [...baseArguments(tools), '--newline', '--no-simulate',
    '--progress', '--progress-delta', '0.25', '--progress-template', 'download:APP_PROGRESS:%(progress)j',
    '--progress-template', 'postprocess:APP_PHASE:processing',
    '--print', 'before_dl:APP_PHASE:downloading',
    '--print', 'post_process:APP_PHASE:processing',
    '--print', 'after_move:APP_FILE:%(filepath)j',
    ...mediaArguments,
    '--windows-filenames', '--trim-filenames', '160',
    '--paths', directory, '--output', '%(title)s [%(id)s].%(ext)s', '--', url]
}

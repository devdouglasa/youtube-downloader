import type { DownloadEvent } from '../../shared/contracts'

export type ProgressUpdate = Omit<DownloadEvent, 'id'>

export class LineReader {
  private pending = ''
  constructor(private readonly onLine: (line: string) => void) {}
  push(chunk: string): void {
    this.pending += chunk
    const lines = this.pending.split(/\r?\n/)
    this.pending = lines.pop() ?? ''
    if (this.pending.length > 8 * 1024 * 1024) throw new Error('Resposta da ferramenta excedeu o limite permitido.')
    lines.forEach(this.onLine)
  }
  flush(): void { if (this.pending) this.onLine(this.pending); this.pending = '' }
}

export function parseProgress(line: string): ProgressUpdate | null {
  if (line === 'APP_PHASE:processing') return { status: 'processing' }
  if (line === 'APP_PHASE:downloading') return { status: 'downloading' }
  if (!line.startsWith('APP_PROGRESS:')) return null
  try {
    const p = JSON.parse(line.slice('APP_PROGRESS:'.length)) as Record<string, unknown>
    const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
    const downloaded = number(p.downloaded_bytes)
    const total = number(p.total_bytes) ?? number(p.total_bytes_estimate)
    return { status: 'downloading', percent: downloaded !== undefined && total ? Math.min(100, downloaded / total * 100) : undefined,
      speed: number(p.speed), eta: number(p.eta) }
  } catch { return null }
}

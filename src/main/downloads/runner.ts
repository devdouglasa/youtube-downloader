import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { LineReader } from './progress'

export class CancelledError extends Error {
  constructor() { super('Operação cancelada.'); this.name = 'CancelledError' }
}

export type RunTool = (executable: string, args: string[], signal: AbortSignal, onLine: (line: string) => void) => Promise<void>

export const runTool: RunTool = (executable, args, signal, onLine) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new CancelledError()); return }
  const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  let parseError: unknown
  let killing: Promise<void> = Promise.resolve()
  const decoder = new StringDecoder('utf8')
  const lines = new LineReader(onLine)
  const stop = (): void => {
    if (!child.pid) return
    if (process.platform === 'win32') {
      killing = new Promise<void>((done) => {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true })
        killer.once('error', () => { child.kill(); done() })
        killer.once('close', (code) => { if (code !== 0) child.kill(); done() })
      })
    } else child.kill('SIGKILL')
  }
  signal.addEventListener('abort', stop, { once: true })
  child.stdout.on('data', (chunk: Buffer) => {
    try { lines.push(decoder.write(chunk)) } catch (error) { parseError = error; stop() }
  })
  child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-16000) })
  child.once('error', (error) => { signal.removeEventListener('abort', stop); reject(error) })
  child.once('close', (code) => {
    void killing.then(() => {
      signal.removeEventListener('abort', stop)
      if (signal.aborted) { reject(new CancelledError()); return }
      if (parseError) { reject(parseError); return }
      try { lines.push(decoder.end()); lines.flush() } catch (error) { reject(error); return }
      if (code !== 0) reject(new Error(stderr.trim() || `A ferramenta encerrou com código ${code}.`))
      else resolve()
    })
  })
})

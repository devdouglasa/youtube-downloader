import { spawnSync } from 'node:child_process'
import { accessSync, constants, writeFileSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'

const directory = resolve('resources/bin')
const versions = {}
let failed = false
for (const [name, flag] of [['yt-dlp', '--version'], ['ffmpeg', '-version'], ['ffprobe', '-version'], ['deno', '--version']]) {
  const executable = process.platform === 'win32' ? `${name}.exe` : name
  const file = [directory, ...(process.env.PATH ?? '').split(delimiter).filter(Boolean)].map((folder) => join(folder, executable)).find((candidate) => {
    try { accessSync(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK); return true } catch { return false }
  })
  if (!file) { console.error(`AUSENTE: ${executable} — consulte resources/bin/README.md`); failed = true; continue }
  const result = spawnSync(file, [flag], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 15000 })
  if (result.error || result.status !== 0) { console.error(`FALHA: ${executable}`, result.error?.message ?? result.stderr); failed = true; continue }
  const version = result.stdout.split(/\r?\n/)[0]
  versions[name] = { path: file, version }
  console.log(`${name}: ${version}`)
}
if (!failed) {
  writeFileSync(join(directory, 'versions.local.json'), JSON.stringify({ checkedAt: new Date().toISOString(), tools: versions }, null, 2) + '\n')
  console.log('Ferramentas disponíveis. Versões registradas em resources/bin/versions.local.json.')
}
process.exitCode = failed ? 1 : 0

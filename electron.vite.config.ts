import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { createHash, randomBytes } from 'node:crypto'

const nonce = randomBytes(24).toString('base64')

export default defineConfig({
  main: {},
  preload: { build: { rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } } } },
  renderer: { html: { cspNonce: nonce }, plugins: [react(), {
    name: 'csp-inline-script-hashes',
    transformIndexHtml: { order: 'post', handler(html) {
      const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        .map((match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`)
      return html.replace("script-src 'self';", `script-src 'self' 'nonce-${nonce}' ${hashes.join(' ')};`)
        .replace("style-src 'self';", `style-src 'self' 'nonce-${nonce}';`)
    } }
  }] }
})

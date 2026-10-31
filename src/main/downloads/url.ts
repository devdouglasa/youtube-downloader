export function normalizeVideoUrl(input: unknown): string {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Informe uma URL válida do YouTube.')
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new Error('Informe uma URL válida do YouTube.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Use uma URL HTTPS do YouTube.')
  }
  let id: string | null = null
  if (url.hostname === 'youtu.be') {
    id = /^\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] ?? null
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else id = /^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] ?? null
  }
  if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('Informe o link de um vídeo do YouTube, não de uma playlist ou canal.')
  return `https://www.youtube.com/watch?v=${id}`
}

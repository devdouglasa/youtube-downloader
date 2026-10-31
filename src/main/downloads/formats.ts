export interface VideoFormat {
  height?: number
  ext?: string
  vcodec?: string
  acodec?: string
}

export function compatibleQualities(formats: VideoFormat[]): number[] {
  const hasAudio = formats.some((format) => format.ext === 'm4a' && format.vcodec === 'none' && format.acodec?.startsWith('mp4a'))
  return [...new Set(formats.filter((format) =>
    format.ext === 'mp4' && format.vcodec?.startsWith('avc1') &&
    (format.acodec?.startsWith('mp4a') || (format.acodec === 'none' && hasAudio)) &&
    Number.isInteger(format.height) && (format.height ?? 0) > 0
  ).map((format) => format.height!))].sort((a, b) => b - a)
}

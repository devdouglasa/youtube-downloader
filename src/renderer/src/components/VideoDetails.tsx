import type { DownloadMode, VideoInfo } from '../../../shared/contracts'

export function VideoDetails({ video, mode, quality, onQuality, disabled }: {
  video: VideoInfo; mode: DownloadMode; quality: number | 'best'; onQuality: (quality: number | 'best') => void; disabled: boolean
}) {
  const duration = video.duration === null ? 'Duração indisponível' :
    `${Math.floor(video.duration / 60)} min ${Math.floor(video.duration % 60)} s`
  return <section className="video-details" aria-label="Detalhes do vídeo">
    <div className="video-icon" aria-hidden="true">▶</div>
    <div className="video-text"><span className="eyebrow">VÍDEO ENCONTRADO</span><h2>{video.title}</h2><p>{duration}</p></div>
    {mode === 'video' ? <div className="quality"><label htmlFor="quality">Qualidade do vídeo</label>
      <select id="quality" value={quality} disabled={disabled || !video.qualities.length} onChange={(e) => onQuality(e.target.value === 'best' ? 'best' : Number(e.target.value))}>
        <option value="best">Melhor disponível</option>
        {video.qualities.map((height) => <option key={height} value={height}>Até {height}p</option>)}
      </select>
      {!video.qualities.length && <p className="availability-note">Sem vídeo compatível. Experimente apenas áudio.</p>}
    </div> : <div className="quality"><span className="eyebrow">ÁUDIO MP3</span><p className="availability-note">{video.hasAudio ? 'Melhor áudio disponível, convertido para MP3.' : 'Este vídeo não possui áudio disponível.'}</p></div>}
  </section>
}

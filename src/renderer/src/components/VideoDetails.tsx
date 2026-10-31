import type { VideoInfo } from '../../../shared/contracts'

export function VideoDetails({ video, quality, onQuality, disabled }: {
  video: VideoInfo; quality: number | 'best'; onQuality: (quality: number | 'best') => void; disabled: boolean
}) {
  const duration = video.duration === null ? 'Duração indisponível' :
    `${Math.floor(video.duration / 60)} min ${Math.floor(video.duration % 60)} s`
  return <section className="video-details" aria-label="Detalhes do vídeo">
    <div className="video-icon" aria-hidden="true">▶</div>
    <div className="video-text"><span className="eyebrow">VÍDEO ENCONTRADO</span><h2>{video.title}</h2><p>{duration}</p></div>
    <div className="quality"><label htmlFor="quality">Qualidade</label>
      <select id="quality" value={quality} disabled={disabled} onChange={(e) => onQuality(e.target.value === 'best' ? 'best' : Number(e.target.value))}>
        <option value="best">Melhor disponível</option>
        {video.qualities.map((height) => <option key={height} value={height}>Até {height}p</option>)}
      </select>
    </div>
  </section>
}

import type { DownloadEvent } from '../../../shared/contracts'

const labels = { downloading: 'Baixando seu vídeo', processing: 'Finalizando o arquivo', completed: 'Download concluído', cancelled: 'Download cancelado', error: 'Não foi possível baixar' }

export function DownloadProgress({ event, cancelling, onCancel }: { event: DownloadEvent; cancelling: boolean; onCancel: () => void }) {
  const active = event.status === 'downloading' || event.status === 'processing'
  return <section className={`progress-card ${event.status}`} aria-label="Andamento do download" aria-live="polite">
    <div className="progress-heading"><h2>{labels[event.status]}</h2>
      {active && <button type="button" className="text-button" disabled={cancelling} onClick={onCancel}>{cancelling ? 'Cancelando…' : 'Cancelar'}</button>}
    </div>
    {active && <progress max={100} value={event.status === 'downloading' ? event.percent : undefined} aria-label="Progresso do arquivo atual" />}
    <div className="progress-meta">
      {event.status === 'downloading' && <><span>{event.percent === undefined ? 'Preparando download…' : `${event.percent.toFixed(1)}% do arquivo atual`}</span>
        <span>{event.speed !== undefined ? `${(event.speed / 1024 / 1024).toFixed(1)} MB/s` : ''}{event.eta !== undefined ? ` · ${Math.ceil(event.eta)} s restantes` : ''}</span></>}
      {event.status === 'processing' && <span>{event.message ?? 'Combinando vídeo e áudio, sem perder qualidade…'}</span>}
      {!active && <span>{event.message ?? 'Seu vídeo está pronto.'}</span>}
    </div>
    {event.path && <p className="saved-path">Salvo em: {event.path}</p>}
  </section>
}

import { DownloadProgress } from './components/DownloadProgress'
import { VideoDetails } from './components/VideoDetails'
import { useDownloader } from './hooks/useDownloader'

export function App() {
  const d = useDownloader()
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-icon" aria-hidden="true">↓</span><span>downloader<span className="brand-dot">.</span></span></div><span className="local-badge"><i /> APLICATIVO LOCAL</span></header>
    <div className="intro"><span className="eyebrow">DO LINK PARA O SEU COMPUTADOR</span><h1>Seu vídeo.<br /><span>Do seu jeito.</span></h1><p>Cole um link do YouTube, escolha a qualidade e salve na sua pasta.</p></div>
    <section className="download-card" aria-label="Novo download">
      <div className="section-heading"><span className="step">01</span><h2>Qual vídeo vamos baixar?</h2></div>
      <form onSubmit={(e) => { e.preventDefault(); if (!d.busy) void d.inspect() }}>
        <label htmlFor="video-url">Link do vídeo</label>
        <div className="input-row"><input id="video-url" type="url" value={d.url} onChange={(e) => d.changeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" required disabled={d.busy} autoComplete="off" spellCheck={false} />
          <button className="secondary-button" disabled={d.busy || !d.url.trim()}>{d.inspecting ? 'Consultando…' : 'Consultar vídeo'}</button></div>
      </form>
      {d.inspecting && <div className="inspection" role="status">Buscando informações e qualidades disponíveis… <button type="button" className="text-button" disabled={d.cancelling} onClick={() => void d.cancel()}>{d.cancelling ? 'Cancelando…' : 'Cancelar'}</button></div>}
      {d.video && <VideoDetails video={d.video} quality={d.quality} onQuality={d.setQuality} disabled={d.busy} />}
      <div className="destination"><div className="section-heading"><span className="step">02</span><h2>Escolha o destino</h2></div>
        <label htmlFor="directory">Pasta no computador</label><div className="input-row"><input id="directory" value={d.directory} placeholder="Selecione uma pasta para salvar" readOnly title={d.directory} /><button type="button" className="secondary-button" disabled={d.busy} onClick={() => void d.chooseDirectory()}>Escolher pasta</button></div></div>
      <div className="download-footer"><p>MP4 · Áudio e vídeo juntos.<br /><span>Qualidade original, sem recodificação.</span></p><button type="button" className="primary-button" disabled={d.busy || !d.video || !d.directory} onClick={() => void d.start()}><span aria-hidden="true">↓</span> {d.starting ? 'Preparando…' : 'Baixar vídeo'}</button></div>
    </section>
    {d.error && <p className="error-banner" role="alert">{d.error}</p>}
    {d.event && <DownloadProgress event={d.event} cancelling={d.cancelling} onCancel={() => void d.cancel()} />}
    <footer className="app-footer"><span>UM LINK. UM DOWNLOAD. PRONTO.</span><span>Salvo diretamente no seu computador</span></footer>
  </main>
}

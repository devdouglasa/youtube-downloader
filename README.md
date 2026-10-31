# YouTube Downloader

Aplicativo desktop em português com Electron, React e TypeScript. Consulta um vídeo público do YouTube e baixa áudio e vídeo na qualidade escolhida, com progresso e cancelamento.

## Executar no Windows

1. Instale Node.js 22.18+ (ou uma versão LTS posterior compatível).
2. Na raiz do projeto, execute `npm install` (ou `npm ci` para reproduzir o lockfile).
3. Prepare os quatro executáveis seguindo [resources/bin/README.md](resources/bin/README.md). No Windows x64, você pode executar `powershell -NoProfile -File scripts/setup-tools.ps1` para baixá-los com verificação SHA256.
4. Execute `npm run tools:check`.
5. Execute `npm run dev`.

Cole uma URL HTTPS do YouTube, clique em **Consultar vídeo**, escolha a qualidade e a pasta e clique em **Baixar vídeo**. O arquivo final é sempre **MP4**: FFmpeg combina as faixas nesse contêiner ou reorganiza um arquivo único para MP4, sem recodificar áudio e vídeo. “Até 1080p” limita a resolução e “Melhor disponível” mantém a melhor qualidade disponível. Os codecs originais são preservados; o suporte à reprodução depende do player. Se não for possível gerar MP4, o aplicativo informa o erro sem salvar outro formato. O progresso é do arquivo atual: pode reiniciar quando o download passa do vídeo para o áudio. O processamento e a cópia final têm progresso indeterminado.

O nome inclui título e ID do vídeo. Arquivos existentes são preservados, com sufixos `(1)`, `(2)` etc. A gravação final não pode ser interrompida depois que começou; ao cancelar nessa etapa o app aguarda a conclusão. Fechar a janela cancela os processos ativos e aguarda a limpeza antes de encerrar.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia Electron e Vite, com atualização durante o desenvolvimento |
| `npm run typecheck` | Verifica TypeScript em modo estrito |
| `npm run lint` | Analisa o código sem reescrever arquivos |
| `npm test` | Executa testes locais, sem acesso ao YouTube |
| `npm run build` | Verifica tipos e compila para `out/` |
| `npm run preview` | Abre o aplicativo compilado; executar build antes |
| `npm run tools:check` | Verifica ferramentas e registra versões locais |
| `npm run smoke` | Abre o build compilado e verifica React, CSS, preload e IPC; fecha automaticamente |

## Arquitetura

```text
src/main/            Janela, ciclo de vida, IPC e serviços de download
src/preload/         Ponte tipada, exposta por contextBridge
src/renderer/src/    React: componentes, hook de estado e estilos
src/shared/          Contratos e canais da comunicação
resources/bin/       Executáveis locais e registro de versões
scripts/             Diagnóstico das ferramentas
tests/               Regras, processos e arquivos temporários
```

React chama apenas `window.downloader`. A API oferece `inspectVideo`, `chooseDirectory`, `startDownload`, `cancelDownload` e `onDownloadEvent`; chamadas retornam `{ ok, value }` ou `{ ok: false, error }`. Inscrições em eventos devolvem uma função de remoção. O processo principal valida URLs, qualidade, pasta escolhida e origem IPC. O preload não expõe Node.js, Electron ou IPC genérico.

O serviço permite uma operação por vez, inclusive consultas. Executa yt-dlp sem shell e ignora configurações externas, com tentativas e timeout de rede limitados. O yt-dlp usa Deno para os desafios JavaScript e FFmpeg para juntar as faixas, sem transcodificação. A janela carrega somente a interface local, com isolamento, sandbox, CSP e permissões negadas.

Cada download usa uma pasta exclusiva em `%TEMP%/youtube-downloader`. O arquivo concluído é copiado com criação exclusiva para o destino; a pasta temporária é removida antes do evento final. No Windows o cancelamento encerra a árvore de processos, incluindo FFmpeg. Falhas de limpeza ficam no terminal; se o computador ou processo for encerrado à força, podem restar temporários nesse diretório. Não há retomada após reiniciar.

## Diagnóstico e limitações

- **Ferramenta ausente:** execute `npm run tools:check`; confirme os quatro executáveis diretamente em `resources/bin` ou no PATH.
- **YouTube mudou ou erro de desafio:** atualize yt-dlp e Deno. Use o executável oficial do yt-dlp com EJS incluído. Detalhes técnicos aparecem no terminal que iniciou o app.
- **Falha de rede:** confirme a conexão e tente consultar novamente. Erros do YouTube ou bloqueios de IP podem impedir downloads mesmo com a aplicação funcionando.
- **Pasta sem permissão/disco cheio:** escolha outra pasta ou libere espaço. É necessário espaço para o temporário e a cópia final.
- **Vídeo restrito:** esta versão não usa login, cookies ou credenciais; vídeos privados, restritos ou transmissões em andamento não são suportados.

Sem instalador, fila, MP3, histórico ou atualização automática. Links com vídeo e playlist são normalizados para baixar apenas o vídeo. A compatibilidade real com o YouTube depende do vídeo e das ferramentas instaladas. Utilize conteúdo próprio ou autorizado.

## Verificação manual

Após os checks automatizados, abra `dev` e `preview` e confira:

- Consulta de uma URL `watch`, `youtu.be` e Shorts; rejeição de canal, playlist isolada e domínio parecido.
- Vídeo com áudio e vídeo separados: verificar reprodução do arquivo final e resolução escolhida.
- Pasta com espaços e acentos; baixar duas vezes preservando o primeiro arquivo.
- Cancelar durante download e combinação; verificar ausência de processos órfãos e temporários.
- Ferramenta removida, vídeo indisponível, interrupção de rede e pasta sem permissão: mensagem compreensível e possibilidade de tentar novamente.

Os testes automatizados usam processos/saídas simulados e arquivos locais; não comprovam disponibilidade de um vídeo no YouTube.

Para executar o teste opcional com YouTube e ferramentas reais no PowerShell, defina `$env:LIVE_VIDEO_URL = 'URL_HTTPS_DO_VIDEO'` e execute `npm exec vitest -- run tests/live.test.ts`. Ele baixa na menor resolução disponível, verifica áudio e vídeo com ffprobe e remove os arquivos de teste. Remova a variável com `Remove-Item Env:LIVE_VIDEO_URL` ao terminar. O teste fica desabilitado na suíte normal.

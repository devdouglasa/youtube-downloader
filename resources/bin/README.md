# Ferramentas de download

Coloque estes executáveis diretamente nesta pasta (sem subpastas):

```text
yt-dlp.exe
ffmpeg.exe
ffprobe.exe
deno.exe
```

Use fontes oficiais:

No Windows x64, `powershell -NoProfile -File scripts/setup-tools.ps1` automatiza o download para esta pasta. O script usa releases estáveis de yt-dlp e Deno e o build essentials do Gyan indicado pelo FFmpeg, verificando os checksums SHA256 publicados. Os arquivos compactados ficam em `.cache/tools`, ignorados pelo Git. O download é uma etapa explícita de preparação; não é executado pelo aplicativo.

- [yt-dlp: releases oficiais](https://github.com/yt-dlp/yt-dlp/releases) — baixe `yt-dlp.exe` para Windows x64. A distribuição oficial já inclui os scripts EJS para os desafios JavaScript do YouTube.
- [FFmpeg: downloads](https://ffmpeg.org/download.html#build-windows) — escolha um build Windows indicado pelo projeto, extraia `ffmpeg.exe` e `ffprobe.exe` da mesma distribuição.
- [Deno: releases oficiais](https://github.com/denoland/deno/releases) — extraia `deno.exe` do arquivo `deno-x86_64-pc-windows-msvc.zip`. Use uma versão estável recente (mínimo 2.3.0).

Também é possível instalá-los no PATH. Os arquivos desta pasta têm prioridade. O app passa os caminhos explicitamente ao yt-dlp; mantenha FFmpeg e ffprobe juntos. Não precisa instalar Python.

Execute `npm run tools:check` para verificar os quatro executáveis e registrar versões e caminhos reais em `versions.local.json`. Este registro e os executáveis são locais, ignorados pelo Git. `versions.example.json` descreve o formato do registro.

Atualize as ferramentas manualmente pelos mesmos canais quando o YouTube mudar. O aplicativo não baixa scripts remotos nem atualiza executáveis automaticamente. Com o app fechado, substitua os binários e execute novamente a verificação.

Documentação: [configuração EJS](https://github.com/yt-dlp/yt-dlp/wiki/EJS). Para outro sistema ou arquitetura, use os executáveis correspondentes; a validação inicial deste projeto é para Windows x64.

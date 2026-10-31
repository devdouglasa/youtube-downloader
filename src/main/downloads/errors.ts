export function userMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
  if (/EACCES|EPERM|permission denied/i.test(message)) return 'Sem permissão para gravar na pasta escolhida. Selecione outra pasta.'
  if (/ENOSPC/i.test(message)) return 'Não há espaço disponível no disco.'
  if (/ENOTFOUND|timed? ?out|network|unable to download|connection|HTTP Error (429|5\d\d)/i.test(message)) return 'Falha de conexão com o YouTube. Verifique a internet e tente novamente.'
  if (/private video|unavailable|removed|not available|sign in|confirm your age|members.only|live event/i.test(message)) return 'Vídeo indisponível ou com restrição de acesso. Esta versão aceita vídeos públicos gravados.'
  if (/ENOENT/i.test(message)) return 'Arquivo, pasta ou ferramenta não encontrado. Verifique a pasta e execute npm run tools:check.'
  if (/ERROR:|challenge|requested format/i.test(message)) return 'O yt-dlp não conseguiu obter este vídeo. Atualize as ferramentas e consulte o diagnóstico no terminal.'
  return message.slice(0, 500)
}

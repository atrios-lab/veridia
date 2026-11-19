## Why

As mensagens internas demoravam a chegar: o painel perguntava ao servidor a cada 3 ou 4 segundos se havia novidade, essas perguntas iam numa fila (uma por vez) e, com a aba em segundo plano, o navegador espaçava tudo para até uma por minuto. Também não havia "digitando…", e o som era sempre o mesmo. A conversa era no formato antigo de mensageiro, sem resposta citada, sem reação e com poucos emojis.

## What Changes

- Entrega na hora: o painel abre uma conexão que fica ligada com o servidor (Server-Sent Events) e é avisado assim que muda algo (mensagem, edição, reação, leitura), inclusive com a aba fora de vista. Sem a conexão, volta a perguntar como antes.
- "Digitando…" na conversa, na lista e na janela flutuante; some sozinho poucos segundos depois de parar e na hora do envio.
- Mensagem enviada aparece na hora na tela de quem envia (com relógio até o servidor confirmar).
- Confirmação de leitura: ✓ enviada, ✓✓ entregue, ✓✓ azul lida.
- Responder citando uma mensagem; reações com emoji, uma por pessoa por mensagem, que se desfazem sem apagar nada.
- Seletor de emojis por categoria, com os recentes primeiro, e barra de seis reações rápidas.
- Lista de conversas com a última mensagem, a hora e as não lidas; busca por pessoa ou conversa; respostas prontas.
- Sons: cada pessoa escolhe o som da mensagem e o do "Chamar atenção", ouve antes, ajusta o volume, decide se toca com a conversa aberta ou com o painel em outra aba, se repete até ler, e liga "Não perturbe". Oito sons novos, criados pelo próprio painel.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mensagens-internas`: entrega na hora, digitando, leitura, resposta citada, reações, emojis e sons por pessoa.

## Impact

- Banco (só acrescenta): `messenger_messages.reply_to_id`; em `messenger_profiles`, o "digitando" e as preferências de som; tabela nova `messenger_reactions` (sem chave estrangeira, mantida pela limpeza da demonstração). Nada é apagado.
- Rotas novas: `/admin/mensagens/eventos` (SSE) e `/admin/mensagens/digitando`.
- Telas: `mensagens/messenger.tsx`, `emoji-picker.tsx`, `sound-settings.tsx` e o vigia `messenger-watch.tsx`.

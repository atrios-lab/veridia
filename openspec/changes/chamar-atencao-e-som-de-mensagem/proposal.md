## Why

Dois pedidos sobre o chat. O atendente não ouvia a mensagem nova do cidadão quando estava com a
conversa aberta (o painel suprimia o aviso inteiro, som incluído), e a serventia quer o mesmo som
de mensagem dos dois lados. E quer "Chamar atenção" como no MSN, nos dois sentidos, para quando
há demora.

## What Changes

- **Som de nova mensagem no painel**: toca sempre que o cidadão escreve numa conversa do
  atendente, também com a conversa aberta (aí só o som, sem cartão, tremor ou notificação).
  Escolha própria, "Som de nova mensagem", padrão "Bolha de chat", o mesmo do cidadão. Fila e
  transferência seguem com o toque principal.
- **Chamar atenção, nos dois sentidos**:
  - **cidadão → cartório**: botão na janela do chat (na fila e no atendimento), liberado só
    após 10 minutos sem resposta do cartório (ou do início) e, depois, a cada 10 minutos desde o
    último chamado; o botão mostra "em X min" enquanto espera e o servidor confere a regra. Conta
    como atividade do cidadão (não deixa a conversa fechar por inatividade). No painel: toque
    próprio "Chamar atenção", tela tremendo, "Chat" piscando, cartão, notificação; vai para o
    atendente da conversa ou, na fila, para quem atende a fila.
  - **cartório → cidadão**: botão "Chamar atenção" no console da conversa, sem limite. No site:
    o chat abre, a janela treme, toca o toque próprio e o celular vibra.
  - Os dois deixam uma linha de sistema na conversa, visível para ambos.
  - Quem chama também sente: a própria tela treme. No celular, vibração onde o navegador
    oferece; nada se mexe com movimento reduzido.

## Não-objetivos

- Coluna nova no banco: o chamado é uma linha de sistema com texto fixo, que é como cada lado o
  reconhece. Nenhuma migração, nada apagado.
- Limite para o cartório, ou chamado com o chat fechado do lado do cidadão (Web Push).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `chat-alerts`: som de nova mensagem com a conversa aberta; chamar atenção nos dois sentidos.

## Impact

- `src/core/chat/nudge.ts` (novo): regra dos 10 minutos e linhas do chamado.
- `src/core/chat/alerts.ts`: `messageSound`, `soundForAlerts`, alerta `nudge`, toque "Chamar
  atenção".
- `src/lib/chat.ts`: `nudgeConversationWith`, `nudgeStateWith`, chamados no `alertSnapshotWith`.
- `src/app/api/chat/[conversationId]/route.ts`: `intent=nudge` e `nudgeAvailableAt`.
- `src/app/admin/(dashboard)/atendimento/[id]/`: `nudgeCitizenAction` e o botão no console.
- `src/app/admin/_components/chat-alerts.tsx`, `src/app/_components/shake.ts` (novo),
  `src/app/(public)/_components/chat-widget.tsx`, `alert-settings.tsx`.

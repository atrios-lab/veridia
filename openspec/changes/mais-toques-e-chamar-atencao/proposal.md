## Why

Os 5 toques dos avisos do atendimento eram poucos e baixos para um balcão com movimento, e o
aviso na tela não chamava atenção o bastante. A serventia pediu toques retrô, de mensageiro, de
celular e de chat, mais intensos, a tela tremendo e piscando com o aviso do chat, e repetição a
partir de 10 segundos.

## What Changes

- 15 toques em 4 grupos: Clássicos (Sino, Campainha, Toque duplo, Suave), Retrô (8 bits, bônus,
  fliperama), Chat e celular (Mensageiro estilo anos 2000, Celular três notas, Bolha de chat, Pop
  de mensagem) e Urgentes (Alerta, Sirene, Telefone antigo, Sonar). Todos originais,
  sintetizados no navegador; os "estilo" lembram a família sem copiar o som de nenhuma marca.
- Toques mais intensos: reforço de volume com limitador (sem distorcer), curva de volume mais
  forte e notas sustentadas; volume padrão 90%.
- "Chamar atenção": a cada aviso novo, o painel treme e "Chat" pisca na tela três vezes com o
  título e o nome. Opção "Tremer a tela e piscar Chat", ligada por padrão; desligado com
  movimento reduzido. A repetição até atender só toca, não treme.
- Repetir até atender a partir de 10 segundos (10, 15, 30, 60), padrão 10.
- **Cidadão avisado das respostas** no chat do site: toque suave ("Bolha de chat") quando o
  cartório responde, título da aba piscando "(1) Nova resposta do cartório" em segundo plano,
  botão do chat pulsando com o contador quando a janela está fechada, e notificação do navegador
  só se o cidadão pedir ("Avisar no navegador"), sem o texto da mensagem. "Som de aviso" pode ser
  desligado. A conversa segue sendo consultada com a aba em segundo plano, a cada ~12s.
- Correção: o contador de mensagens não lidas do cidadão contava de novo a mesma mensagem quando
  o cursor de tempo a devolvia; agora conta por id.

## Não-objetivos

- Copiar os sons de MSN, iPhone ou de qualquer marca.
- Arquivo de som enviado pela serventia.
- Notificação ao cidadão com o navegador fechado (Web Push).
- Banco: nada muda; preferências seguem no navegador.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `chat-alerts`: mais toques, intensidade, tremer e piscar, repetição a partir de 10s, aviso de
  resposta ao cidadão.

## Impact

- `src/core/chat/alerts.ts`: catálogo de toques com grupos e `slideTo`, preferências (`shake`,
  repetição, volume), curva de volume.
- `src/app/_components/chat-sound.ts` (movido de `admin/_components`, agora compartilhado com o
  site): reforço e limitador, deslize de frequência.
- `src/app/(public)/_components/chat-widget.tsx`: avisos de resposta ao cidadão.
- `src/app/admin/_components/chat-alerts.tsx`: tremer e piscar "Chat".
- `src/app/admin/(dashboard)/atendimento/_components/alert-settings.tsx`, `layout.tsx`,
  `globals.css`.

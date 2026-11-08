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

## Não-objetivos

- Copiar os sons de MSN, iPhone ou de qualquer marca.
- Arquivo de som enviado pela serventia.
- Banco: nada muda; preferências seguem no navegador.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `chat-alerts`: mais toques, intensidade, tremer e piscar, repetição a partir de 10s.

## Impact

- `src/core/chat/alerts.ts`: catálogo de toques com grupos e `slideTo`, preferências (`shake`,
  repetição, volume), curva de volume.
- `src/app/admin/_components/chat-sound.ts`: reforço e limitador, deslize de frequência.
- `src/app/admin/_components/chat-alerts.tsx`: tremer e piscar "Chat".
- `src/app/admin/(dashboard)/atendimento/_components/alert-settings.tsx`, `layout.tsx`,
  `globals.css`.

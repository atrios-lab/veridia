## Why

O atendente não percebe conversa nova no chat: o painel não tinha som nem notificação do
navegador (nenhum código pedia permissão, por isso ela "não aparecia" no Chrome), e a fila só se
atualizava com a própria tela de atendimento aberta e visível. Em outra aba ou outra tela do
painel, o cidadão esperava sem ninguém saber.

## What Changes

- Vigia de avisos em todas as telas do painel, para quem atende (`chat.manage`): consulta a cada
  5s, também com a aba em segundo plano.
- Avisa de: conversa nova na fila, mensagem nova do cidadão numa conversa sua, conversa
  transferida para você. "Ausente" não é chamado pela fila; as suas conversas seguem avisando.
- Formas de aviso:
  - **som**: 5 toques (Sino, Campainha, Toque duplo, Alerta, Suave) ou "Sem som", volume de 0
    a 100% e botão "Testar"; sintetizados no navegador, sem arquivo;
  - **repetir até atender**: toca de novo a cada 15, 30 ou 60s enquanto houver gente na fila;
  - **notificação do navegador**: botão "Ativar notificações" (o navegador só aceita o pedido a
    partir de um clique) e, se bloqueada, o passo a passo para liberar no Chrome;
  - **aviso piscando na tela**: cartão no canto com o pulso do item Treinamento, "Ver fila" ou
    "Abrir" e "Dispensar";
  - **título da aba piscando** enquanto o painel está em segundo plano.
- Configuração em "Avisos do atendimento", na tela de Atendimento, salva em cada navegador.
- Quando o navegador segura o som até um clique, o painel mostra "Clique aqui para ativar".

## Não-objetivos

- Notificação push com o navegador fechado (service worker e Web Push). Com a aba esquecida por
  muitos minutos, o Chrome limita a consulta a cerca de uma vez por minuto.
- Som para o cidadão no widget do site.
- Banco: nenhuma migração e nada apagado; preferências ficam no navegador.

## Capabilities

### New Capabilities

- `chat-alerts`: avisos do atendimento ao atendente.

### Modified Capabilities

Nenhuma.

## Impact

- `src/core/chat/alerts.ts`: diferença entre consultas, toques, preferências.
- `src/lib/chat.ts`: `alertSnapshotWith`.
- `src/app/admin/(dashboard)/atendimento/actions.ts`: `alertSnapshotAction`.
- `src/app/admin/_components/{chat-alerts.tsx,chat-sound.ts,chat-alert-prefs.ts}`.
- `src/app/admin/(dashboard)/atendimento/_components/alert-settings.tsx` e a tela de Atendimento.
- `src/app/admin/(dashboard)/layout.tsx`: monta o vigia.

## Why

O painel administrativo hoje só opera um canal: `/admin/pedidos` (Entrega 6). Os outros três
canais que o site público já abre — agenda de atendimento (`/agendar`), ouvidoria
(`/ouvidoria`) e requerimentos ao Encarregado de Dados (`/lgpd`) — gravam registros que ninguém
no painel consegue ver, confirmar ou responder; a serventia trata por fora do sistema, com o
agravante de que o requerimento LGPD tem prazo legal de 15 dias (Lei 13.709/2018) correndo sem
nenhum aviso. E a própria tela de chegada do painel (`/admin`) é um placeholder que só linka para
Configurações — a sidebar promete "Visão geral" desde a Entrega 4 sem nunca ter tido conteúdo.
Esta é a entrega que fecha o painel: cada canal do cidadão ganha fila + detalhe onde o operador
responde, e a Visão geral finalmente agrega os quatro.

## What Changes

- Nova rota `/admin/lgpd`: fila de requerimentos (`kind: "data-rights"`) com o prazo legal de 15
  dias visível em cada linha — destaque para "vence em N dias" e "prazo vencido há N dias" — e
  detalhe com o direito solicitado, a descrição do titular, contato e o anexo de identidade.
  Responder grava `officeReply`/`officeRepliedAt` e aceita anexo opcional de relatório de dados;
  "Salvar rascunho" grava a resposta sem concluir. A resposta chega ao titular pela consulta de
  protocolo existente (`/protocolo`), que já lê esses dois campos.
- Nova rota `/admin/ouvidoria`: fila de manifestações (`kind: "ombudsman"`) com tipo (reclamação,
  sugestão, elogio) e situação, e a distinção identificada/anônima. Detalhe com o texto da
  manifestação e os dados de contato quando existem. Responder grava `officeReply`/
  `officeRepliedAt`, disponível na consulta pelo número de registro. Quando a manifestação é
  anônima e sem contato, a tela não oferece o formulário de resposta — só um campo de anotação
  interna, deixando explícito que não há para quem responder.
- Nova rota `/admin/agenda`: fila de pedidos de horário (`kind: "appointment"`) com status
  (Pedido enviado, Confirmado, Atendido, Cancelado) e detalhe com solicitante, contato, assunto e
  a faixa pedida. Confirmar muda o status para `confirmed`. Propor outro horário reaproveita o
  mesmo seletor de faixas livres do formulário público (`appointmentOccupancy`) e grava
  `proposedDate`/`proposedSlotHour`/`proposedAt`, deixando o cidadão escolher pela consulta de
  protocolo. Cancelar e marcar como atendido cobrem o resto do ciclo.
- Rota `/admin` deixa de ser placeholder: cartões com contador por canal (pedidos de serviço,
  LGPD, ouvidoria, agenda), cada um levando à fila correspondente; lista de atividade recente dos
  quatro canais em ordem cronológica com link para cada item; bloco de prazos a acompanhar
  (requerimento LGPD perto do vencimento, exigência de pedido de serviço cumprida aguardando
  retomada).
- Sidebar do painel ganha os três itens que faltavam (Requerimentos LGPD, Ouvidoria, Agenda de
  atendimentos) com contador de itens em aberto, e "Visão geral" passa a ser um link de verdade
  em vez do destino implícito de `/admin`.
- Toda ação do operador nas três novas telas passa pelo mesmo `auditLog` já usado em
  `/admin/pedidos`, com rótulos novos em `HISTORY_LABELS` — o histórico de cada item mostra quem
  fez o quê e quando.
- `src/core/request/kinds.ts` ganha, para `appointment`, `ombudsman` e `data-rights`, o mesmo par
  `isXStatus`/`suggestedNextStatuses` que `service-request` já tem, para as telas de detalhe
  oferecerem as mesmas sugestões de próximo status.

## Non-Goals

- **Não** envia e-mail nem WhatsApp de verdade. Notificação ativa ao cidadão é entrega própria,
  já registrada como não-objetivo na Entrega 3 (`add-scheduling-lgpd-ombudsman`) — continua sendo.
  Confirmar/propor horário e responder gravam o estado que a consulta de protocolo já expõe; o
  aviso ativo por e-mail/WhatsApp citado nas histórias de usuário fica como comportamento
  documentado (a ação "avisa o cidadão pelo contato informado") sem envio real, igual ao padrão
  já aceito para o resto do produto.
- **Não** cria papel de "encarregado(a)"/DPO nem "ouvidor(a)" como login distinto. Os papéis
  continuam `admin`/`staff`; as três novas telas ficam atrás de permissões novas concedidas aos
  dois papéis existentes, como `requests.manage` já é.
- **Não** muda o formulário público nem o fluxo de consulta por protocolo dos três canais — só a
  operação do lado do painel. Qualquer ajuste na consulta pública (`/protocolo`) fica restrito ao
  necessário para expor o que o admin já grava (ex.: horário proposto), sem redesenhar a tela.
- **Não** implementa calendário nem visão de agenda por dia/semana — a fila de `/admin/agenda` é
  lista + detalhe, como o design pede; uma visão de calendário é entrega futura, se vier.
- **Não** adiciona um segundo nível de permissão dentro de cada tela (ex.: excluir só para
  `admin`) — mesmo padrão de `admin-service-requests`, uma permissão por tela.
- **Não** exclui nem arquiva registros nas três novas telas. Diferente de pedido de serviço, os
  outros canais não têm andamento "Arquivado"/exclusão no design — o ciclo termina em
  Concluído/Respondido/Atendido/Cancelado.

## Capabilities

### New Capabilities

- `admin-overview`: tela `/admin` com contadores por canal, atividade recente cronológica dos
  quatro canais e bloco de prazos a acompanhar.
- `admin-appointments`: fila e detalhe de `/admin/agenda` — confirmar, propor outro horário
  (reaproveitando as faixas livres do formulário público) e cancelar/marcar como atendido.
- `admin-ombudsman`: fila e detalhe de `/admin/ouvidoria` — responder manifestações identificadas
  e registrar anotação interna nas anônimas sem contato.
- `admin-data-rights`: fila e detalhe de `/admin/lgpd` — prazo legal de 15 dias visível, resposta
  ao titular com anexo opcional de relatório de dados, rascunho.

### Modified Capabilities

- `admin-shell`: a sidebar ganha os três itens novos com contador, e "Visão geral" passa a ser um
  destino de navegação com conteúdo — não mais um placeholder implícito de `/admin`.

## Impact

- **Rotas novas**: `src/app/admin/(dashboard)/agenda/`, `.../ouvidoria/`, `.../lgpd/` (cada uma
  com `page.tsx` de fila, `[protocolo]/page.tsx` de detalhe e `[protocolo]/actions.ts`);
  `src/app/admin/(dashboard)/page.tsx` reescrita (hoje é o placeholder da Visão geral).
- **Core**: `src/core/request/kinds.ts` ganha `isAppointmentStatus`/`suggestedNextAppointmentStatuses`
  e equivalentes para `ombudsman`/`data-rights`; reaproveita `dataRightsDeadline`/
  `dataRightsDayOfDeadline` já existentes para o prazo legal.
- **DB**: nenhuma migração — as três telas leem/escrevem `serviceRequests`/
  `serviceRequestAttachments` já existentes, filtrando por `kind`. Reaproveita `officeReply`/
  `officeRepliedAt` (já existem, já lidos pela consulta pública) e o `details` jsonb tipado por
  `parseDetails`.
- **Auth**: `src/core/auth/roles.ts` ganha permissões novas (uma por tela, ou uma permissão
  umbrella — decisão em design.md) concedidas a `admin` e `staff`.
- **UI compartilhada**: `src/app/admin/_components/nav.ts` (três entradas novas), `icon.tsx`
  (ícones novos: calendário, megafone, escudo), `[protocolo]/_components/status-badge.tsx` e
  `status-section.tsx` generalizados para os quatro `kind`s ou duplicados por canal — decisão em
  design.md.
- **Testes**: `e2e/admin-agenda.spec.ts`, `e2e/admin-ombudsman.spec.ts`, `e2e/admin-lgpd.spec.ts`
  no padrão de `e2e/admin-service-requests.spec.ts`; testes unitários node --test para os novos
  helpers de `kinds.ts`.

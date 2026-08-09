## Context

A consulta de protocolo (`src/app/(public)/protocolo/protocol-lookup.tsx`, componente `RequestDetail`) monta o bloco "Andamento" com três `TimelineStep` fixos escritos à mão: pedido recebido, requerimento assinado (recebido/aguardando) e pagamento (confirmado/aguardando, só quando há valor). O ciclo real do pedido no domínio (`src/core/request/kinds.ts`) é `new → in-review → awaiting-payment → paid → done`, com os desfechos `rejected`, `cancelled` e `archived`. O `lookupProtocolDetail` (`src/app/(public)/protocolo/actions.ts`) já retorna tudo o que os passos ausentes precisam — `deliveredDocuments` com data, `requirements` com pendência, `paymentSettled` — menos o status bruto, que hoje vira só `statusLabel`.

## Goals / Non-Goals

**Goals:**
- Timeline do pedido cobre o ciclo completo, incluindo etapa final (entregue/concluído) e desfechos negativos.
- Etapa atual sempre identificável; exigência pendente aparece como etapa "aguardando você".
- Zero mudança de banco e zero dependência nova.

**Non-Goals:**
- Timestamp por transição de status (exigiria coluna nova ou leitura do auditLog; ver Decisões).
- Mudar timelines de agendamento, LGPD e ouvidoria.
- Mudar o painel admin.

## Decisions

**1. Derivar as etapas do status bruto + dados já carregados, não do auditLog.**
O auditLog é trilha administrativa: não é lido pelo lado público hoje, exigiria join extra por consulta, e as entradas `service-request.status` gravam `targetId` errado (o valor do status, não o id — bug à parte, já sinalizado). Alternativa rejeitada: nova tabela de eventos — é migração e escrita nova em todos os pontos de mudança de status, para um ganho que se resume a datas em etapas intermediárias.

**2. Expor `status: ServiceRequestStatus` no `ServiceRequestDetail`.**
O componente precisa distinguir `paid` de `done` de `rejected`; o rótulo não serve para lógica. Um campo, tipado pelo union já existente no core.

**3. A sequência de etapas é uma lista derivada em função pura no componente, não JSX condicional empilhado.**
O JSX atual com ternários já é difícil de estender; com 6+ etapas condicionais ficaria ilegível. Uma função `timelineSteps(result, hasSignedForm): Step[]` (no próprio arquivo, sem módulo novo) devolve `{ label, done, detail?, alert? }[]` e o JSX vira um `map`. Regras:
- `Pedido recebido` — sempre, `done`, data `createdAt`.
- `Requerimento assinado recebido` / `Aguardando requerimento assinado` — como hoje (estado local `hasSignedForm` continua valendo, para o upload na mesma visita refletir na hora).
- `Exigência aguardando sua resposta` — só se houver requirement `pending`; detail aponta para o cartão de exigências ("responda no cartão de exigências").
- `Pagamento confirmado` / `Aguardando pagamento` — só quando `amountLabel` existe, como hoje.
- `Em preparo na serventia` — quando o pedido passou do pagamento (status `paid`, ou `in-review`/`new` sem valor cobrado) e ainda não terminou; sem data.
- `Documento entregue` — `done` quando `deliveredDocuments` não vazio (data da primeira entrega) ou status `done`; caso contrário aparece como etapa futura (`Conclusão e entrega`).
- `rejected`/`cancelled`: as etapas ainda não cumpridas são substituídas por uma única etapa final `Pedido indeferido`/`Pedido cancelado` com estilo de alerta; as já cumpridas permanecem. `archived` após `done` conta como concluído.

**4. Datas só onde há registro real.**
`createdAt`, `signedFormReceivedAt` e `deliveredDocuments[0].createdAt` têm timestamp verdadeiro; etapas derivadas só de status ficam sem detail de data. `updatedAt` não é usado como data de etapa — mente sempre que qualquer outro campo do registro muda.

**5. `TimelineStep` ganha uma variante de alerta.**
Para indeferido/cancelado o ponto e o rótulo usam `brand-alert`. Prop nova opcional (`alert?: boolean`), sem componente novo.

## Risks / Trade-offs

- [Etapas sem data podem parecer incompletas] → é fiel ao que o sistema sabe; inventar data via `updatedAt` seria pior. Se datas por transição virarem requisito, a evolução é coluna/tabela de eventos em mudança própria.
- [`in-review` sem valor cobrado cai em "Em preparo na serventia" antes do pagamento existir] → aceito: para o cidadão "em preparo" é exatamente o que está acontecendo; quando o valor for definido, a etapa de pagamento passa a existir na consulta seguinte.
- [Ordem visual fixa vs. ordem real dos fatos (ex.: pagamento antes do requerimento)] → a timeline é checklist de etapas, não diário cronológico; a ordem canônica do ciclo é mais legível para o leigo do que reordenar por timestamp.

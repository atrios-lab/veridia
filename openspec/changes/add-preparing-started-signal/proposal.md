## Why

Na consulta pública de protocolo, a etapa "Em preparo na serventia" da linha do tempo (`Andamento`) usa o mesmo estilo visual — ponto cinza vazado, texto apagado — de uma etapa futura que ainda nem começou. Um pedido "Pago" fica exatamente nesse estado até ser concluído ou receber documento entregue, então o cidadão não tem como distinguir "a serventia está preparando agora" de "isso ainda nem foi tocado". A mudança anterior (`improve-protocol-timeline`, ainda não arquivada) já pretendia que "a etapa atual" fosse identificável — o design chegou a listar isso como meta — mas o `TimelineStep` público só ganhou uma variante `done`/`alert`, nunca um estado "current" distinto; a etapa atual acaba com a aparência de qualquer etapa futura.

O painel admin já resolveu esse exato problema: `status-section.tsx` tem um `TimelineStep` com três estados (`done` / `current` / `upcoming`), o "current" desenhado como anel de destaque com ponto branco. Esta proposta é replicar esse padrão já existente no `TimelineStep` público, sem coluna nova no banco nem passo manual para o operador.

## What Changes

- O `TimelineStep` da consulta pública (`src/app/(public)/protocolo/protocol-lookup.tsx`) ganha uma variante visual "current" (etapa em andamento agora), distinta de `done` (concluída) e do estado apagado de etapa futura — mesma ideia do `TimelineStep` do admin, sem componente novo.
- `timelineSteps()` passa a marcar qual etapa é a atual: a primeira etapa ainda não `done` da lista, quando o pedido está em andamento aberto (não é desfecho final nem etapa aguardando o cidadão, que já têm destaque próprio).
- Nenhuma mudança nos dados retornados pela consulta (`lookupProtocolDetail`), no schema do banco, ou no painel admin: é só o desenho da etapa que já existe.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: a etapa atual da linha do tempo pública passa a ser visualmente distinta de uma etapa futura, não só posicionalmente. (Depende da capability já proposta por `improve-protocol-timeline`, ainda não arquivada — ver Impact.)

## Non-goals

- Nenhuma data/timestamp de "quando começou a preparar": continua sem coluna nova e sem leitura do `auditLog` — mesma decisão do `improve-protocol-timeline`, só o destaque visual muda.
- Nenhum botão ou ação manual no admin: o "current" é derivado do mesmo status que a timeline já lê hoje.
- Timelines de agendamento, LGPD e ouvidoria não mudam.
- O `TimelineStep` do admin não muda — só o público ganha o padrão que o admin já tem.

## Impact

- `src/app/(public)/protocolo/protocol-lookup.tsx` — `TimelineStep` ganha estado `current`; `timelineSteps()` marca a etapa atual.
- `e2e/service-request.spec.ts` — cobertura do estado visual "current" na etapa "Em preparo na serventia".
- Depende da capability `service-request` proposta por `openspec/changes/improve-protocol-timeline` (ainda não arquivada, mas já implementada no código). Este change assume essa base; se `improve-protocol-timeline` for arquivado antes, o delta aqui se aplica normalmente sobre o spec principal.

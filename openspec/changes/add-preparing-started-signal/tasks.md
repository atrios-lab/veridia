## 1. Estado visual "current" no `TimelineStep` público

- [x] 1.1 Adicionar a prop opcional `current?: boolean` ao `TimelineStep` em `src/app/(public)/protocolo/protocol-lookup.tsx`, com o desenho de anel-com-ponto (classes `brand-accent`), distinto de `done` e do estilo apagado padrão
- [x] 1.2 Adicionar `current` a `TimelineStepData`

## 2. Derivar a etapa atual em `timelineSteps()`

- [x] 2.1 Após montar a lista de etapas, marcar `current: true` na primeira etapa com `done` falso e `alert` falso — nenhuma etapa recebe o destaque quando não há etapa `!done` (tudo concluído) ou quando a lista termina em etapa de alerta sem etapa `!done` anterior
- [x] 2.2 Repassar `current` ao `TimelineStep` no `map` do bloco "Andamento"

## 3. Verificação

- [x] 3.1 Estender `e2e/service-request.spec.ts` cobrindo: pedido pago em preparo (destaque "current" em "Em preparo na serventia", "Conclusão e entrega" sem destaque), exigência pendente com destaque "current", pedido indeferido/cancelado sem etapa "current"
- [x] 3.2 Rodar Biome, tsc e a suíte e2e afetada

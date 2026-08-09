## 1. Expor o status bruto na consulta

- [x] 1.1 Adicionar `status: ServiceRequestStatus` a `ServiceRequestDetail` em `src/app/(public)/protocolo/actions.ts` e preenchê-lo no retorno de `lookupProtocolDetail`

## 2. Derivar a linha do tempo

- [x] 2.1 Criar a função pura `timelineSteps(result, hasSignedForm)` em `src/app/(public)/protocolo/protocol-lookup.tsx` devolvendo `{ label, done, detail?, alert? }[]` conforme as regras do design (recebido, requerimento, exigência pendente, pagamento condicional, em preparo, entrega/conclusão, desfechos negativos)
- [x] 2.2 Adicionar a prop opcional `alert` ao `TimelineStep` (ponto e rótulo em `brand-alert`)
- [x] 2.3 Substituir o JSX fixo do bloco "Andamento" do `RequestDetail` por um `map` sobre `timelineSteps`, mantendo o `lineBelow` em todas as etapas menos a última

## 3. Verificação

- [x] 3.1 Estender `e2e/service-request.spec.ts` cobrindo: pedido pago em preparo (etapa atual "Em preparo na serventia"), documento entregue (etapa final concluída com data) e pedido indeferido/cancelado (etapa final de alerta substituindo as restantes)
- [x] 3.2 Rodar Biome, tsc e a suíte e2e afetada

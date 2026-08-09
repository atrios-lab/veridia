## Why

A linha do tempo ("Andamento") da consulta de protocolo de um pedido de serviço mostra só três passos fixos — pedido recebido, requerimento assinado e pagamento — e ignora o resto do ciclo de vida. Um pedido "Pago" com documento já entregue aparece com a timeline parada em "Pagamento confirmado", sem data e sem etapa final; exigências pendentes e desfechos como "Indeferido" ou "Cancelado" nunca aparecem. O cidadão não consegue responder à pergunta que o levou à consulta: "em que pé está o meu pedido, e falta o quê?".

## What Changes

- A timeline do pedido de serviço passa a derivar as etapas do status real (`new → in-review → awaiting-payment → paid → done`) e dos eventos que a consulta já retorna, cobrindo o ciclo completo:
  - **Pedido recebido** (data de criação) — como hoje.
  - **Requerimento assinado recebido / aguardando** — como hoje.
  - **Exigência aguardando sua resposta** — nova etapa, exibida enquanto houver exigência pendente, apontando para o cartão de exigências.
  - **Pagamento confirmado / aguardando** — como hoje, exibida só quando há valor.
  - **Em preparo na serventia** — nova etapa, ativa quando o pedido está pago (ou em análise sem valor) e ainda não concluído.
  - **Documento entregue / Concluído** — nova etapa final, com a data da primeira entrega quando existir.
- Desfechos negativos viram etapa final própria: **Pedido indeferido** ou **Pedido cancelado** substituem as etapas restantes, para a timeline nunca sugerir um andamento que não vai acontecer.
- A consulta (`lookupProtocolDetail`) passa a expor o status bruto do pedido ao componente, que hoje só recebe o rótulo.
- Datas aparecem apenas onde existe registro real (criação, requerimento, entrega); etapas derivadas só de status não ganham data inventada.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: a consulta de protocolo passa a exigir que a linha do tempo reflita o ciclo completo do pedido — etapas concluídas, etapa atual, exigências pendentes e desfecho (entregue, indeferido ou cancelado) — em linguagem do cidadão.

## Non-goals

- Nenhuma migração de banco: não vamos gravar timestamp por transição de status. Etapas derivadas de status ficam sem data.
- Não usar o `auditLog` como fonte da timeline do cidadão (é trilha administrativa, e as entradas de status hoje nem casam com o pedido).
- Timelines dos outros tipos (agendamento, LGPD, ouvidoria) não mudam — já refletem os eventos dos seus ciclos.
- Nenhuma mudança no painel admin nem em notificações.

## Impact

- `src/app/(public)/protocolo/actions.ts` — `ServiceRequestDetail` ganha o status bruto do pedido.
- `src/app/(public)/protocolo/protocol-lookup.tsx` — bloco "Andamento" do `RequestDetail` reescrito para derivar as etapas; `TimelineStep` já suporta o necessário.
- `e2e/service-request.spec.ts` — cobertura da timeline nos estados novos.
- Sem dependências novas, sem mudança de schema.

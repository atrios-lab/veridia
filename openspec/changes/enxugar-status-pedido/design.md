## Context

`ServiceRequestStatus` (`src/core/request/kinds.ts`) tem hoje vinte valores. Uma exploração
percorreu os vinte, um a um, checando onde cada um tem código próprio (regra de negócio, e-mail,
prazo) e onde é só rótulo escolhido manualmente pelo operador, sem nenhum efeito. Chegou-se a
onze valores finais. Este design cobre como sair de vinte para onze sem quebrar protocolo já
gravado nem as poucas regras que de fato dependem de um status específico.

O andamento é uma coluna de texto livre (`service_requests.status`), compartilhada pelas quatro
naturezas de pedido (`RequestKind`); não há enum de banco. Isso simplifica a migração: é `UPDATE`
de dado, não alteração de schema, e o princípio de "migração destrutiva exige dois deploys" do
projeto não se aplica aqui — não há coluna, tipo ou tabela sendo removida.

## Goals / Non-Goals

**Goals:**
- Reduzir `SERVICE_REQUEST_STATUSES` de vinte para os onze valores decididos na exploração.
- Manter todo protocolo já gravado com um andamento válido depois do deploy.
- Simplificar `statusForRequirements`, `SUGGESTED_NEXT_STATUSES`, `SERVICE_REQUEST_PHASES` e
  `STATUS_TONES` para os onze valores, sem herdar cor ou fase por omissão.
- Identificar e resolver o código que hoje depende dos nove valores removidos
  (`listStalledFulfilledRequirements`, a condição "preparing" da consulta pública, o `HAPPY_PATH`
  do detalhe).

**Non-Goals:**
- Não muda `payment-reported`, `rejected` ou `cancelled`.
- Não resolve a consulta pública do cidadão não saber o que fazer com `ready-for-pickup` — fica
  para outra change.
- Não afeta `OmbudsmanStatus`, `AppointmentDetails`/status de agendamento nem os status de LGPD:
  são tipos próprios, só coincidem em algumas strings (`new`, `in-review`, `done`) por acaso.
- Não decide, por si, se as seis fases da fila (`SERVICE_REQUEST_PHASES`) continuam em seis nomes
  agora que "Entrada" e "Análise" ficam com um único andamento cada — ver Open Questions.

## Decisions

### Mapa de migração (valor antigo → valor novo)

| Antigo | Novo |
|---|---|
| `filed` | `new` |
| `in-review` | `processing` |
| `pre-noted` | `processing` |
| `in-qualification` | `processing` |
| `registered` | `processing` |
| `annotated` | `processing` |
| `granted` | `processing` |
| `with-requirement` | `awaiting-compliance` |
| `inactive` | `archived` |

Todo protocolo gravado num desses nove valores recebe o valor novo via `UPDATE`, antes do código
que não reconhece mais o valor antigo entrar em produção. `filed` vai para `new` (não para
`processing`) porque, olhando o uso real, `filed` nunca chegou a significar "a serventia já
começou a trabalhar" — era só a forma de registrar que o pedido veio do balcão, papel equivalente
ao que `details.channel` já cobre.

### `statusForRequirements` simplificado

Hoje o retorno automático ao cumprir a última exigência aterrissa em `in-qualification`, e
`with-requirement`/`awaiting-compliance` são duas origens válidas de limpeza. Com a fusão, fica:

```ts
export function statusForRequirements(
  from: ServiceRequestStatus,
  pendingRequirements: number,
): ServiceRequestStatus | null {
  if (!isOpenServiceRequestStatus(from)) return null;
  if (pendingRequirements > 0) {
    return from === "awaiting-compliance" ? null : "awaiting-compliance";
  }
  return from === "awaiting-compliance" ? "processing" : null;
}
```

### `SUGGESTED_NEXT_STATUSES` reescrito para os onze

```ts
new: ["processing", "awaiting-payment", "cancelled"],
"awaiting-payment": ["paid", "cancelled"],
"payment-reported": ["paid", "awaiting-payment", "cancelled"],
paid: ["processing", "done"],
"awaiting-compliance": ["processing", "cancelled"],
processing: ["ready-for-pickup", "done"],
"ready-for-pickup": ["done", "archived"],
done: ["archived"],
rejected: ["archived"],
cancelled: ["processing", "archived"],
archived: [],
```

`cancelled` sugeria voltar para `in-review` (reabrir um cancelamento por engano, retomando a
análise); sem `in-review`, o destino equivalente passa a ser `processing`, o único andamento
genérico de "a serventia está trabalhando nisso".

### Fases e cor: recalculadas, não redesenhadas

`SERVICE_REQUEST_PHASES` mantém os seis nomes (Entrada, Análise, Pagamento, Processamento,
Entrega, Encerrado) e só recalcula a lista de andamentos de cada uma:

```
intake:     [new]
analysis:   [awaiting-compliance]
payment:    [awaiting-payment, payment-reported, paid]
processing: [processing]
delivery:   [ready-for-pickup]
closed:     [done, rejected, cancelled, archived]
```

`STATUS_TONES` perde as nove entradas dos valores removidos; nenhum dos onze sobreviventes muda
de tom (todos já compartilhavam cor com o valor que os absorveu).

### `inactive` some, a ação em lote fica

A ação de marcar protocolos como inativos (checkbox + ação em lote na fila, proposta em
`bulk-protocol-inactivation`) continua existindo; só o valor gravado muda de `inactive` para
`archived`. Isso exige revisar `bulk-protocol-inactivation` antes dela ser arquivada: sua
proposal.md, design.md, tasks.md e a delta spec em
`openspec/changes/bulk-protocol-inactivation/specs/admin-service-requests/spec.md` hoje descrevem
`inactive` como andamento próprio.

### `listStalledFulfilledRequirements` removida, não generalizada

Achado durante a implementação: essa função não é código morto — alimenta
`hasFulfilledPendingRequirement`, que é o que faz a mesa de trabalho (`desk.ts`, tier 2) mostrar
"Exigência cumprida pelo cidadão, aguardando retomada da análise". O único jeito de o pedido chegar
lá é uma correção manual do operador de volta para `in-review` depois do retorno automático de
`reconcileRequirementStatus` já ter agido — um caso raro, mas real.

Cogitou-se generalizar o filtro de `status = "in-review"` para "qualquer andamento aberto" em vez
de apagar a função, preservando a feature. Decisão final, depois de pesar as duas: remover mesmo,
como a task original previa — aceitando perder o card da mesa para esse caso raro específico
(correção manual + exigência já cumprida) em troca de não carregar um mecanismo extra só para ele.
`hasFulfilledPendingRequirement` em `DeskRecord` fica `false` sempre, comentado como tal; o tipo,
`desk.ts` e os testes de `desk.test.ts` continuam de pé, porque a lógica de priorização em si
(tier 2, se algum dia alguém voltar a alimentar a flag) segue correta — só deixou de ter uma fonte
de dado real.

## Risks / Trade-offs

- [Protocolo gravado num valor removido chega em produção antes do `UPDATE` rodar] → a migração
  de dado roda como parte do pipeline que já aplica migrations antes do build (commit `c946b35`);
  sequenciar o `UPDATE` como uma migration nomeada, não como script solto.
- [`bulk-protocol-inactivation` é arquivada com `inactive` antes desta change revisar seus
  artefatos] → tratar como tarefa explícita desta change: revisar aquela change primeiro, ou
  coordenar qual das duas fecha primeiro.
- [Remover `listStalledFulfilledRequirements` esconde um caso real que ainda acontece] → se
  aparecer depois do deploy, o sintoma é "pedido com exigência cumprida sem ninguém retomando", o
  que é visível na própria fila (`hasFulfilledPendingRequirement` do `desk.ts`, mecanismo
  diferente e que continua de pé) — não é uma perda silenciosa.
- [Perda de granularidade que algum operador use sem eu ter mapeado] → risco aceito
  deliberadamente pelo usuário, status a status, durante a exploração; não é uma omissão.

## Migration Plan

1. Migration de dado (`UPDATE service_requests SET status = ... WHERE status IN (...)`) para os
   nove valores do mapa acima, escrita como migration Drizzle normal.
2. No mesmo deploy (migrations já correm antes do build): atualizar `kinds.ts`,
   `status-tone.ts`, `status-section.tsx` (`HAPPY_PATH`), `admin-overview.ts` (remover
   `listStalledFulfilledRequirements` e seu uso) e `protocol-lookup.tsx` (condição "preparing").
3. Revisar `bulk-protocol-inactivation` (proposal/design/tasks/delta spec) para gravar `archived`
   em vez de propor `inactive`, antes dela ser arquivada.
4. Rollback: se necessário, a migration inversa (re-mapear os nove valores novos para os antigos
   correspondentes onde ainda for possível identificar a origem) — na prática, só relevante se o
   deploy do código for revertido antes do próximo, já que o dado antigo não é destruído, só
   reescrito.

## Open Questions

- As fases "Entrada" (`new`) e "Análise" (`awaiting-compliance`) ficam cada uma com um único
  andamento depois do corte. Vale colapsar as duas num só grupo na fila, ou manter os seis nomes
  como documentação da forma pretendida do processo mesmo com grupos de um membro? Fica para quem
  implementar decidir, ou para uma change de UI própria.
- Qual das duas changes (`enxugar-status-pedido` ou `bulk-protocol-inactivation`) arquiva
  primeiro? Este design assume que a segunda é revisada antes de arquivar, mas a ordem cronológica
  de implementação pode ser invertida se for mais simples corrigir `inactive` → `archived` depois.

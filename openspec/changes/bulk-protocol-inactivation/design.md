## Context

Hoje a única forma de tirar um protocolo do fluxo é trocar o andamento (um a um, pelo detalhe) ou excluí-lo de verdade (`DangerSection` → `deleteRequestAction` → `deleteRequest`), reservado a erro de lançamento. Não existe seleção múltipla em nenhuma tela do admin. `service_requests.status` é uma coluna `text` livre (não é enum de banco): `SERVICE_REQUEST_STATUSES` em `src/core/request/kinds.ts` é a lista fechada que o código valida.

## Goals / Non-Goals

**Goals:**
- Operador consegue selecionar vários protocolos na fila e marcá-los como `inactive` em uma ação só.
- `inactive` é reversível: o registro e o histórico continuam intactos, e o operador pode voltar o andamento pelo detalhe como já faz hoje com qualquer outro status.
- `inactive` conta como não-aberto (não infla o contador "em aberto" da sidebar).

**Non-Goals:**
- Exclusão em lote (hard delete) — fora de escopo; a ação em lote só inativa.
- Reativação em lote — reativar é um a um, reusando a troca de andamento já existente.
- Novo endpoint HTTP público ou mudança no site do cidadão.
- Migração de banco — `status` já aceita qualquer texto validado em código.

## Decisions

**Novo status `inactive`, não uma coluna/flag separada.**
Reaproveita toda a infraestrutura de andamento que já existe (histórico de eventos, rótulo, tom visual, contador de abertos, filtro da fila) em vez de criar um conceito paralelo (`isDeleted`/`archivedAt`). Alternativa considerada: coluna booleana `inactive` além do `status`. Rejeitada porque duplicaria a lógica de "o que conta como aberto" e criaria um segundo eixo de estado para cada tela já entender.

**`inactive` entra em `TERMINAL_SERVICE_REQUEST_STATUSES`.**
Consequência direta de reusar `isOpenServiceRequestStatus`: um protocolo inativo não deve contar no badge da sidebar. Mesmo raciocínio de `cancelled` hoje.

**Transição segue a regra livre já existente (`isAllowedTransition`: só recusa `from === to`).**
`inactive` não precisa de caso especial — nem para entrar, nem para sair. Isso já cobre a reativação (voltar de `inactive` para qualquer outro andamento pelo detalhe) sem código novo em `isAllowedTransition`.

**Ação em lote é uma Server Action nova, não N chamadas de `updateServiceRequestStatus`.**
`updateServiceRequestStatus` (nome ilustrativo do que já existe em `src/lib/service-request.ts`) grava um evento de histórico por chamada; a ação em lote SHALL envolver as N atualizações numa única transação de banco, gravando um evento de histórico por protocolo (mesma leitura do histórico de cada um) mas validando a serventia da sessão e a permissão uma única vez. Alternativa considerada: reusar a função existente em loop no client. Rejeitada — client não deve orquestrar N server actions (sem atomicidade, sem forma simples de reportar falha parcial) e a regra de negócio (validação de transição, permissão) pertence ao núcleo, não ao componente.

**Seleção é estado local de UI (`useState` no client component da fila), sem persistência.**
Não há necessidade de lembrar seleção entre navegações ou sessões. Checkbox por linha + "selecionar todos (desta página)" no cabeçalho, como qualquer tabela com bulk action.

**Fila não esconde `inactive` por padrão.**
Consistente com o comportamento atual (nenhum status é escondido sem filtro explícito hoje). `inactive` ganha um tom visual próprio (cinza/neutro, distinto de `cancelled`/`archived`) e aparece nas opções do filtro de andamento, para o operador poder isolá-lo ou excluí-lo da visão quando quiser.

## Risks / Trade-offs

- [Operador seleciona protocolos e não percebe que a ação é reversível apenas manualmente, um a um] → Diálogo de confirmação declara explicitamente "os dados não são apagados; para reativar, altere o andamento no detalhe do protocolo".
- [Ação em lote falha no meio (ex.: um protocolo já mudou de andamento por outra aba)] → Toda a operação roda em uma transação; se qualquer atualização falhar, nada é aplicado e o operador vê o erro.
- [Novo status esquecido em algum mapa auxiliar de `kinds.ts` (`STATUS_TONES`, `SUGGESTED_NEXT_STATUSES`, `STATUS_LABELS`)] → Coberto por teste que itera `SERVICE_REQUEST_STATUSES` e garante que todo mapa Record-por-status tem uma entrada para cada valor (mesmo padrão que já existe para `phaseOfStatus`).

## Migration Plan

Sem migração de banco. Deploy único: adicionar `inactive` ao core, UI da fila e ação em lote juntos. Nada consome o valor antes de existir, então não há janela de inconsistência.

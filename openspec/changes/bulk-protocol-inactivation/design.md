## Context

Hoje a única forma de tirar um protocolo do fluxo é trocar o andamento (um a um, pelo detalhe) ou excluí-lo de verdade (`DangerSection` → `deleteRequestAction` → `deleteRequest`), reservado a erro de lançamento. Não existe seleção múltipla em nenhuma tela do admin. `service_requests.status` é uma coluna `text` livre (não é enum de banco): `SERVICE_REQUEST_STATUSES` em `src/core/request/kinds.ts` é a lista fechada que o código valida.

## Goals / Non-Goals

**Goals:**
- Operador consegue selecionar vários protocolos na fila e arquivá-los (`archived`) em uma ação só.
- A ação é reversível: o registro e o histórico continuam intactos, e o operador pode voltar o andamento pelo detalhe como já faz hoje com qualquer outro status.
- `archived` já conta como não-aberto (não infla o contador "em aberto" da sidebar) — nenhuma mudança precisa nesse contador.

**Non-Goals:**
- Exclusão em lote (hard delete) — fora de escopo; a ação em lote só arquiva.
- Reativação em lote — reativar é um a um, reusando a troca de andamento já existente.
- Novo endpoint HTTP público ou mudança no site do cidadão.
- Migração de banco — `status` já aceita qualquer texto validado em código, e `archived` já é um dos valores validados.

## Decisions

**Reaproveitar o andamento `archived` já existente, não introduzir um valor novo.**
Revisão desta decisão (change `enxugar-status-pedido`): a versão original deste design propunha um status `inactive` próprio, pela mesma razão de sempre (reusar a infraestrutura de andamento em vez de um conceito paralelo como `isDeleted`/`archivedAt`). Ao auditar os vinte andamentos, nenhuma regra distinguia "tirado de circulação pelo operador em lote" de "arquivado" — os dois já eram o mesmo tom, a mesma fase, o mesmo grupo de terminais. Ter dois nomes para a mesma coisa era o próprio problema que aquela change resolveu; `archived` cobre esta ação em lote sem precisar de irmão.

**Transição segue a regra livre já existente (`isAllowedTransition`: só recusa `from === to`).**
Nada muda aqui: mover para `archived` (em lote ou um a um) e voltar dele para qualquer outro andamento pelo detalhe já funcionava antes desta change existir, sem caso especial.

**Ação em lote é uma Server Action nova, não N chamadas de `updateServiceRequestStatus`.**
`updateServiceRequestStatus` (nome ilustrativo do que já existe em `src/lib/service-request.ts`) grava um evento de histórico por chamada; a ação em lote SHALL envolver as N atualizações numa única transação de banco, gravando um evento de histórico por protocolo (mesma leitura do histórico de cada um) mas validando a serventia da sessão e a permissão uma única vez. Alternativa considerada: reusar a função existente em loop no client. Rejeitada — client não deve orquestrar N server actions (sem atomicidade, sem forma simples de reportar falha parcial) e a regra de negócio (validação de transição, permissão) pertence ao núcleo, não ao componente.

**Seleção é estado local de UI (`useState` no client component da fila), sem persistência.**
Não há necessidade de lembrar seleção entre navegações ou sessões. Checkbox por linha + "selecionar todos (desta página)" no cabeçalho, como qualquer tabela com bulk action.

**Fila não esconde `archived` por padrão.**
Consistente com o comportamento atual (nenhum status é escondido sem filtro explícito hoje). Como `archived` já existia antes desta ação em lote, ela não precisa de tom visual novo nem de entrada nova no filtro de andamento — usa o que já está lá.

## Risks / Trade-offs

- [Operador seleciona protocolos e não percebe que a ação é reversível apenas manualmente, um a um] → Diálogo de confirmação declara explicitamente "os dados não são apagados; para reativar, altere o andamento no detalhe do protocolo".
- [Ação em lote falha no meio (ex.: um protocolo já mudou de andamento por outra aba)] → Toda a operação roda em uma transação; se qualquer atualização falhar, nada é aplicado e o operador vê o erro.

## Migration Plan

Sem migração de banco própria desta change. Deploy único: UI da fila e ação em lote, gravando `archived`. Depende só da ordem em relação a `enxugar-status-pedido`: se aquela migração (que remapeia qualquer linha já gravada como `inactive` para `archived`) ainda não rodou quando esta ação em lote for usada, o resultado é o mesmo de qualquer forma — `archived` sempre foi um valor válido, então não há janela de inconsistência.

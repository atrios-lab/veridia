## Why

Hoje, remover um protocolo em massa não existe: a única ação de remoção é a exclusão definitiva, um a um, pela tela de detalhe do protocolo (`DangerSection`), reservada a pedidos abertos por engano. Quando um operador precisa "limpar" muitos protocolos de uma vez (ex.: testes, pedidos duplicados, entradas indevidas), não há como fazer isso em lote nem sem apagar os dados de verdade.

## What Changes

- Adicionar seleção múltipla na fila de pedidos (`/admin/pedidos`): checkbox por linha + checkbox "selecionar todos" no cabeçalho.
- Adicionar uma ação em lote "Arquivar" para os protocolos selecionados, com diálogo de confirmação informando a quantidade e que a ação não apaga os dados — move os protocolos para o andamento "Arquivado" (`archived`) já existente, não para um status novo.
- Reativação continua possível pela troca de status já existente na tela de detalhe do protocolo (um a um), sem nova ação dedicada.

**Revisão (change `enxugar-status-pedido`):** a versão original desta proposta criava um status
`inactive` ("Inativo") próprio. A auditoria dos vinte andamentos feita por aquela change não achou
nenhuma regra que distinguisse "tirado de circulação pelo operador em lote" de "arquivado" — os
dois já paravam no mesmo tom visual, na mesma fase e no mesmo grupo de terminais. `inactive` saiu
do enum; a ação em lote passou a gravar `archived`, que já cobria exatamente o que ela precisava
(terminal, reversível manualmente pela troca de andamento, sem exclusão).

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
(nenhuma) — a fila ganha seleção múltipla e ação em lote, mas o andamento que ela grava
(`archived`) já é terminal na spec atual de `admin-service-requests`; nenhum requisito existente
muda de comportamento.

## Impact

- `src/app/admin/(dashboard)/pedidos/page.tsx` e componentes da fila (`queue-rows.tsx`): checkboxes de seleção, barra de ação em lote ("Arquivar").
- `src/lib/service-request.ts`: `deactivateServiceRequests`, a função de atualização em lote (reaproveitando a validação de transição existente), grava `archived`.
- Nenhuma mudança em `src/core/request/kinds.ts` nem em `status-tone.ts`: `archived` já existe, com tom e regras próprias, desde antes desta change.
- Nenhuma migração de banco: `status` já é `text` livre, e `archived` já é um valor válido.

## Não-objetivos

- Não há exclusão em lote (hard delete) — a ação em lote só arquiva.
- Não há reativação em lote — reativar continua sendo um a um, pela tela de detalhe já existente.
- Não há novo endpoint/API pública; a ação em lote é uma Server Action do painel admin.
- Não há alteração no fluxo do cidadão (site público) nem no acompanhamento de protocolo por ele.
- Não introduz um andamento novo nem um tom visual novo — usa o `archived` que já existia.

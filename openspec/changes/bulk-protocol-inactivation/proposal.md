## Why

Hoje, remover um protocolo em massa não existe: a única ação de remoção é a exclusão definitiva, um a um, pela tela de detalhe do protocolo (`DangerSection`), reservada a pedidos abertos por engano. Quando um operador precisa "limpar" muitos protocolos de uma vez (ex.: testes, pedidos duplicados, entradas indevidas), não há como fazer isso em lote nem sem apagar os dados de verdade.

## What Changes

- Adicionar um novo status de protocolo, `inactive` ("Inativo"), que não é exclusão: o registro e seu histórico continuam existindo, apenas saem do fluxo normal de atendimento.
- Adicionar seleção múltipla na fila de pedidos (`/admin/pedidos`): checkbox por linha + checkbox "selecionar todos" no cabeçalho.
- Adicionar uma ação em lote "Marcar como inativo" para os protocolos selecionados, com diálogo de confirmação informando a quantidade e que a ação não apaga os dados.
- `inactive` entra no conjunto de status terminais (`TERMINAL_SERVICE_REQUEST_STATUSES`) e é tratado como não-aberto no contador de pedidos abertos.
- A fila continua listando protocolos `inactive` por padrão (mesmo comportamento atual: nada é escondido sem filtro explícito), com tom visual próprio e um filtro de andamento para isolá-los ou excluí-los da visão.
- Reativação continua possível pela troca de status já existente na tela de detalhe do protocolo (um a um), sem nova ação dedicada.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `admin-service-requests`: fila ganha seleção múltipla e ação em lote de inativação; contador de "abertos" passa a considerar o status `inactive` como não-aberto.

## Impact

- `src/core/request/kinds.ts`: novo valor em `SERVICE_REQUEST_STATUSES`, `TERMINAL_SERVICE_REQUEST_STATUSES`, `isOpenServiceRequestStatus`, `statusLabel`, `isAllowedTransition`.
- `src/app/admin/(dashboard)/pedidos/_components/status-tone.ts`: tom visual para `inactive`.
- `src/app/admin/(dashboard)/pedidos/page.tsx` e componentes da fila: checkboxes de seleção, barra de ação em lote.
- `src/lib/service-request.ts`: nova função de atualização de status em lote (reaproveitando a validação de transição existente).
- Nenhuma migração destrutiva: `status` já é `text` livre, não é necessário alterar schema/enum de banco.

## Não-objetivos

- Não há exclusão em lote (hard delete) — a ação em lote só inativa.
- Não há reativação em lote — reativar continua sendo um a um, pela tela de detalhe já existente.
- Não há novo endpoint/API pública; a ação em lote é uma Server Action do painel admin.
- Não há alteração no fluxo do cidadão (site público) nem no acompanhamento de protocolo por ele.

## ADDED Requirements

### Requirement: Selecionar múltiplos protocolos e arquivá-los em lote

`/admin/pedidos` SHALL oferecer um checkbox por linha e um checkbox "selecionar todos" no
cabeçalho da fila, cobrindo os protocolos atualmente listados na página. Com um ou mais protocolos
selecionados, a fila SHALL exibir uma ação "Arquivar". Acionar essa ação SHALL exigir confirmação
explícita informando a quantidade de protocolos selecionados e declarando que a ação não apaga os
dados, apenas move os protocolos para o andamento "Arquivado". Após confirmar, todos os protocolos
selecionados SHALL passar para o andamento `archived`, cada um recebendo um evento de histórico
próprio.

#### Scenario: Selecionar todos da página

- **WHEN** o operador marca o checkbox "selecionar todos"
- **THEN** todos os protocolos exibidos na página ficam selecionados e a ação "Arquivar" fica
  disponível

#### Scenario: Arquivamento em lote confirmado

- **WHEN** o operador seleciona 5 protocolos, aciona "Arquivar" e confirma
- **THEN** os 5 protocolos passam ao andamento "Arquivado" e cada um ganha um evento de histórico
  registrando a mudança

#### Scenario: Ação em lote falha para um protocolo

- **WHEN** um dos protocolos selecionados não pôde ser atualizado (ex.: não pertence mais à
  serventia da sessão)
- **THEN** nenhum protocolo da seleção é alterado e o operador vê uma mensagem de erro

#### Scenario: Nenhum protocolo selecionado

- **WHEN** nenhum protocolo está selecionado
- **THEN** a ação "Arquivar" não é exibida

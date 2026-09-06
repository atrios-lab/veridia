## ADDED Requirements

### Requirement: Selecionar múltiplos protocolos e marcá-los como inativos

`/admin/pedidos` SHALL oferecer um checkbox por linha e um checkbox "selecionar todos" no
cabeçalho da fila, cobrindo os protocolos atualmente listados na página. Com um ou mais protocolos
selecionados, a fila SHALL exibir uma ação "Marcar como inativo". Acionar essa ação SHALL exigir
confirmação explícita informando a quantidade de protocolos selecionados e declarando que a ação
não apaga os dados, apenas move os protocolos para o andamento "Inativo". Após confirmar, todos os
protocolos selecionados SHALL passar para o andamento `inactive`, cada um recebendo um evento de
histórico próprio.

#### Scenario: Selecionar todos da página

- **WHEN** o operador marca o checkbox "selecionar todos"
- **THEN** todos os protocolos exibidos na página ficam selecionados e a ação "Marcar como
  inativo" fica disponível

#### Scenario: Inativação em lote confirmada

- **WHEN** o operador seleciona 5 protocolos, aciona "Marcar como inativo" e confirma
- **THEN** os 5 protocolos passam ao andamento "Inativo" e cada um ganha um evento de histórico
  registrando a mudança

#### Scenario: Ação em lote falha para um protocolo

- **WHEN** um dos protocolos selecionados não pôde ser atualizado (ex.: não pertence mais à
  serventia da sessão)
- **THEN** nenhum protocolo da seleção é alterado e o operador vê uma mensagem de erro

#### Scenario: Nenhum protocolo selecionado

- **WHEN** nenhum protocolo está selecionado
- **THEN** a ação "Marcar como inativo" não é exibida

## MODIFIED Requirements

### Requirement: Contador de pedidos em aberto

Um pedido SHALL contar como "em aberto" quando seu andamento não for Concluído, Indeferido,
Cancelado, Arquivado nem Inativo. O contador de pedidos em aberto SHALL aparecer no item "Pedidos
de serviço" da sidebar e SHALL refletir apenas os pedidos da serventia da sessão.

#### Scenario: Contador soma só andamentos não-terminais

- **WHEN** a serventia tem 3 pedidos em "Novo", 1 em "Em análise" e 2 em "Concluído"
- **THEN** o contador mostra 4

#### Scenario: Contador exclui protocolos inativos

- **WHEN** a serventia tem 2 pedidos em "Novo" e 3 em "Inativo"
- **THEN** o contador mostra 2

#### Scenario: Contador por serventia

- **WHEN** duas serventias têm pedidos em aberto em quantidades diferentes
- **THEN** cada uma vê só o próprio contador

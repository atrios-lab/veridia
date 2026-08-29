## ADDED Requirements

### Requirement: Controle de prazo na troca de andamento
O formulário de troca de andamento no detalhe do pedido SHALL exibir o prazo vigente (data prevista e dia da contagem) e oferecer, opcionalmente, três escolhas: manter o prazo (padrão, sem interação extra), zerar o prazo (a contagem recomeça na data de hoje com os mesmos dias) ou ajustar a quantidade de dias. A escolha SHALL ser gravada na mesma operação que troca o andamento, e a alteração de prazo SHALL constar na auditoria. O controle SHALL estar disponível também nos pedidos lançados no balcão. O servidor SHALL validar que os dias estão entre 1 e 365.

#### Scenario: Trocar andamento mantendo o prazo
- **WHEN** o operador troca o andamento sem tocar no controle de prazo
- **THEN** o andamento muda e o prazo do pedido permanece como estava

#### Scenario: Zerar o prazo ao iniciar a análise
- **WHEN** o operador troca o andamento e escolhe zerar o prazo
- **THEN** a contagem do pedido passa a iniciar na data de hoje, com a mesma quantidade de dias vigente

#### Scenario: Conceder prazo maior
- **WHEN** o operador troca o andamento e ajusta a quantidade de dias para um valor maior
- **THEN** o pedido passa a contar com a nova quantidade de dias a partir do início vigente

#### Scenario: Alteração de prazo auditada
- **WHEN** o operador zera ou ajusta o prazo de um pedido
- **THEN** o registro de auditoria da ação inclui a alteração de prazo

### Requirement: Urgência do prazo na fila e no detalhe do pedido
A fila de pedidos e o cabeçalho do detalhe SHALL exibir um badge de urgência derivado do prazo vigente, contado em dias úteis: "vence em N dias" quando faltam 3 dias úteis ou menos, e "vencido há N dias" quando a data prevista passou. Pedidos em andamento terminal SHALL NOT exibir urgência. Fora da janela de urgência, nenhum badge de prazo é exibido.

#### Scenario: Pedido perto do vencimento
- **WHEN** o operador abre a fila e um pedido em andamento está a 3 dias ou menos da data prevista
- **THEN** a linha exibe o badge indicando em quantos dias o prazo vence

#### Scenario: Pedido vencido
- **WHEN** um pedido em andamento passou da data prevista
- **THEN** a fila e o detalhe exibem o badge com há quantos dias o prazo venceu

#### Scenario: Pedido encerrado não tem urgência
- **WHEN** um pedido está em andamento terminal, mesmo com a data prevista no passado
- **THEN** nenhum badge de urgência de prazo é exibido

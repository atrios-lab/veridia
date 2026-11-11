## ADDED Requirements

### Requirement: Faixas da auditoria, alerta e justificativa

A auditoria SHALL classificar cada ato em Urgente, Atenção, Análise ou Rotina. Um ato urgente de outra pessoa
SHALL deixar um alerta em todas as telas do Tabelião/Registrador até ele marcar o ato como verificado. Toda
exclusão SHALL exigir uma justificativa, que SHALL ser gravada no registro do ato, e quem exclui SHALL ser
avisado de que o ato vai para a auditoria.

#### Scenario: Exclusão por um escrevente

- **WHEN** um escrevente exclui um anexo de pedido, com a justificativa
- **THEN** o ato entra como Urgente, com a justificativa
- **AND** o Tabelião/Registrador vê o aviso em todas as telas até marcá-lo como verificado

#### Scenario: Exclusão sem justificativa

- **WHEN** alguém confirma uma exclusão sem escrever o motivo
- **THEN** o servidor recusa o ato e nada é excluído

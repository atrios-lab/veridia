## ADDED Requirements

### Requirement: Enviar o pedido à qualificação e mostrar o resultado
O detalhe do pedido DEVE (SHALL) permitir, a quem tem a permissão da qualificação de títulos, enviar
o pedido à qualificação, e DEVE (SHALL) mostrar a nota devolutiva ou o termo de qualificação positiva
emitido para ele, que o apresentante também vê e baixa pelo acompanhamento do pedido.

#### Scenario: Nota disponível no pedido
- **WHEN** a nota devolutiva de um pedido é emitida
- **THEN** o detalhe do pedido e o acompanhamento do apresentante mostram a nota para baixar

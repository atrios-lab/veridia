## ADDED Requirements

### Requirement: Detalhe mostra a qualificação do inteiro teor do RCPN
O detalhe do pedido DEVE (SHALL) mostrar, quando o pedido tiver a qualificação do inteiro teor do RCPN, quem está pedindo, o nome do representado, o grau de parentesco e se o registrado é falecido. O painel SHALL NOT tratar a falta de anexo como recusa automática: a análise do mandato e dos documentos é do operador.

#### Scenario: Pedido feito por advogado
- **WHEN** o operador abre um pedido de inteiro teor do RCPN feito por advogado
- **THEN** o detalhe mostra que o pedido é por procuração, o nome do representado, a finalidade e os anexos enviados

#### Scenario: Pedido sem mandato
- **WHEN** o pedido por procuração chega sem nenhum anexo
- **THEN** o pedido fica na fila normalmente, e o operador pode abrir exigência ou indeferir

#### Scenario: Pedido sem qualificação
- **WHEN** o operador abre um pedido sem essas respostas, como um de óbito ou anterior à mudança
- **THEN** o detalhe não mostra esse bloco

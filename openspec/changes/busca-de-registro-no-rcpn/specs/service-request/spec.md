## ADDED Requirements

### Requirement: Busca de registro no RCPN
O catálogo DEVE (SHALL) oferecer no RCPN o ato "Busca de registro (consulta antes da certidão)", com a escolha entre nascimento, casamento, óbito ou outro registro. O formulário DEVE (SHALL) pedir a descrição do que procurar e do que se quer saber sobre o registro, e o motivo do pedido. A orientação DEVE (SHALL) dizer que a busca não é a certidão, que a serventia responde pelo protocolo e que, se o registro constar, quem pede faz um novo pedido na certidão comum ou na de inteiro teor. O site SHALL NOT consultar nenhum acervo nem converter a busca em pedido de certidão.

#### Scenario: Consulta da profissão antes do inteiro teor
- **WHEN** o cidadão escolhe a busca de registro de nascimento e descreve o nome, a filiação e a pergunta sobre a profissão
- **THEN** o pedido é aceito com o motivo, e a orientação diz que a certidão é pedida depois, no ato certo

#### Scenario: Busca sem descrição
- **WHEN** o cidadão envia a busca sem descrever o que procura
- **THEN** o pedido é recusado com erro junto ao campo

#### Scenario: Selo da busca
- **WHEN** a etapa 2 do RCPN lista a busca de registro
- **THEN** o cidadão lê "Termina on-line" e "Só identificação", com a dica de que a serventia responde se o registro consta ali

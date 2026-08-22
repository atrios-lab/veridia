## MODIFIED Requirements

### Requirement: Avisos por e-mail nas ações que afetam o cidadão
Ações do operador que mudam o que o cidadão vê SHALL disparar aviso por e-mail quando o contato
do pedido for um e-mail: exigência registrada, pedido concluído, pedido cancelado, documento de
entrega disponível, valor do pedido informado pela primeira vez e formulário anexado a uma
exigência. O aviso NÃO SHALL carregar o conteúdo (texto da exigência, arquivo, valor): apenas
o protocolo e a instrução de consultar com a chave. O envio SHALL ser fire-and-forget: falha de
e-mail nunca falha a ação.

#### Scenario: Exigência registrada avisa
- **WHEN** o operador registra uma exigência num pedido cujo contato é e-mail
- **THEN** chega um aviso "há uma exigência no seu pedido", sem o texto da exigência

#### Scenario: Conclusão avisa
- **WHEN** o operador muda o andamento para "Concluído"
- **THEN** chega um aviso de conclusão ao contato

#### Scenario: Entrega avisa
- **WHEN** o operador anexa um documento de entrega
- **THEN** chega um aviso "há um documento disponível no seu pedido", sem o arquivo

#### Scenario: Valor informado pela primeira vez avisa
- **WHEN** o operador informa o valor num pedido que ainda não tinha valor
- **THEN** chega um aviso de que o pedido tem valor a consultar, sem o valor no corpo

#### Scenario: Correção de valor não reavisa
- **WHEN** o operador corrige um valor já informado
- **THEN** nenhum e-mail é enviado

#### Scenario: Formulário de exigência avisa
- **WHEN** o operador anexa um formulário a uma exigência de um pedido cujo contato é e-mail
- **THEN** chega um aviso de que há um formulário para imprimir, sem o arquivo

#### Scenario: Andamento intermediário não avisa
- **WHEN** o operador muda o andamento para "Prenotado"
- **THEN** nenhum e-mail é enviado: o cidadão acompanha pela consulta, e avisar cada passo viraria ruído

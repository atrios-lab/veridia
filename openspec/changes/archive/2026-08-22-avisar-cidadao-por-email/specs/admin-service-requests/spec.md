## ADDED Requirements

### Requirement: Recibo por e-mail do pedido lançado no balcão

Quando o pedido é lançado manualmente e o contato registrado é um e-mail, o cidadão SHALL
receber um recibo com o número do protocolo e a instrução de guardar o protocolo e a chave
entregues no atendimento; a chave MUST NOT constar do e-mail. O envio SHALL ser
fire-and-forget: falha de e-mail nunca falha o lançamento.

#### Scenario: Recibo enviado

- **WHEN** o operador lança um pedido com contato "joao@exemplo.com"
- **THEN** chega um e-mail "Pedido recebido" com o protocolo e sem a chave

#### Scenario: Contato é telefone

- **WHEN** o operador lança um pedido com contato "(84) 99999-0000"
- **THEN** nenhum e-mail é tentado e o pedido é lançado normalmente

## MODIFIED Requirements

### Requirement: Avisos por e-mail nas ações que afetam o cidadão
Ações do operador que mudam o que o cidadão vê SHALL disparar aviso por e-mail quando o contato
do pedido for um e-mail: exigência registrada, pedido concluído, pedido cancelado, documento de
entrega disponível e valor do pedido informado pela primeira vez. O aviso NÃO SHALL carregar o
conteúdo (texto da exigência, arquivo, valor): apenas o protocolo e a instrução de consultar com
a chave. O envio SHALL ser fire-and-forget: falha de e-mail nunca falha a ação.

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

#### Scenario: Andamento intermediário não avisa
- **WHEN** o operador muda o andamento para "Prenotado"
- **THEN** nenhum e-mail é enviado: o cidadão acompanha pela consulta, e avisar cada passo viraria ruído

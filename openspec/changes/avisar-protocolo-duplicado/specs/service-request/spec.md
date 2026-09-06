## ADDED Requirements

### Requirement: Aviso de pedido duplicado em andamento
Antes de criar um novo `service-request`, o servidor DEVE (SHALL) verificar se já existe, no
mesmo tenant, um `service-request` com o mesmo `actId` cujo status esteja em aberto (não
terminal) e que identifique o mesmo cidadão: pelo CPF quando o cidadão o informa, ou pelo e-mail
quando não informa — o CPF é opcional no formulário público, o e-mail não é, e é ele quem
identifica o cidadão nesse caso. Se existir, o servidor NÃO DEVE (SHALL NOT) criar o novo pedido
e DEVE (SHALL) retornar o número do protocolo do pedido existente. O cliente DEVE (SHALL) exibir
um diálogo informando que o cidadão já possui um pedido em andamento com essas características,
com um botão/link para `/protocolo?numero=<protocolNumber>` que leva à consulta desse protocolo.

#### Scenario: Segundo pedido do mesmo ato e CPF é bloqueado
- **WHEN** o cidadão com CPF "123.456.789-09" tenta pedir o mesmo ato para o qual já tem um
  pedido com status "em análise" no mesmo tenant
- **THEN** nenhum pedido novo é criado e o diálogo de "pedido já em andamento" aparece com o
  número do protocolo existente e um link para `/protocolo?numero=<protocolNumber>`

#### Scenario: Segundo pedido sem CPF é bloqueado pelo e-mail
- **WHEN** o cidadão não informa CPF e tenta pedir o mesmo ato para o qual já tem um pedido em
  aberto no mesmo tenant, com o mesmo e-mail
- **THEN** nenhum pedido novo é criado e o diálogo de "pedido já em andamento" aparece com o
  número do protocolo existente

#### Scenario: Pedido anterior encerrado não bloqueia
- **WHEN** o cidadão tenta pedir um ato para o qual já teve um pedido, mas esse pedido está com
  status terminal (concluído, indeferido, cancelado ou arquivado)
- **THEN** o novo pedido é criado normalmente, sem o diálogo de duplicidade

#### Scenario: Mesmo CPF, ato diferente não bloqueia
- **WHEN** o cidadão tem um pedido em aberto para um ato, mas solicita um ato diferente
- **THEN** o novo pedido é criado normalmente

#### Scenario: Mesmo ato, CPF e e-mail diferentes não bloqueia
- **WHEN** duas pessoas com CPFs e e-mails diferentes pedem o mesmo ato no mesmo tenant
- **THEN** ambos os pedidos são criados normalmente, sem diálogo de duplicidade para nenhuma delas

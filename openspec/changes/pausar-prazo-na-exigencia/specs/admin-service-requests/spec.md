## ADDED Requirements

### Requirement: Prazo suspenso enquanto o pedido espera o cidadão
O prazo de um pedido de serviço SHALL ficar suspenso enquanto existir ao menos uma exigência pendente cadastrada no pedido, ou enquanto o pedido estiver em "Aguardando pagamento" com valor lançado. A suspensão SHALL nascer da exigência cadastrada ou do valor lançado, nunca do andamento sozinho: "Aguardando exigência" sem exigência cadastrada e "Aguardando pagamento" sem valor SHALL NOT suspender o prazo. Durante a suspensão, a contagem de dias e a urgência SHALL ficar congeladas no dia em que a suspensão começou. Dois motivos simultâneos SHALL contar como uma única suspensão, que termina quando o último motivo cessa. Suspensão e retomada SHALL constar no histórico do pedido.

#### Scenario: Registrar exigência suspende o prazo
- **WHEN** o operador registra uma exigência num pedido em andamento cujo prazo está no dia 4 de 10
- **THEN** o prazo fica suspenso a partir de hoje e, nos dias seguintes, continua a mostrar dia 4 de 10

#### Scenario: Andamento sem exigência cadastrada não suspende
- **WHEN** o operador troca o andamento para "Aguardando exigência" sem registrar exigência
- **THEN** o prazo continua correndo normalmente

#### Scenario: Aguardando pagamento com valor suspende
- **WHEN** o pedido tem valor lançado e o andamento muda para "Aguardando pagamento"
- **THEN** o prazo fica suspenso a partir de hoje

#### Scenario: Aguardando pagamento sem valor não suspende
- **WHEN** o andamento muda para "Aguardando pagamento" e o pedido não tem valor lançado
- **THEN** o prazo continua correndo normalmente

#### Scenario: Dois motivos, uma suspensão
- **WHEN** um pedido em "Aguardando pagamento" com valor lançado recebe uma exigência, e depois o pagamento é registrado com a exigência ainda pendente
- **THEN** o prazo permanece suspenso, contado desde o primeiro motivo, até a exigência ser cumprida

#### Scenario: Suspensão e retomada no histórico
- **WHEN** o prazo de um pedido é suspenso e depois retomado
- **THEN** o histórico do pedido mostra as duas entradas, com autor e data

### Requirement: Retomada do prazo ao cessar o motivo
Quando o último motivo de suspensão cessar (a última exigência pendente for cumprida ou excluída, o pagamento for registrado ou o valor removido), o prazo SHALL retomar automaticamente. Para ato com prazo legal, a contagem SHALL recomeçar do zero na data da retomada, com a mesma quantidade de dias. Para ato sem prazo legal (padrão do cartório), a contagem SHALL continuar de onde parou: a data prevista avança pela quantidade de dias úteis que durou a suspensão.

#### Scenario: Ato com prazo legal recomeça
- **WHEN** a última exigência pendente de um pedido de registro na matrícula (prazo legal de 10 dias) é cumprida
- **THEN** o prazo passa a contar 10 dias úteis a partir da data da retomada

#### Scenario: Ato no padrão do cartório continua
- **WHEN** um pedido de ato sem prazo legal foi suspenso no dia 4 de 20, ficou 6 dias úteis suspenso, e a exigência é cumprida
- **THEN** o prazo retoma no dia 4 de 20 e a data prevista fica 6 dias úteis depois da original

#### Scenario: Excluir a única exigência pendente retoma
- **WHEN** o operador exclui a única exigência pendente de um pedido suspenso
- **THEN** o prazo retoma pela mesma regra da exigência cumprida

#### Scenario: Suspensão atravessa fim de semana
- **WHEN** um pedido fica suspenso de sexta a terça
- **THEN** só os dias úteis da suspensão são descontados na retomada, e o tempo de espera exibido conta só dias úteis

### Requirement: Prazo suspenso na fila e no detalhe
Enquanto o prazo estiver suspenso, a fila e o detalhe SHALL substituir o selo de urgência por um selo neutro "Aguardando o cidadão há N dias úteis" ("desde hoje" quando nenhum dia útil passou), sem tom de atraso. Dentro de uma banda aberta da fila, os pedidos suspensos SHALL vir depois dos vencidos e dos que vencem em breve, e antes dos demais, ordenados do que espera há mais tempo para o que espera há menos. O resumo do prazo no detalhe SHALL informar desde quando está suspenso e em que dia da contagem parou. Os controles de zerar e ajustar dias SHALL continuar disponíveis durante a suspensão e SHALL manter o prazo suspenso.

#### Scenario: Selo de espera na fila
- **WHEN** um pedido está com exigência pendente há 5 dias úteis
- **THEN** a linha mostra "Aguardando o cidadão há 5 dias úteis", e nenhum selo de vencido ou vence em breve

#### Scenario: Ordem dos suspensos na banda
- **WHEN** a banda "Com pendência" tem um pedido vencido, um suspenso há 8 dias úteis e um suspenso há 2
- **THEN** a ordem é: vencido, suspenso há 8, suspenso há 2

#### Scenario: Resumo do prazo no detalhe
- **WHEN** o operador abre o detalhe de um pedido suspenso desde 20/08 no dia 4 de 10
- **THEN** o resumo do prazo diz que está suspenso desde 20/08 e parou no dia 4 de 10

#### Scenario: Zerar durante a suspensão
- **WHEN** o operador zera o prazo de um pedido suspenso
- **THEN** a contagem passa a iniciar hoje e o prazo continua suspenso

### Requirement: Pedidos já parados recebem a suspensão
Os pedidos abertos que, na entrada desta regra, já tenham exigência pendente SHALL receber a suspensão com início na data da exigência pendente mais antiga. Os que estiverem em "Aguardando pagamento" com valor lançado e sem exigência pendente SHALL receber a suspensão com início na data da última atualização do pedido. A operação SHALL rodar uma vez, com auditoria, no Homolog antes de produção.

#### Scenario: Pedido com exigência antiga
- **WHEN** um pedido aberto tem uma exigência pendente registrada em 13/08 e o script roda em 03/09
- **THEN** o pedido fica suspenso desde 13/08 e a fila mostra a espera contada a partir dessa data

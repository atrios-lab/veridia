## MODIFIED Requirements

### Requirement: Mudar o andamento a partir do detalhe

O detalhe SHALL mostrar o andamento atual e oferecer, como sugestão, os andamentos alcançáveis a
partir dele. O operador SHALL poder, além da sugestão, escolher qualquer um dos onze andamentos
válidos: Novo, Aguardando pagamento, Pagamento informado, Pago, Aguardando exigência, Em
processamento, Disponível para retirada, Concluído, Indeferido, Cancelado, Arquivado. O fluxo é
livre de propósito (o andamento de um título não cabe numa máquina de estados; quem decide é o
registrador): o servidor SHALL aceitar qualquer valor da lista fechada de onze, SHALL recusar
qualquer outro e SHALL recusar a transição para o mesmo andamento. Toda mudança SHALL gravar
entrada no histórico do pedido. Na fila, onde onze não cabem numa barra de progresso, o andamento
SHALL ser apresentado colapsado em fases.

O selo colorido do andamento SHALL ter a mesma cor na fila e no detalhe, e a cor SHALL ser
decidida pelo que o andamento pede do balcão, em cinco tons:

- **bloqueado** (vermelho): Aguardando exigência, Indeferido
- **esperando** (laranja): Novo, Aguardando pagamento, Pagamento informado
- **em curso** (verde): Pago, Em processamento
- **entregue** (tinta do escritório): Disponível para retirada, Concluído
- **encerrado** (cinza): Cancelado, Arquivado

Cada um dos onze andamentos SHALL ter exatamente um tom declarado; nenhum andamento SHALL receber
cor por omissão.

#### Scenario: Exigência se destaca na fila

- **WHEN** a fila mostra um pedido em "Aguardando exigência" ao lado de um em "Em processamento"
- **THEN** o selo da exigência sai no tom bloqueado (vermelho) e o de "Em processamento" no tom em
  curso (verde), com destaque equivalente ao laranja de "Aguardando pagamento"

#### Scenario: Fila e detalhe combinam

- **WHEN** o operador abre o detalhe de um pedido que viu na fila
- **THEN** o selo do andamento tem a mesma cor nas duas telas

#### Scenario: Andamento novo exige tom

- **WHEN** um décimo segundo andamento é acrescentado à lista sem tom declarado
- **THEN** a build falha, em vez de o andamento aparecer com uma cor herdada em silêncio

#### Scenario: Transição sugerida

- **WHEN** o pedido está em "Novo"
- **THEN** a tela oferece "Em processamento", "Aguardando pagamento" e "Cancelado" como sugestão
  direta

#### Scenario: Registro e averbação usam o mesmo andamento

- **WHEN** o operador está registrando ou averbando um título de Registro de Imóveis
- **THEN** as duas etapas usam "Em processamento" — não há andamento próprio para "registrado" ou
  para "averbado", diferente do que a serventia via em produção antes deste corte

#### Scenario: Correção manual fora da sugestão

- **WHEN** o operador precisa corrigir um pedido de "Cancelado" direto para "Disponível para
  retirada"
- **THEN** a mudança é aceita, mesmo não sendo uma das sugestões diretas daquele andamento

#### Scenario: Valor inválido é recusado

- **WHEN** uma requisição tenta gravar um andamento fora dos onze valores válidos
- **THEN** o servidor recusa e o andamento do pedido não muda

#### Scenario: Dados existentes continuam válidos

- **WHEN** a lista passa de vinte para onze
- **THEN** todo pedido já gravado num dos nove valores removidos ou fundidos é remapeado por uma
  migração de dado antes do deploy que encolhe a lista, e nenhum pedido fica com um andamento que
  o painel não reconheça

#### Scenario: Outros canais não são afetados

- **WHEN** a lista de andamentos do pedido de serviço muda de tamanho
- **THEN** agendamento, LGPD e ouvidoria seguem com os seus próprios andamentos, apesar de
  compartilharem a mesma coluna de status

## MODIFIED Requirements

### Requirement: Mudar o andamento a partir do detalhe

O detalhe SHALL mostrar o andamento atual e oferecer, como sugestão, os andamentos alcançáveis a
partir dele. O operador SHALL poder, além da sugestão, escolher qualquer um dos vinte
andamentos válidos, que cobrem o fluxo registral que a serventia já usa em produção: Novo, Em
análise, Aguardando pagamento, Pagamento informado, Pago, Protocolado, Prenotado, Em
qualificação, Com exigência, Aguardando exigência, Em processamento, Registrado, Averbado,
Deferido, Disponível para retirada, Concluído, Indeferido, Cancelado, Arquivado, Inativo. O
fluxo é livre de propósito (o andamento de um título não cabe numa máquina de estados; quem
decide é o registrador): o servidor SHALL aceitar qualquer valor da lista fechada de vinte,
SHALL recusar qualquer outro e SHALL recusar a transição para o mesmo andamento. Toda mudança
SHALL gravar entrada no histórico do pedido. Na fila, onde vinte não cabem numa barra de
progresso, o andamento SHALL ser apresentado colapsado em fases.

"Pagamento informado" pertence à fase Pagamento e é o único andamento escrito pelo cidadão
(pela consulta de protocolo, ao enviar o comprovante). A partir dele a sugestão direta SHALL
ser "Pago", com "Aguardando pagamento" (comprovante não confere) e "Cancelado" como
alternativas. A mudança feita pelo cidadão SHALL gravar entrada no histórico sem operador.

O selo colorido do andamento SHALL ter a mesma cor na fila e no detalhe, e a cor SHALL ser
decidida pelo que o andamento pede do balcão, em cinco tons:

- **bloqueado** (vermelho): Com exigência, Aguardando exigência, Indeferido
- **esperando** (laranja): Novo, Protocolado, Aguardando pagamento, Pagamento informado
- **em curso** (verde): Em análise, Pago, Prenotado, Em qualificação, Em processamento,
  Registrado, Averbado, Deferido
- **entregue** (tinta do escritório): Disponível para retirada, Concluído
- **encerrado** (cinza): Cancelado, Arquivado, Inativo

Cada um dos vinte andamentos SHALL ter exatamente um tom declarado; nenhum andamento SHALL
receber cor por omissão.

#### Scenario: Exigência se destaca na fila

- **WHEN** a fila mostra um pedido em "Com exigência" ao lado de um em "Em análise"
- **THEN** o selo da exigência sai no tom bloqueado (vermelho) e o de "Em análise" no tom em curso
  (verde), com destaque equivalente ao laranja de "Aguardando pagamento"

#### Scenario: Pagamento informado chama o balcão

- **WHEN** o cidadão envia o comprovante pela consulta
- **THEN** a fila mostra o pedido com o selo "Pagamento informado" no tom esperando (laranja), e
  o detalhe oferece "Pago" como próxima sugestão

#### Scenario: Fila e detalhe combinam

- **WHEN** o operador abre o detalhe de um pedido que viu na fila
- **THEN** o selo do andamento tem a mesma cor nas duas telas

#### Scenario: Andamento novo exige tom

- **WHEN** um vigésimo primeiro andamento é acrescentado à lista sem tom declarado
- **THEN** a build falha, em vez de o andamento aparecer com uma cor herdada em silêncio

#### Scenario: Transição sugerida

- **WHEN** o pedido está em "Em análise"
- **THEN** a tela oferece os próximos andamentos curados daquele ponto como sugestão direta

#### Scenario: Andamento registral disponível

- **WHEN** o operador precisa marcar um título como "Prenotado"
- **THEN** a lista completa oferece o andamento e o servidor o aceita

#### Scenario: Correção manual fora da sugestão

- **WHEN** o operador precisa corrigir um pedido de "Cancelado" de volta para "Em análise"
- **THEN** a mudança é aceita, mesmo não sendo uma das sugestões diretas daquele andamento

#### Scenario: Valor inválido é recusado

- **WHEN** uma requisição tenta gravar um andamento fora dos vinte valores válidos
- **THEN** o servidor recusa e o andamento do pedido não muda

#### Scenario: Dados existentes continuam válidos

- **WHEN** a lista cresce
- **THEN** todo pedido já gravado continua com andamento válido, pois os valores anteriores
  permanecem na lista sem renomeação

#### Scenario: Outros canais não são afetados

- **WHEN** a lista de andamentos do pedido cresce
- **THEN** agendamento, LGPD e ouvidoria seguem com os seus próprios andamentos, apesar de
  compartilharem a mesma coluna de status

## ADDED Requirements

### Requirement: Detalhe mostra o comprovante de pagamento enviado pelo cidadão

Quando o cidadão informou o pagamento, o detalhe do pedido SHALL mostrar, junto do valor, a
data e hora em que o comprovante foi enviado e o link para abrir o comprovante mais recente pela
rota autenticada do painel. O comprovante SHALL constar também na lista de documentos anexados
pelo cidadão, como os demais arquivos que ele envia.

#### Scenario: Comprovante a um clique do valor
- **WHEN** o operador abre o detalhe de um pedido em "Pagamento informado"
- **THEN** vê, ao lado do valor, "pagamento informado em <data e hora>" e o link do comprovante

#### Scenario: Reenvio mostra o último
- **WHEN** o cidadão enviou dois comprovantes
- **THEN** o bloco do valor aponta para o mais recente e a lista de documentos mostra os dois

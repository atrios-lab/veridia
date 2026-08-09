## ADDED Requirements

### Requirement: Linha do tempo da consulta reflete o ciclo completo do pedido
A consulta de protocolo de um pedido de serviço, atrás da chave de acesso, SHALL exibir uma linha do tempo que cobre o ciclo completo do pedido em linguagem do cidadão: recebimento, requerimento assinado, exigências pendentes, pagamento (quando houver valor), preparo pela serventia e conclusão com entrega — com a etapa atual identificável e desfechos negativos (indeferido, cancelado) exibidos como etapa final própria. Datas SHALL aparecer apenas em etapas com registro real (criação, requerimento recebido, documento entregue); etapas derivadas apenas do andamento não exibem data.

#### Scenario: Pedido pago e com documento entregue mostra a conclusão
- **WHEN** o cidadão consulta um pedido com pagamento confirmado e documento já anexado pela serventia
- **THEN** a linha do tempo mostra todas as etapas anteriores como concluídas e a etapa "Documento entregue" concluída, com a data da primeira entrega

#### Scenario: Pedido pago ainda em preparo mostra a etapa atual
- **WHEN** o cidadão consulta um pedido com status "Pago" e sem documento entregue
- **THEN** a linha do tempo mostra "Em preparo na serventia" como etapa atual e a conclusão como etapa futura, sem data inventada

#### Scenario: Exigência pendente aparece como etapa aguardando o cidadão
- **WHEN** o pedido tem ao menos uma exigência pendente
- **THEN** a linha do tempo exibe uma etapa indicando que uma exigência aguarda resposta do cidadão, apontando para o cartão de exigências da própria consulta

#### Scenario: Pedido indeferido encerra a linha do tempo
- **WHEN** o cidadão consulta um pedido com status "Indeferido" ou "Cancelado"
- **THEN** as etapas ainda não cumpridas são substituídas por uma única etapa final nomeando o desfecho, em estilo de alerta, e as etapas já cumpridas permanecem visíveis

#### Scenario: Pedido sem valor cobrado não mostra etapa de pagamento
- **WHEN** o cidadão consulta um pedido sem valor informado pela serventia
- **THEN** a linha do tempo não exibe etapa de pagamento e o preparo pela serventia aparece após o requerimento assinado

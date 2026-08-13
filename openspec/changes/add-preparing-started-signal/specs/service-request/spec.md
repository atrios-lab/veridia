## MODIFIED Requirements

### Requirement: Linha do tempo da consulta reflete o ciclo completo do pedido
A consulta de protocolo de um pedido de serviço, atrás da chave de acesso, SHALL exibir uma linha do tempo que cobre o ciclo completo do pedido em linguagem do cidadão: recebimento, requerimento assinado, exigências pendentes, pagamento (quando houver valor), preparo pela serventia e conclusão com entrega — com a etapa atual identificável visualmente, não só pela posição na lista, e desfechos negativos (indeferido, cancelado) exibidos como etapa final própria. Quando houver uma etapa ainda não concluída e o pedido não estiver num desfecho final de alerta, a primeira etapa não concluída da lista SHALL exibir um destaque visual distinto tanto das etapas concluídas quanto das etapas futuras. Datas SHALL aparecer apenas em etapas com registro real (criação, requerimento recebido, documento entregue); etapas derivadas apenas do andamento não exibem data.

#### Scenario: Pedido pago e com documento entregue mostra a conclusão
- **WHEN** o cidadão consulta um pedido com pagamento confirmado e documento já anexado pela serventia
- **THEN** a linha do tempo mostra todas as etapas anteriores como concluídas e a etapa "Documento entregue" concluída, com a data da primeira entrega

#### Scenario: Pedido pago ainda em preparo destaca a etapa atual
- **WHEN** o cidadão consulta um pedido com status "Pago" e sem documento entregue
- **THEN** a linha do tempo mostra "Em preparo na serventia" com o destaque visual de etapa atual, distinto da etapa "Conclusão e entrega" seguinte, que permanece com o estilo apagado de etapa futura, sem data inventada

#### Scenario: Exigência pendente aparece como etapa aguardando o cidadão, com destaque de etapa atual
- **WHEN** o pedido tem ao menos uma exigência pendente
- **THEN** a linha do tempo exibe a etapa de exigência pendente com o destaque visual de etapa atual, apontando para o cartão de exigências da própria consulta, e nenhuma etapa posterior recebe esse destaque

#### Scenario: Pedido indeferido encerra a linha do tempo sem etapa atual
- **WHEN** o cidadão consulta um pedido com status "Indeferido" ou "Cancelado"
- **THEN** as etapas ainda não cumpridas são substituídas por uma única etapa final nomeando o desfecho, em estilo de alerta, sem destaque de etapa atual; as etapas já cumpridas permanecem visíveis

#### Scenario: Pedido sem valor cobrado não mostra etapa de pagamento
- **WHEN** o cidadão consulta um pedido sem valor informado pela serventia
- **THEN** a linha do tempo não exibe etapa de pagamento e o preparo pela serventia aparece após o requerimento assinado

#### Scenario: Pedido totalmente concluído não tem etapa atual
- **WHEN** todas as etapas do pedido já estão concluídas
- **THEN** nenhuma etapa recebe o destaque visual de etapa atual

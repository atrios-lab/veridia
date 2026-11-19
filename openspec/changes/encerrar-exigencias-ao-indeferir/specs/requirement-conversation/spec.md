## ADDED Requirements

### Requirement: Exigência encerrada com o pedido

Quando o pedido é indeferido ou cancelado, toda exigência ainda aberta SHALL passar ao estado "Encerrada com o pedido", e as já cumpridas SHALL continuar como estão. Numa exigência encerrada, NEM o cidadão NEM o cartório SHALL poder escrever ou anexar. Reabrir o pedido NÃO SHALL reabrir a exigência encerrada. O encerramento SHALL ser registrado na auditoria e nada SHALL ser apagado.

#### Scenario: Indeferir encerra a exigência aberta
- **WHEN** o cartório indefere um pedido com uma exigência aguardando o cidadão
- **THEN** a exigência passa a "Encerrada com o pedido" e a auditoria registra o encerramento

#### Scenario: O cidadão não responde mais
- **WHEN** o cidadão tenta escrever numa exigência encerrada pela consulta do protocolo
- **THEN** a mensagem é recusada, e a consulta mostra a exigência encerrada com o aviso de fazer um novo pedido

#### Scenario: Exigência cumprida fica como está
- **WHEN** o pedido indeferido tinha uma exigência já cumprida
- **THEN** ela continua "Cumprida"

#### Scenario: Reabrir não reabre
- **WHEN** o cartório reabre um pedido indeferido
- **THEN** a exigência encerrada continua encerrada

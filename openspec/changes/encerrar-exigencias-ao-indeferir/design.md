## Context

A exigência tem dois estados, "pending" e "fulfilled", e toda escrita na conversa passa por `pendingRequirement`, que só aceita "pending". O andamento do pedido é gravado num só lugar, `updateRequestStatusWith`.

## Decisions

### 1. Um terceiro estado, "closed"

A coluna `status` é texto, então o estado novo não pede migração. Como não é "pending", a conversa fecha sozinha nos dois lados, sem mudar as funções de escrita. Alternativa descartada: marcar a exigência como cumprida, que diria ao cidadão algo que não aconteceu.

### 2. Fechar onde o andamento muda

`updateRequestStatusWith` encerra as exigências abertas quando o andamento novo é "Indeferido" ou "Cancelado". Qualquer caminho que indefira ou cancele (o seletor de andamento, ou outro que venha) passa por ali. A auditoria registra uma linha quando alguma exigência foi encerrada.

### 3. Reabrir não reabre

Uma exigência encerrada continua encerrada se o pedido for reaberto. Se o cartório precisar de algo, registra uma exigência nova. O cidadão que ainda quiser o serviço faz um novo pedido.

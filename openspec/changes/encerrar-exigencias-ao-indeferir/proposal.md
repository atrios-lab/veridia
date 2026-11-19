## Why

Um pedido foi indeferido e, mesmo assim, o cidadão continuou escrevendo na exigência que estava aberta. A exigência seguia "aguardando o cidadão" num protocolo que já tinha terminado, e o cartório recebia respostas que não levavam a nada.

## What Changes

- Ao indeferir ou cancelar um pedido, toda exigência ainda aberta é encerrada com ele (estado novo "Encerrada com o pedido"). As cumpridas ficam como estão.
- A conversa da exigência encerrada fecha para os dois lados: o cidadão não responde mais, nem anexa nela, e o cartório também não escreve.
- O painel mostra "Encerrada com o pedido". A consulta do cidadão mostra o mesmo, com o aviso de que, se ainda quiser o serviço, ele faz um novo pedido.
- Reabrir o pedido não reabre a exigência encerrada.
- O encerramento entra na auditoria. Nada é apagado e nada muda no banco além do valor do estado, que já é texto livre.

## Non-goals

- Encerrar exigências quando o pedido é concluído ou arquivado: nesses casos a exigência já foi cumprida ou o andamento é outro.
- Bloquear a consulta do protocolo: o cidadão continua vendo o pedido e o motivo do indeferimento.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `requirement-conversation`: a exigência ganha o estado encerrada, que fecha a conversa.

## Impact

- `src/core/request/requirement.ts`, `src/lib/service-request.ts` (ao mudar o andamento), telas da exigência no painel e na consulta, rótulos de auditoria.

## Why

Quando o cidadão envia o comprovante pelo "Já paguei", o pedido muda para "Pagamento informado"
e aparece na fila de `/admin/pedidos` com o selo laranja, mas não volta para "Sua mesa hoje".
A mesa decide de quem é a vez comparando a última ação do cartório (audit com ator) com a última
ação do cidadão, e hoje só conhece duas ações do cidadão: a criação do pedido e as mensagens na
conversa de uma exigência. O envio do comprovante grava um anexo e um andamento sem ator, e
nenhum dos dois entra nessa conta. O mesmo vale para o documento extra que o cidadão anexa pela
consulta. Resultado: o cartório põe o pedido em "Aguardando pagamento", o cidadão paga e avisa, e
a mesa segue mostrando que nada espera pela serventia.

## What Changes

- A vez passa a voltar ao cartório também quando o cidadão anexa um arquivo ao pedido pela
  consulta de protocolo: comprovante de pagamento ("Já paguei") ou documento extra. A última
  ação do cidadão passa a ser a mais recente entre a criação, a última mensagem em exigência e o
  último anexo enviado por ele.
- Reenviar o comprovante, mesmo com o pedido já em "Pagamento informado", também devolve a vez
  ao cartório.
- Na mesa, um pedido em "Pagamento informado" ganha resumo e ação próprios ("Pagamento
  informado, comprovante a conferir" / "Conferir pagamento") no lugar do genérico "Novo pedido de
  serviço" / "Ver pedido". A posição na mesa não muda: continua na rotina, do mais novo para o
  mais antigo.

## Non-goals

- Não muda tier nem cor na mesa: "Pagamento informado" não sobe junto da exigência cumprida.
  Se o balcão pedir, é outro change.
- Não passa a auditar ações do cidadão. A decisão de não auditar mensagens do cidadão fica como
  está; a mesa lê uma terceira fonte, como já lê as mensagens.
- Não toca em `updated_at` como sinal de vez: escrituração e rascunho também bumpam esse campo.
- Não mexe na fila de `/admin/pedidos`, que já mostra o pedido corretamente.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-overview`: o requisito "Mesa de trabalho com urgências na frente e rotina do mais novo
  para o mais antigo" passa a contar anexos enviados pelo cidadão como ação do cidadão e dá
  resumo próprio ao pedido em "Pagamento informado".

## Impact

- `src/lib/admin-overview.ts`: `listDeskItems` ganha uma terceira consulta, `lastCitizenAttachmentAt`,
  sobre `service_request_attachments` com `kind` de origem do cidadão; `citizen` vira o máximo
  entre criação, mensagem e anexo.
- `src/core/overview/desk.ts`: `defaultSummary` e `defaultActionLabel` tratam `payment-reported`.
- `src/core/overview/desk.test.ts`: cobre o resumo do "Pagamento informado".
- Sem migração de banco.

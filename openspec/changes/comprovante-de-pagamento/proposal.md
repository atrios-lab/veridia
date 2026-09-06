## Why

A consulta de protocolo já mostra o valor do pedido e o QR Pix (`add-request-payment-qr`), mas
a plataforma não recebe confirmação automática do banco: o pedido fica em "Aguardando pagamento"
até alguém no balcão descobrir, por conta própria, que o dinheiro caiu. Enquanto isso a tela do
cidadão promete o contrário ("O pagamento é confirmado sozinho, em até 1 dia útil. Não precisa
mandar comprovante."). O cartório resolve isso hoje por e-mail, pedindo o comprovante para
conferir. SCRUM-61 (prioridade máxima, "urgente para uso") pede que esse pedido de comprovante
entre no fluxo: o cidadão avisa que pagou, anexa o comprovante, e o painel mostra ao operador
que há pagamento a conferir.

## What Changes

- Novo andamento do pedido de serviço: **Pagamento informado** (`payment-reported`), na fase
  Pagamento, entre "Aguardando pagamento" e "Pago". É o único andamento escrito pelo cidadão; a
  serventia confere e move para "Pago" (ou devolve para "Aguardando pagamento" se o comprovante
  não bater).
- Na consulta de protocolo (tanto `/protocolo` quanto `/acompanhar`), o bloco de pagamento ganha
  o botão "Já paguei", que abre o envio do comprovante (1 arquivo, imagem ou PDF, mesmos limites
  dos demais uploads). O envio grava o comprovante como anexo do pedido e move o andamento para
  "Pagamento informado". Depois disso a tela para de exibir o QR e mostra que o comprovante foi
  recebido e está em conferência.
- O texto que prometia confirmação automática sai; a instrução passa a ser "pagou, envie o
  comprovante".
- No painel, o pedido aparece na fila com o selo "Pagamento informado" (tom esperando, laranja:
  o balcão precisa agir) e o detalhe mostra, junto do valor, quando o cidadão informou e o link
  para o comprovante, com "Pago" como próxima sugestão.
- Sem migração de banco: o andamento é lista fechada em código (`SERVICE_REQUEST_STATUSES`) e
  o comprovante é uma linha em `service_request_attachments` com `kind = "payment-receipt"`.

## Non-goals

- Conciliação automática com o banco (webhook Pix, consulta de extrato): continua fora. Este
  change existe justamente porque isso não existe ainda; quando existir, "Pagamento informado"
  vira um atalho opcional, não um passo obrigatório.
- Aviso por e-mail à serventia quando o cidadão informa o pagamento. O painel já sinaliza pela
  fila e pelo detalhe ao vivo; e-mail para o balcão é decisão à parte.
- Aviso por e-mail ao cidadão quando a serventia confirma o pagamento ("Pago"). O aviso de
  mudança de andamento já existente cobre, se estiver ligado.
- Validar o conteúdo do comprovante (OCR, valor, data). A conferência é humana, como já é por
  e-mail.
- Informar pagamento sem comprovante. O ticket pede o comprovante para conferência; um aviso
  sem arquivo não dá ao balcão nada para conferir.
- Mudar o que pausa o prazo. "Aguardando pagamento" segue pausando; "Pagamento informado" não
  pausa, porque a partir dali quem deve agir é a serventia.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: a consulta de protocolo (as duas telas) permite ao cidadão, atrás da chave
  de acesso, informar que pagou anexando o comprovante; o pedido passa a "Pagamento informado"
  e a tela reflete isso no lugar do QR.
- `admin-service-requests`: a lista fechada de andamentos ganha "Pagamento informado" (fase
  Pagamento, tom esperando, sugestão seguinte "Pago"); o detalhe mostra o comprovante e a data em
  que o cidadão informou o pagamento.

## Impact

- `src/core/request/kinds.ts`: novo valor em `SERVICE_REQUEST_STATUSES`, fase, rótulo e
  sugestões; `kinds.test.ts` cobre a fase.
- `src/app/admin/(dashboard)/pedidos/_components/status-tone.ts`: tom do novo andamento (o
  `Record` sem fallback já obriga).
- `src/lib/service-request.ts`: `updateRequestStatus` passa a aceitar ator nulo (cidadão) na
  auditoria; nova função de leitura do comprovante ou reuso de `listAttachments` filtrando por
  `kind`.
- `src/app/(public)/protocolo/actions.ts`: nova server action `reportPayment` (protocolo + chave,
  rate limit, 1 anexo obrigatório) e `ServiceRequestDetail` carregando o comprovante.
- `src/app/(public)/protocolo/protocol-lookup.tsx` e `src/app/(public)/acompanhar/protocol-trilho.tsx`:
  botão "Já paguei" com envio do comprovante e o estado "em conferência".
- `src/app/admin/(dashboard)/pedidos/[protocolo]/_components/amount-section.tsx` e `page.tsx`:
  data e link do comprovante junto do valor.
- `e2e/service-request.spec.ts` e `e2e/admin-service-requests.spec.ts`: cenários do fluxo.
- Toca arquivos que o change `feature-flag-acompanhar` (em andamento, nesta mesma branch) já
  modifica: `protocolo/actions.ts` e `protocol-trilho.tsx`. Implementar depois que aquele
  change fechar, ou em cima dele.

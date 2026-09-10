## Context

O pagamento hoje é 100% Pix "copia e cola": não há gateway nem webhook. O cidadão paga fora da
plataforma e volta à consulta de protocolo (`/protocolo`) para clicar "Já paguei"
(`reportPayment`, em `src/app/(public)/protocolo/actions.ts:500`), anexando o comprovante como
`payment-receipt` e movendo o andamento para `payment-reported` na primeira vez. Ninguém na
serventia é avisado desse evento: o operador só descobre olhando a fila no painel.

O produto já tem duas formas de aviso por e-mail, e este change reaproveita as duas:
- `notifyCitizen` (`src/lib/email/service-request.ts`): fire-and-forget via `after()`, nunca
  bloqueia a ação do cidadão, loga e segue em silêncio se falhar. Padrão certo aqui, porque
  `reportPayment` é uma rota pública e o autorrelato não pode esperar nem falhar por causa do
  Postmark.
- `sendComplianceSubmittedEmails` (`src/lib/email/compliance.ts`): precedente de e-mail dirigido
  à serventia via `tenant.contacts.email`, usando o cartão `renderEmailCardHtml`/`renderEmailCardText`
  com botão para uma URL absoluta do painel.

## Goals / Non-Goals

**Goals:**
- A serventia recebe um e-mail assim que um comprovante de pagamento é anexado pelo cidadão
  (primeiro envio ou reenvio), com o suficiente para decidir se vale abrir o painel agora.
- O envio nunca compromete o autorrelato do cidadão: mesma garantia fire-and-forget que os avisos
  existentes.

**Non-Goals:**
- Confirmar o pagamento automaticamente ou mudar o andamento para "Pago" — continua manual.
- Avisar por e-mail quando o operador confirma o pagamento (ele já sabe).
- Qualquer canal além de e-mail, ou destino além do contato institucional da serventia.
- Qualquer mudança no fluxo de Pix, comprovante ou banco de dados.

## Decisions

**Onde vive o envio: novo export em `src/lib/email/service-request.ts`, não um módulo novo.**
O arquivo já concentra os avisos ligados ao ciclo de vida do pedido (`notifyCitizen`) e importa o
que a nova função precisa (`sendEmail`, `renderNoticeEmailHtml`/`renderEmailCardHtml`,
`brandImageUrl`). Um módulo `payment.ts` à parte replicaria imports sem separar uma
responsabilidade de fato diferente — diferente do caso de `compliance.ts`, que é um domínio
inteiro à parte (adequação ao Provimento).

**Template: `renderEmailCardHtml`/`renderEmailCardText` (cartão com botão), não
`renderNoticeEmailHtml`.** O aviso ao cidadão (`renderNoticeEmailHtml`) existe porque o e-mail não
pode carregar conteúdo atrás da chave de acesso — o cidadão tem que voltar à consulta e se
autenticar com protocolo+chave. Esse cuidado não se aplica ao operador: ele já é autenticado no
painel, então o botão pode levar direto a `/admin/pedidos/{protocolNumber}` e o corpo pode conter
requerente e valor, o mesmo padrão que `sendComplianceSubmittedEmails` usa para o aviso à
serventia.

**Trigger: toda chamada de `reportPayment` bem-sucedida, não só a que muda o andamento.** Um
reenvio de comprovante (pedido já em "Pagamento informado") é, para quem está no balcão, uma
informação nova — o comprovante anterior pode ter sido ilegível ou de outro valor. Condicionar o
aviso à transição de andamento (como o requisito existente de "valor informado pela primeira
vez") deixaria reenvios silenciosos, que é justamente o caso em que a serventia mais precisa
saber que algo mudou.

**Sem checagem de bounce antes do envio.** `notifyCitizen` consulta `findPermanentBounce` porque o
e-mail do cidadão vem de um formulário público e pode ter batido antes. O contato aqui é
`tenant.contacts.email`, cadastrado pela própria serventia como config — o mesmo endereço que
`sendComplianceSubmittedEmails` já usa sem essa checagem. `sendEmail` ainda verifica bounce
internamente antes de chamar o Postmark, então a proteção não desaparece, só não é duplicada na
camada de service-request.

**Valor no corpo, ao contrário do aviso ao cidadão que omite valor.** O requisito existente
("Valor informado pela primeira vez avisa") esconde o valor do cidadão de propósito — o valor
mora atrás da chave. Para o operador não há essa fronteira: ele já vê o valor no painel, e omiti-lo
do e-mail só o obrigaria a abrir o pedido para saber se vale a pena conferir agora.

## Risks / Trade-offs

- [Um comprovante ilegível ou trocado gera aviso do mesmo jeito que um válido, porque a rota não
  confere o arquivo] → aceito: o e-mail é "há algo a conferir", não "pagamento confirmado"; a
  conferência humana continua sendo o requisito.
- [Reenvios frequentes do mesmo pedido geram um e-mail por reenvio] → aceito por ora: o volume
  esperado é baixo (rate limit já existe na rota) e reenvio já é, por si, um evento que muda o
  que a serventia precisa olhar; não há mecanismo de agregação neste change.
- [`tenant.contacts.email` é o único destino; uma serventia sem ninguém monitorando essa caixa não
  ganha nada] → mesmo risco que já existe para `sendComplianceSubmittedEmails` e para os contatos
  institucionais em geral; fora do escopo deste change resolver roteamento por operador.


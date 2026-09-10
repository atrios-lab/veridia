## Why

Hoje, quando um cidadão paga o Pix do pedido e clica em "Já paguei" no acompanhamento de
protocolo, o comprovante fica anexado ao pedido e o andamento muda para "Pagamento informado" —
mas ninguém na serventia é avisado. O operador só descobre o pagamento se entrar no painel e
olhar a fila. Um e-mail para a serventia no momento do autorrelato fecha esse buraco sem exigir
que alguém fique vigiando a fila.

## What Changes

- Quando o cidadão informa pagamento (`reportPayment`, incluindo reenvio de comprovante), a
  serventia recebe um e-mail no seu contato institucional (`tenant.contacts.email`) avisando que
  há um pagamento informado a conferir, com protocolo, requerente (quando houver) e valor, e um
  botão que leva direto ao pedido no painel admin.
- O envio segue o mesmo padrão fire-and-forget dos demais avisos por e-mail do produto: nunca
  bloqueia nem falha a ação do cidadão, e uma falha do provedor só é registrada em log.
- Nenhuma mudança na conferência do comprovante em si: o e-mail é só o aviso; confirmar o
  pagamento (mudar o andamento para "Pago") continua manual, pelo painel.

## Non-Goals

- Não envia e-mail quando o operador confirma o pagamento manualmente (transição para "Pago"):
  quem faz essa transição já sabe que confirmou.
- Não substitui a conferência humana do comprovante nem confirma o pagamento sozinho.
- Não adiciona outro canal de aviso (SMS, WhatsApp, notificação in-app).
- Não integra gateway de pagamento nem webhook: o Pix continua "copia e cola" com autorrelato do
  cidadão, sem confirmação automática de recebimento.
- Não envia para e-mails de administradores individuais: o destino é só o contato institucional
  da serventia, mesmo padrão do aviso de adequação ao Provimento.
- Não adiciona preferência por serventia para desligar o aviso.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: novo requisito de aviso por e-mail à serventia quando o cidadão
  informa pagamento de um pedido, na direção oposta do requisito já existente de avisos ao
  cidadão.

## Impact

- `src/app/(public)/protocolo/actions.ts` (`reportPayment`): dispara o novo aviso após anexar o
  comprovante com sucesso.
- `src/lib/email/service-request.ts` (ou novo módulo irmão): nova função de envio, moldada em
  `notifyCitizen` (fire-and-forget via `after()`) e em `sendComplianceSubmittedEmails`
  (`src/lib/email/compliance.ts`) como referência de e-mail dirigido à serventia via
  `tenant.contacts.email`.
- `src/core/request/money.ts` (`formatCents`) reaproveitado para o valor no corpo do e-mail.
- Nenhuma migração de banco: usa infraestrutura de e-mail (Postmark) e o campo `tenant.contacts.email`
  já existentes.

## ADDED Requirements

### Requirement: Aviso por e-mail à serventia quando o cidadão informa pagamento
A serventia SHALL receber um aviso por e-mail no seu contato institucional
(`tenant.contacts.email`) toda vez que o cidadão usa "Já paguei" na consulta de protocolo para
anexar o comprovante de um pedido — seja o primeiro envio ou um reenvio. O aviso SHALL trazer o
número do protocolo, o nome do requerente quando houver, e o valor do pedido, além de um botão
que leva direto ao pedido no painel admin. O aviso é só o alerta de que há um comprovante a
conferir: ele NÃO SHALL confirmar o pagamento sozinho, essa transição continua manual pelo
painel. O envio SHALL ser fire-and-forget: falha do provedor de e-mail nunca falha o autorrelato
do cidadão nem impede o anexo do comprovante, e é só registrada em log.

#### Scenario: Primeiro comprovante avisa a serventia
- **WHEN** o cidadão usa "Já paguei" pela primeira vez num pedido com valor informado
- **THEN** a serventia recebe um e-mail com o protocolo, o requerente e o valor, com um botão que
  leva ao pedido no painel

#### Scenario: Reenvio de comprovante também avisa
- **WHEN** o pedido já está em "Pagamento informado" e o cidadão reenvia outro comprovante
- **THEN** a serventia recebe um novo aviso por e-mail sobre o reenvio

#### Scenario: Confirmação manual do operador não dispara este aviso
- **WHEN** o operador muda o andamento do pedido para "Pago" pelo painel
- **THEN** nenhum e-mail deste aviso é enviado, porque quem confirmou já sabe

#### Scenario: Falha no envio não quebra o autorrelato do cidadão
- **WHEN** o provedor de e-mail falha ao enviar o aviso à serventia
- **THEN** o comprovante continua anexado ao pedido e a tela do cidadão mostra sucesso normalmente

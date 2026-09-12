## Why

O produto já tem um padrão maduro de aviso por e-mail fire-and-forget, mas ele foi aplicado ponto
a ponto conforme cada fluxo surgiu, e ficaram lacunas dos dois lados. Do lado do cidadão, "Disponível
para retirada" — o único andamento que exige uma ida física ao balcão — não avisa, embora
"Concluído" avise; e quando um comprovante de pagamento é recusado e o pedido volta para
"Aguardando pagamento", o cidadão não é avisado de que precisa agir de novo, só descobre olhando
a consulta ou quando o prazo aperta. Do lado da serventia, a resposta do cidadão dentro da
conversa de uma exigência não gera aviso — só um sinal no painel que exige alguém abrir a fila —,
o mesmo silêncio que existia para "Já paguei" antes do change `payment-notification-email`; e um
requerimento LGPD ou uma manifestação de ouvidoria novos não avisam ninguém, apesar do relógio
legal de 15 dias correndo desde o registro.

## What Changes

- **Cidadão — "Disponível para retirada" passa a avisar.** Mesmo padrão dos avisos já existentes
  (sem conteúdo, só protocolo e instrução de consultar com a chave): entra na lista de andamentos
  citados no requisito "Avisos por e-mail nas ações que afetam o cidadão".
- **Cidadão — comprovante recusado (retorno de "Pagamento informado" para "Aguardando
  pagamento") passa a avisar.** É a única transição "para trás" da máquina de andamentos e a
  única em que o cidadão acredita ter uma ação pendente resolvida quando na verdade ela voltou a
  estar aberta.
- **Serventia — resposta do cidadão na conversa da exigência passa a avisar.** Espelha o aviso
  que já existe na direção contrária (`requirement-conversation`: "Aviso por e-mail na resposta
  da serventia"). O e-mail vai para `tenant.contacts.email`, com protocolo e nome do requerente
  quando houver, sem o texto da mensagem do cidadão.
- **Serventia — novo requerimento LGPD passa a avisar.** E-mail para `tenant.contacts.email` com
  o protocolo, sem o conteúdo do pedido do titular.
- **Serventia — nova manifestação de ouvidoria passa a avisar**, inclusive quando anônima (o
  aviso à serventia não depende do contato do manifestante, ao contrário dos avisos ao cidadão
  já existentes no canal). Sem nome, sem contato e sem o texto da manifestação no e-mail.
- Todos os envios seguem o mesmo contrato fire-and-forget já em uso: nunca bloqueiam nem falham a
  ação que os dispara, e uma falha do provedor só é registrada em log.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities

- `admin-service-requests`: o requisito "Avisos por e-mail nas ações que afetam o cidadão" passa
  a incluir "Disponível para retirada" e o retorno de "Pagamento informado" para "Aguardando
  pagamento" na lista de andamentos que avisam o cidadão.
- `requirement-conversation`: novo requisito espelhado do já existente "Aviso por e-mail na
  resposta da serventia" — agora a mensagem do cidadão na conversa avisa a serventia.
- `data-rights-channel`: novo requisito de aviso à serventia quando um requerimento é registrado.
- `ombudsman-channel`: novo requisito de aviso à serventia quando uma manifestação é registrada,
  inclusive anônima.

## Non-Goals

- Aviso ao cidadão quando "Pago" é confirmado manualmente, quando uma exigência é cumprida, ou
  quando um pedido é arquivado (individual ou em lote): são confirmações tranquilizadoras, não
  chamadas para ação, e o requisito existente já trata andamento intermediário como ruído.
- Aviso à serventia por novo pedido de serviço registrado online: depende de volume por serventia
  (pode virar spam que afoga os avisos acionáveis) e provavelmente pede um resumo periódico, não
  um e-mail por pedido — fora do escopo deste change, que só cobre casos de "evento raro e
  acionável", o mesmo padrão de `payment-notification-email`.
- Aviso quando o prazo de uma exigência é suspenso ou retomado (non-goal já registrado em
  `pausar-prazo-na-exigencia`).
- Qualquer canal além de e-mail, ou destino além do contato institucional da serventia
  (`tenant.contacts.email`) e do contato do requerente já usado pelos avisos existentes.
- Agregação ou throttling de avisos repetidos (ex.: várias respostas seguidas do cidadão na
  mesma exigência): cada evento gera seu próprio e-mail, mesmo padrão de "Já paguei".

## Impact

- `src/core/request/kinds.ts`: nenhuma mudança de enum — os andamentos "ready-for-pickup" e a
  transição `payment-reported → awaiting-payment` já existem; só o gatilho de e-mail é novo.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts` (troca de andamento): estende a
  condição que hoje só cobre `done`/`cancelled`/`rejected` para também cobrir `ready-for-pickup`
  e o retorno a `awaiting-payment` a partir de `payment-reported`.
- `src/app/(public)/protocolo/actions.ts` (`writeRequirementMessageAction`): novo disparo de
  aviso à serventia após gravar a mensagem do cidadão com sucesso.
- `src/app/(public)/lgpd/actions.ts` (`submitDataRights`): novo disparo de aviso à serventia após
  o registro.
- `src/app/(public)/ouvidoria/actions.ts` (`submitManifestation`): novo disparo de aviso à
  serventia após o registro, independente de identificação.
- `src/lib/email/service-request.ts`: reaproveita `notifyCitizen` para os dois casos do cidadão
  (nenhuma função nova ali) e ganha novas funções de aviso à serventia moldadas em
  `notifyOfficePaymentReported`, já existente no mesmo arquivo.
- Nenhuma migração de banco: usa a infraestrutura de e-mail (Postmark) e os campos já existentes
  (`tenant.contacts.email`, contato do requerente/titular/manifestante).

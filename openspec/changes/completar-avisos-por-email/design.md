## Context

O produto tem hoje dois padrões de e-mail já consolidados, ambos fire-and-forget via `after()`:

- **Aviso ao cidadão** (`notifyCitizen`, em `src/lib/email/service-request.ts`): usado em sete
  pontos diferentes (pedido recebido, exigência registrada, valor informado, documento
  disponível, formulário anexado, mensagem da serventia na exigência, conclusão/cancelamento/
  indeferimento). Sempre sem conteúdo — só protocolo e instrução de consultar com a chave — porque
  o e-mail é o único canal que a serventia não controla e o conteúdo mora atrás da chave de
  acesso. Confere bounce permanente antes de agendar o envio, porque o contato vem de formulário
  público e pode já ter voltado antes.
- **Aviso à serventia** (`notifyOfficePaymentReported`, mesmo arquivo, `sendComplianceSubmittedEmails`
  em `src/lib/email/compliance.ts`): sempre para `tenant.contacts.email`, sempre com o cartão
  `renderEmailCardHtml`/`renderEmailCardText` (botão para o painel), sempre com mais conteúdo no
  corpo (protocolo, requerente, valor) porque o destinatário já é autenticado no painel — não há
  chave a proteger. Sem checagem de bounce, porque o contato é config da própria serventia, não
  um dado de formulário público.

Este change não cria padrão novo: aplica os dois padrões existentes a quatro pontos onde eles
ainda não chegaram. O trabalho é, em essência, replicar `notifyOfficePaymentReported` para três
eventos novos (resposta do cidadão na exigência, requerimento LGPD novo, manifestação de ouvidoria
nova) e estender a condição já existente de `notifyCitizen` em `changeRequestStatusAction` para
dois andamentos que faltam.

## Goals / Non-Goals

**Goals:**
- Fechar as lacunas identificadas na exploração sem inventar mecanismo novo: cada um dos quatro
  pontos usa a função e o template que o padrão equivalente já usa em outro lugar do produto.
- Manter a garantia fire-and-forget em todos os quatro pontos: nenhum e-mail deste change pode
  falhar a ação do cidadão ou do operador que o dispara.
- Manter a regra de conteúdo: nada que hoje fica atrás da chave de acesso do cidadão passa a
  vazar no e-mail à serventia (nem o texto da mensagem do cidadão na exigência, nem a descrição
  do requerimento LGPD, nem a mensagem da manifestação de ouvidoria).

**Non-Goals:**
- Resumo periódico ou agregação de eventos (fica para se e quando o volume de pedidos online
  justificar um change à parte — ver Non-Goals da proposta).
- Preferência por serventia para desligar qualquer um destes avisos.
- Qualquer mudança na máquina de andamentos (`kinds.ts`) ou nas transições permitidas — os dois
  andamentos do lado do cidadão (`ready-for-pickup`, retorno a `awaiting-payment`) já existem e já
  são alcançáveis pela UI de troca de andamento.

## Decisions

**"Disponível para retirada" e o retorno a "Aguardando pagamento" entram na mesma condição que já
existe em `changeRequestStatusAction`, não em uma nova.** A função já centraliza "quais andamentos
avisam o cidadão" num único `if (status === "done" || status === "cancelled" || status ===
"rejected")` com um `switch` de assunto/corpo. Estender essa mesma condição para os dois novos
casos mantém um único lugar de verdade sobre "quais andamentos falam com o cidadão", em vez de
espalhar `notifyCitizen` em condicionais novas.

**Retorno a `awaiting-payment` distingue "veio de `payment-reported`" de "nunca teve valor
informado".** A transição `awaiting-payment → payment-reported → awaiting-payment` (comprovante
recusado) precisa de aviso; a gravação inicial em `awaiting-payment` (quando o valor é informado
pela primeira vez) já tem seu próprio aviso ("Valor do pedido informado") e não pode duplicar.
A distinção é o status **anterior** do pedido, não o novo: só avisa quando `request.status` antes
da troca era `payment-reported`.

**Assunto e corpo do aviso de comprovante recusado dizem "recusado", não "aguardando
pagamento".** Reaproveitar o texto genérico de "Valor do pedido informado" confundiria com a
notificação original. O corpo precisa deixar claro que havia um comprovante em análise e ele não
foi aceito, sem carregar o motivo (que, como toda motivação de troca de andamento, fica atrás da
chave — a consulta já mostra o andamento atual).

**Aviso de resposta do cidadão na exigência vira uma função nova em
`src/lib/email/service-request.ts` (`notifyOfficeRequirementReply` ou nome equivalente), moldada
em `notifyOfficePaymentReported`, não uma variação dela.** Os dois têm o mesmo padrão (cartão,
`tenant.contacts.email`, botão para o painel) mas payloads diferentes (aqui não há valor nem
comprovante, só protocolo e requerente) — replicar a estrutura é mais simples que generalizar uma
função para dois formatos de corpo.

**Avisos de LGPD e ouvidoria vivem em módulos próprios, não em `service-request.ts`.** Seguindo o
precedente já estabelecido para os avisos ao cidadão desses dois canais (que vivem dentro de
`submitDataRights`/`submitManifestation`, chamando `notifyCitizen` importado de
`service-request.ts` mesmo sendo domínios diferentes) — mas para o **aviso à serventia**, o
padrão mais próximo é `sendComplianceSubmittedEmails` (`compliance.ts`): um domínio à parte com
sua própria função de envio. Como LGPD e ouvidoria já têm cada um seu próprio arquivo de ações
(`lgpd/actions.ts`, `ouvidoria/actions.ts`) mas nenhum módulo de e-mail próprio ainda, a opção é
entre (a) duas funções novas dentro de `service-request.ts`, ainda que o domínio não seja
service-request, ou (b) um módulo de e-mail próprio por canal. Como cada canal só ganha **uma**
função de e-mail nova cada (o aviso à serventia; o aviso ao cidadão já existe via `notifyCitizen`
compartilhado), um módulo dedicado por canal seria overhead para uma função só — a decisão é
colocar as duas em `service-request.ts` mesmo, com nomes que deixam claro o canal
(`notifyOfficeDataRightsSubmitted`, `notifyOfficeManifestationSubmitted`), documentando no
comentário de cada uma que o arquivo hospeda avisos de mais de um domínio por conveniência, não
porque sejam a mesma coisa.

**Manifestação anônima gera aviso à serventia do mesmo jeito que a identificada.** O aviso ao
cidadão distingue anônima de identificada porque não há contato para mandar; o aviso à serventia
não depende do contato do manifestante — vai sempre para `tenant.contacts.email` — então a
distinção não se aplica. O corpo do e-mail à serventia nunca inclui nome nem contato do
manifestante (mesmo quando identificado): só o número de registro, porque abrir o painel para ver
o conteúdo é o próprio ponto do aviso, e o sigilo interno da manifestação (quando marcado) não deve
ser furado por um e-mail que passa por caixas de entrada compartilhadas.

**Sem checagem de bounce em nenhum dos quatro pontos novos.** Os três avisos à serventia seguem
`notifyOfficePaymentReported` (contato de config, sem checagem). Os dois avisos ao cidadão
reaproveitam `notifyCitizen`, que já checa bounce internamente — nada muda aí.

## Risks / Trade-offs

- [Um pedido que oscila entre "Pagamento informado" e "Aguardando pagamento" várias vezes (vários
  comprovantes recusados seguidos) gera um e-mail por recusa] → aceito, mesmo trade-off já aceito
  em `payment-notification-email` para reenvios: o volume esperado é baixo e cada recusa é, por si,
  uma mudança que o cidadão precisa saber.
- [Uma serventia que recebe muitas respostas de cidadãos em exigências simultâneas passa a ver um
  e-mail por resposta, sem agregação] → aceito por ora, mesmo padrão do "Já paguei"; fica como
  candidato a resumo periódico se o volume incomodar.
- [O aviso de manifestação anônima à serventia, mesmo sem nome, ainda revela "existe uma
  manifestação nova" para quem lê a caixa institucional — que pode não ser quem trata ouvidoria]
  → aceito: é o mesmo destino (`tenant.contacts.email`) que já recebe avisos de adequação e de
  pagamento; roteamento por setor dentro da serventia é non-goal deste e dos changes anteriores
  que usaram o mesmo contato.
- [Reaproveitar `service-request.ts` para avisos de LGPD e ouvidoria mistura domínios num arquivo
  cujo nome sugere só pedidos de serviço] → aceito conscientemente pela razão de custo/benefício
  acima; documentado no comentário de cada função nova para não parecer acidente na próxima
  leitura.

## Open Questions

- Nenhuma bloqueante para implementação. O volume de pedidos online por serventia (que decide se
  um aviso de "pedido novo" faz sentido como e-mail direto ou como resumo) fica para um change
  separado, fora do escopo daqui.

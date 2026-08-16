# Service Request Legacy Parity

## Why

O veridia vai substituir o cartorio-marinho em produção, e a comparação módulo a módulo do canal de pedidos encontrou capacidades que o legado tem e o cidadão já usa — e que sumiriam na troca. Três são graves: o cidadão deixa de ser avisado por e-mail (5 gatilhos no legado, zero no veridia), os aceites LGPD são validados e descartados (o legado os grava como prova — art. 8 §2, a prova do consentimento cabe ao controlador), e a conversa da exigência (o cidadão pergunta por escrito, a serventia responde no mesmo lugar) não existe. Além disso o painel fala 8 andamentos genéricos onde o registrador trabalha com 18 do fluxo registral real.

## What Changes

- **Conversa na exigência** (design aprovado, tela "Perguntas do cidadão"): dentro do card da exigência, dos dois lados — o cidadão escreve pela consulta com chave (com anexos na mensagem), a serventia responde pelo painel. A conversa encerra quando a exigência é cumprida.
- **BREAKING (comportamento): cumprir a exigência passa a ser ação do operador.** Hoje o anexo do cidadão marca a exigência como cumprida automaticamente; passa a ser o cartório quem declara cumprida (como no legado). Anexo do cidadão vira resposta na conversa.
- **Editar e excluir exigência pendente** pelo operador; cumprida é imutável.
- **E-mails de aviso ao cidadão** (sem conteúdo, só "consulte com sua chave"): pedido recebido, exigência registrada, resposta da serventia na conversa, concluído/cancelado, documento de entrega disponível.
- **Aceites LGPD e de veracidade persistidos** com data, no registro do pedido.
- **18 andamentos**: os 8 atuais mais os 10 do fluxo registral (protocolado, prenotado, em qualificação, com exigência, aguardando exigência, em processamento, registrado, averbado, deferido, disponível p/ retirada). Identificadores em inglês, como o resto do produto — a coluna `status` é compartilhada pelos quatro canais, e adotar o português do legado só nos pedidos deixaria vocabulário misto permanente. Nenhum dado existente muda; o de-para pt→en fica no design, para a change de migração.
- **Operador anexa documento do cidadão** (balcão: o cidadão chega com o papel, quem atende digitaliza e anexa).

Fora do escopo (decidido): retenção/expurgo fica para change própria; os demais canais (agendamento, LGPD, ouvidoria) não mudam.

## Capabilities

### New Capabilities

- `requirement-conversation`: a conversa dentro do card da exigência — mensagens bidirecionais com autor e hora, anexos na mensagem, aviso por e-mail na resposta da serventia, rate limit próprio na escrita do cidadão, encerramento no cumprimento.

### Modified Capabilities

- `service-request`: aceites do formulário passam a ser persistidos com data (prova de consentimento); e-mail de confirmação no protocolo criado.
- `admin-service-requests`: andamentos passam de 8 para 18 (vocabulário do legado); cumprimento da exigência vira ação do operador; exigência pendente ganha editar/excluir; operador pode anexar documento do cidadão; ações do operador que afetam o cidadão disparam aviso por e-mail.

## Impact

- **Schema/migração**: tabela nova `service_request_requirement_messages` e coluna `requirement_message_id` em `service_request_attachments`. Puramente aditiva, sem SQL de dados. Gerada com `pnpm db:generate`; aplicada pelo usuário.
- **Código**: `src/core/request/kinds.ts` (lista de andamentos, sugestões, labels), `src/core/request/` (novo módulo da conversa), `src/lib/service-request.ts` (mensagens, cumprimento por operador, edição/exclusão de exigência), `src/lib/email/` (gatilhos novos), consulta pública (`protocolo/`), painel (`admin/pedidos/`), e2e dos dois lados.
- **Comportamento existente que muda**: fulfillRequirement do cidadão (deixa de marcar cumprida); barra de progresso da fila (18 não cabem — colapsa em fases); SUGGESTED_NEXT_STATUSES reescrito.
- **Sem dependência nova.** Infra de e-mail já existe (`src/lib/email`, hoje usada só por convites).

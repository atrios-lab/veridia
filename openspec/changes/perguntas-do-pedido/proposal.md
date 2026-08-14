# Perguntas do pedido (Entrega 12)

## Why

Hoje o cidadão que tem uma dúvida sobre o próprio pedido não tem canal escrito atrelado ao protocolo: o card "Dúvida sobre este pedido?" da consulta só oferece WhatsApp e telefone, tirando a conversa do sistema e obrigando o operador a checar outro canal sem contexto. A Entrega 12 adiciona um registro de perguntas e respostas anexado ao protocolo — não é chat em tempo real — visível nas duas telas que já existem: consulta do cidadão e detalhe do pedido no painel.

**Referência de UI (validada):** `temp/Redesign 12 - Perguntas do Pedido.html`. O arquivo mostra as duas telas completas com o novo bloco em contexto: a consulta do cidadão no celular (mock de 390px de largura) e o painel administrativo no computador (mock de 1440px). É a fonte de verdade visual desta entrega — layout, copy e comportamento dos cards descritos abaixo vêm dele.

## What Changes

- **Consulta do cidadão (tela 2, `protocol-lookup.tsx`)**: novo card "Perguntas sobre este pedido" no detalhe destravado por protocolo + chave, com:
  - histórico de perguntas e respostas em balões, com autor ("Você" / nome da serventia) e data/hora de cada mensagem;
  - campo "Escreva sua pergunta…" e botão "Enviar pergunta", sem pedir e-mail nem telefone;
  - selo de status derivado: "Aguardando resposta" quando a última mensagem é do cidadão, "Respondida" quando é da serventia;
  - texto de expectativa "o cartório responde em até 1 dia útil" (sem presença online nem indicador de "digitando");
  - atalhos WhatsApp/Ligar preservados no rodapé do card (substituem o card "Dúvida sobre este pedido?" atual).
- **Painel administrativo (tela 6b, `pedidos/[protocolo]`)**: novo card "Perguntas do cidadão" no detalhe do pedido, com a mesma thread (nome real do cidadão e do operador), composer "Responder ao cidadão…" com botão "Enviar resposta" e o mesmo selo de status.
- **Auditoria**: cada pergunta e cada resposta gera entrada no `audit_log` (`service-request.question` / `service-request.question.reply`) e aparece no card "Histórico" do detalhe, junto das demais ações.
- **Notificação por e-mail**: quando o operador responde, o cidadão é avisado por e-mail (contato já informado no pedido) para consultar o protocolo — primeira notificação ativa ao cidadão da plataforma, usando a infra Resend existente. O e-mail não contém a chave nem o teor da resposta. Obs.: a premissa da US-06 ("do mesmo jeito que já sou avisado de exigência ou documento pronto") não existe no código hoje — este item cobre só a resposta de pergunta; os demais eventos continuam fora (ver Non-Goals).
- **Banco**: nova tabela `service_request_questions` (aditiva, mesmo precedente de `service_request_requirements`).

## Non-Goals

- **Chat em tempo real**: sem polling, presença, "digitando" ou expectativa de resposta imediata (US-07). Conversa síncrona já tem canal próprio (Atendimento online).
- **Envio ativo por WhatsApp**: não há provedor de API de WhatsApp na plataforma; WhatsApp continua sendo link `wa.me`. Se um provedor entrar, é entrega própria.
- **Notificar exigência ou documento pronto**: generalizar notificações ao cidadão para os demais eventos do pedido é entrega própria (não-objetivo já registrado em `add-admin-channel-queues` e `improve-protocol-timeline`); aqui só se notifica a resposta de pergunta. A copy da consulta que hoje promete aviso de documento pronto não é alterada por esta mudança.
- **Notas internas na thread**: diferente do chat, a thread de perguntas não tem mensagens invisíveis ao cidadão. Anotação interna continua fora do escopo.
- **Anexos em perguntas/respostas**: arquivo entra pelos fluxos que já existem ("Anexar outro documento", exigências, entrega).
- **Perguntas nos demais tipos de protocolo** (agendamento, LGPD, ouvidoria): esses canais já têm `officeReply` próprio; o escopo aqui é só `kind = service-request`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: consulta detalhada por protocolo + chave passa a exibir a thread de perguntas, permitir envio de pergunta pelo cidadão, mostrar selo de status e disparar e-mail quando a serventia responde.
- `admin-service-requests`: detalhe do pedido no painel passa a exibir a thread, permitir resposta do operador (`requests.manage`) e registrar pergunta/resposta no histórico de auditoria.

## Impact

- `src/core/request/question.ts` (novo): schema Zod do corpo da mensagem, tipos de autor, derivação do status da thread, texto do e-mail de aviso; testes colocalizados.
- `src/db/schema.ts` + migração Drizzle aditiva: tabela `service_request_questions`.
- `src/lib/service-request.ts`: leitura da thread e escrita de pergunta (cidadão, via protocolo + chave) e resposta (operador), com `recordAudit`.
- `src/lib/email/*`: reaproveitado para o aviso de resposta (novo template curto).
- `src/app/(public)/protocolo/protocol-lookup.tsx` + `actions.ts`: card do cidadão e server action de envio de pergunta (rate-limit igual às demais ações públicas).
- `src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx` + `_components/` + `actions.ts`: card do operador, server action de resposta, novos rótulos em `HISTORY_LABELS`.
- Testes: unit (core), PGlite (tabela nova), e2e Playwright (cidadão e admin).

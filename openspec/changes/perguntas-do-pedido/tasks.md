# Tasks — Perguntas do pedido

## 1. Núcleo do domínio

- [x] 1.1 Criar `src/core/request/question.ts` com `QUESTION_AUTHOR_TYPES` (`citizen` | `staff`), `questionBodySchema` (trim → colapso de espaços → obrigatório → máx. 2000, mensagens pt-BR, mesmo formato de `requirementTextSchema`), `deriveQuestionThreadStatus(messages)` (`awaiting-reply` | `answered` | `none`) e `buildQuestionAnsweredEmailText({tenantName, protocolNumber})` sem chave nem teor da resposta; incluir helper conservador `isEmailContact(contact)`.
- [x] 1.2 Criar `src/core/request/question.test.ts` (node --test, nomes em inglês) cobrindo validação do corpo, derivação do status (vazio, última do cidadão, última da serventia) e detecção de e-mail no contato.

## 2. Banco de dados

- [x] 2.1 Adicionar `serviceRequestQuestions` em `src/db/schema.ts`: `id`, `tenantSlug`, `requestId` (FK `service_requests` cascade), `authorType`, `authorId` (FK `user`, null para cidadão), `body`, `createdAt`, índice `(request_id, created_at)`; doc comment explicando por que é tabela e não JSON (dois escritores), como em `serviceRequestRequirements`.
- [x] 2.2 Gerar migração Drizzle aditiva (`pnpm drizzle-kit generate`) e conferir com `scripts/check-destructive.mjs`.
- [x] 2.3 Criar teste PGlite `src/db/service-request-questions.test.ts` (padrão de `src/db/chat.test.ts`): forma da tabela, cascade na exclusão do pedido, índice.

## 3. Camada de dados (`src/lib/service-request.ts`)

- [x] 3.1 Implementar `listQuestions(tenantSlug, requestId)` (ordem cronológica, join com `user` para nome do operador) e incluir a thread no retorno de `findByProtocolWithKey` (nunca no lookup público sem chave).
- [x] 3.2 Implementar `addCitizenQuestion` (valida com `questionBodySchema`, grava mensagem `citizen`, `recordAudit` com ação `service-request.question`, `actorId: null`, `targetId: requestId`).
- [x] 3.3 Implementar `addStaffQuestionReply` (valida, grava mensagem `staff` com `authorId`, `recordAudit` com `service-request.question.reply` e `targetId: requestId`; em seguida, best-effort em try/catch, envia o e-mail de aviso via `src/lib/email/` quando `isEmailContact` no contato do pedido — falha só loga, nunca reverte a resposta).
- [x] 3.4 Adicionar template curto de aviso em `src/lib/email/` reaproveitando `render.ts`/`send.ts`, com texto vindo de `buildQuestionAnsweredEmailText`.

## 4. Consulta do cidadão (tela 2)

- [x] 4.1 Criar server action `submitQuestionAction` em `src/app/(public)/protocolo/actions.ts` no formato das existentes (`attachExtraDocument`): tenant → seção habilitada → protocolo + chave → `isRateLimited` → `addCitizenQuestion`; estado de erro em português.
- [x] 4.2 Em `protocol-lookup.tsx`, substituir o card "Dúvida sobre este pedido?" pelo card "Perguntas sobre este pedido" do design validado (`temp/Redesign 12 - Perguntas do Pedido.html`, mock mobile de 390px): thread com balões ("Você" / nome da serventia, data/hora via `Intl.DateTimeFormat("pt-BR")`), selo derivado ("Aguardando resposta"/"Respondida", sem selo quando vazio), texto "o cartório responde em até 1 dia útil", composer "Escreva sua pergunta…" + botão "Enviar pergunta" (`useActionState`, protocolo + chave em campos ocultos, mensagens inline `role="alert"`), rodapé "Prefere falar direto?" com os atalhos WhatsApp/Ligar existentes; só tokens `--color-brand-*`.

## 5. Painel administrativo (tela 6b)

- [x] 5.1 Criar server action `replyQuestionAction` em `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts` no formato existente (`authorize()` → parse → try/catch com `console.error("pedidos.reply-question", …)` → `addStaffQuestionReply` → `revalidateAdmin()`).
- [x] 5.2 Criar `_components/questions-section.tsx` com o card "Perguntas do cidadão" do design validado (`temp/Redesign 12 - Perguntas do Pedido.html`, mock desktop de 1440px): thread (nome do solicitante / nome do operador, data/hora), selo derivado, subtítulo "O que você responder aqui aparece na consulta do cidadão pelo protocolo…", composer "Responder ao cidadão…" + "Enviar resposta" com toast `sonner` no handler; montar na coluna esquerda de `page.tsx` carregando `listQuestions` em paralelo com as demais consultas.
- [x] 5.3 Adicionar `service-request.question` ("enviou uma pergunta") e `service-request.question.reply` ("respondeu uma pergunta do cidadão") ao `HISTORY_LABELS` de `page.tsx`.

## 6. Verificação

- [x] 6.1 E2E público em `e2e/` (padrão `service-request.spec.ts`, viewport 390px): card visível no detalhe destravado, envio de pergunta, selo "Aguardando resposta", pergunta vazia rejeitada.
- [x] 6.2 E2E admin (padrão `admin-service-requests.spec.ts`, serial, skip sem `DATABASE_URL`): operador vê pergunta seedada, responde, selo vira "Respondida", histórico mostra o evento; conferir que a resposta aparece na consulta do cidadão.
- [x] 6.3 Rodar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens`, `pnpm check:dashes`, `pnpm e2e` e `openspec validate perguntas-do-pedido --type change --strict`.

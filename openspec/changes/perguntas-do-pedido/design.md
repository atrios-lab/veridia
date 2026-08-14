# Design — Perguntas do pedido

## Context

- A consulta do cidadão (`src/app/(public)/protocolo/protocol-lookup.tsx`) já destrava o detalhe por protocolo + chave via server action (`lookupProtocolDetail` em `actions.ts`), e todas as escritas do cidadão seguem o mesmo formato: protocolo + chave em campos ocultos → `isRateLimited` → verificação da chave → ação (`attachExtraDocument`, `fulfillRequirementAction` etc.). O card "Dúvida sobre este pedido?" (linhas ~1095–1113) só oferece WhatsApp/Ligar.
- O detalhe no painel (`src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx`) monta cards por seção em `_components/`, com actions que passam por `authorize()` (`requests.manage`) e `revalidatePath("/admin", "layout")`. O card "Histórico" lê `listRequestHistory` (join `audit_log` × `user`) com rótulos em `HISTORY_LABELS`.
- Precedente de dados: `service_request_requirements` é uma tabela própria justamente porque dois escritores (cidadão e operador) não podem disputar um blob JSON. O chat (`chat_messages`) é o precedente de thread, mas carrega maquinário de tempo real (polling, token de cookie, notas internas) que esta entrega explicitamente não quer.
- Notificação ativa ao cidadão não existe hoje (confirmado por busca no repositório: Resend só é usado para convite/troca de senha de contas admin; WhatsApp é só link `wa.me`). A US-06 presume um comportamento ("como já sou avisado de exigência") que nunca foi implementado.

## Goals / Non-Goals

**Goals:**
- Thread de perguntas e respostas atrelada ao protocolo, visível nas duas telas existentes, com status derivado e auditoria.
- Escrita do cidadão sem e-mail/telefone, na mesma regra de acesso do detalhe (protocolo + chave).
- Aviso por e-mail ao cidadão quando a serventia responde, reaproveitando a infra Resend.

**Non-Goals:**
- Tempo real (polling, presença, "digitando"), notas internas, anexos na thread, WhatsApp ativo, notificação dos demais eventos do pedido, perguntas em protocolos de outros tipos (agendamento, LGPD, ouvidoria).

## Decisions

### 1. Tabela própria `service_request_questions`, não JSON nem reuso do chat
Colunas: `id`, `tenant_slug`, `request_id` (FK → `service_requests`, cascade), `author_type` (`citizen` | `staff`), `author_id` (FK → `user`, null para cidadão), `body`, `created_at`; índice `(request_id, created_at)`.
- JSON em `details` foi rejeitado pelo mesmo motivo documentado em `service_request_requirements`: cidadão e operador escrevem concorrentemente.
- Reusar `chat_messages`/`chat_conversations` foi rejeitado: o chat tem ciclo de vida próprio (conversa, capacidade, horário, token de cookie, `note`), e amarrar a thread do pedido a esse maquinário traria semântica de tempo real que a entrega proíbe. A tabela nova tem 7 colunas e zero estado de conversa.

### 2. Status derivado, sem coluna
"Aguardando resposta" / "Respondida" é função pura da última mensagem (`author_type` da mais recente), calculada no núcleo (`deriveQuestionThreadStatus`). Coluna de status foi rejeitada: seria cache de algo trivial de derivar e mais um escritor para sincronizar.

### 3. Server actions + revalidate, sem Route Handler de polling
O cidadão envia pergunta por server action em `(public)/protocolo/actions.ts` (mesmo formato das ações existentes: protocolo + chave ocultos, `isRateLimited`, `findByProtocolWithKey`); o operador responde por action em `pedidos/[protocolo]/actions.ts` (formato `authorize()` → zod → try/catch → `revalidateAdmin()`). Polling com cursor `?after=` (padrão do chat) foi rejeitado: US-07 declara que não há expectativa de resposta imediata — recarregar a consulta já basta.

### 4. Núcleo puro em `src/core/request/question.ts`
`questionBodySchema` (trim → colapso de espaços → mínimo/máximo com mensagens pt-BR, teto de 2000 caracteres), `QUESTION_AUTHOR_TYPES`, `deriveQuestionThreadStatus`, e `buildQuestionAnsweredEmailText` (texto do aviso, sem chave e sem teor da resposta — segue o precedente de `buildAccountEmailText` em `src/core/auth/invite.ts`). Camada de I/O em `src/lib/service-request.ts`: `listQuestions`, `addCitizenQuestion`, `addStaffQuestionReply`.

### 5. Auditoria com `targetId = requestId`
`addCitizenQuestion` grava `recordAudit` com ação `service-request.question` e `actorId: null` (mesmo padrão de `fulfillRequirement` — cidadão não tem conta); `addStaffQuestionReply` grava `service-request.question.reply` com o operador. Ambos com `targetType: "service-request"` e `targetId: requestId` — evitando deliberadamente o bug conhecido de `updateRequestStatus`, que grava o status como `targetId` e some do histórico. Novos rótulos entram em `HISTORY_LABELS` do detalhe.

### 6. E-mail de aviso best-effort, dentro da resposta
O envio acontece após gravar a resposta, num `try/catch` que só loga em falha — resposta registrada nunca é revertida por erro de e-mail. Destinatário: o campo de contato do pedido quando for e-mail (validação simples no núcleo); contato telefônico → sem envio. Fila/retry foi rejeitado: `send.ts` já degrada para `console.log` sem `RESEND_API_KEY`, e o aviso é conveniência, não garantia. A copy existente que promete aviso de "documento pronto" não é tocada nesta entrega (non-goal registrado no proposal).

### 7. UI segue o design validado, com tokens do tema
Referência visual: `temp/Redesign 12 - Perguntas do Pedido.html` (é um bundle de ferramenta de design — o markup real das telas está no bloco `<script type="__bundler/template">`). Ele define os dois contextos: consulta do cidadão no celular (mock de 390px, mesmo viewport dos e2e públicos) e painel no computador (mock de 1440px). Card do cidadão substitui o card "Dúvida sobre este pedido?" mantendo os atalhos WhatsApp/Ligar no rodapé ("Prefere falar direto?"). Cores/hex do HTML de referência não entram no código: tudo via tokens `--color-brand-*` (público) e `--color-admin-*` (painel) já definidos em `@theme` (`pnpm check:tokens` garante). Público usa mensagens inline (`role="alert"`/`<output>`); painel usa `sonner` no handler de submit, como os demais cards.

## Risks / Trade-offs

- [Cidadão pode enviar volume de perguntas abusivo] → mesmo `isRateLimited` das demais ações públicas + limite de 2000 caracteres; sem limite de perguntas por pedido nesta entrega (aceito — exige chave válida, superfície pequena).
- [E-mail de aviso é a primeira notificação ao cidadão e pode criar expectativa de avisos nos demais eventos] → escopo declarado no proposal; texto do e-mail fala só da pergunta respondida.
- [Contato do pedido é campo único e-mail/WhatsApp — detecção de e-mail pode errar] → detecção conservadora (regex simples de e-mail); em dúvida, não envia; a resposta continua visível na consulta.
- [Sem tempo real, o cidadão pode reenviar a mesma pergunta achando que não foi] → a pergunta aparece imediatamente na thread após o submit (revalidação da action) com selo "Aguardando resposta".
- [Migração] → puramente aditiva (tabela nova), um deploy, sem fase contract.

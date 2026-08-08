## 1. Núcleo do domínio (`src/core/chat`)

- [x] 1.1 `src/core/chat/conversation.ts` (novo): tipos `ConversationStatus`
      (`waiting`/`active`/`closed`), `ClosedReason` (`citizen`/`inactivity`/`staff`), schema Zod
      do pré-chat (nome, contato, assunto, protocolo opcional), sem I/O.
- [x] 1.2 `src/core/chat/hours.ts` (novo): `isWithinChatHours(tenant, now)` reaproveitando
      `isBusinessDay`/`nationalHolidays` de `src/core/scheduling/calendar.ts` e
      `tenant.scheduling.startHour/endHour`.
- [x] 1.3 `src/core/chat/inactivity.ts` (novo): `isStale(conversation, now)` (10 minutos sem
      mensagem do cidadão) e `needsInactivityWarning(conversation, now)` (aviso ~2 minutos antes),
      puras, testáveis com `Date` injetado.
- [x] 1.4 `src/core/chat/capacity.ts` (novo): `MAX_CONCURRENT_CONVERSATIONS = 3` e
      `canAssign(activeCountForUser)`.
- [x] 1.5 `src/core/chat/canned-responses.ts` (novo): lista fixa (saudação, pedir documento,
      horário de funcionamento, encerramento), texto em português vindo daqui, não hardcoded na UI.
- [x] 1.6 `src/core/chat/message.ts` (novo): schema Zod do corpo da mensagem (tamanho máximo,
      não vazia), tipos `AuthorType`.
- [x] 1.7 Testes: `conversation.test.ts`, `hours.test.ts`, `inactivity.test.ts`,
      `capacity.test.ts`, `message.test.ts`.

## 2. Banco de dados

- [x] 2.1 `src/db/schema.ts`: tabela `chatConversations` (colunas conforme design.md — status,
      dados do pré-chat, `matchedRequestId` FK `service_requests`, `sourcePath`,
      `assignedUserId` FK `user`, `assignedSector`, `lastActivityAt`, `waitingSince`, `closedAt`,
      `closedReason`, `linkedRequestId` FK `service_requests`, `rating`, `ratingComment`,
      `wantsTranscriptEmail`, `createdAt`); index em `(tenant_slug, status)` e em
      `(tenant_slug, waiting_since)`.
- [x] 2.2 `src/db/schema.ts`: tabela `chatMessages` (`conversationId` FK cascade, `authorType`,
      `authorUserId` FK `user` opcional, `body`, colunas de anexo espelhando
      `serviceRequestAttachments`, `createdAt`); index em `(conversation_id, created_at)`.
- [x] 2.3 `src/db/auth-schema.ts`: colunas `chat_status` (`available`/`busy`/`away`, default
      `available`) e `chat_sector` (texto opcional, valor de `Attribution`) em `user`; atualizar
      `USER_ADDITIONAL_FIELDS` em `src/db/auth-schema.ts`.
- [x] 2.4 Rodar `drizzle-kit generate`, conferir a migração gerada, commitar junto.
- [x] 2.5 `src/db/chat.test.ts` (PGlite): cascata de exclusão de mensagens ao excluir conversa,
      índices usados pelas consultas de fila e sondagem.

## 3. Permissões e presença do atendente

- [x] 3.1 `src/core/auth/roles.ts`: permissões `chat.manage` (admin + staff) e `chat.settings`
      (admin).
- [x] 3.2 `src/core/auth/roles.test.ts`: cobrir as duas permissões novas.
- [x] 3.3 `scripts/seed-admin.ts`: `ADMIN_SEED_CHAT_SECTOR` opcional (validado contra
      `ATTRIBUTIONS`), passado como `chatSector` na criação do usuário — `invite-admin.ts` só emite
      token para um usuário já existente, não cria um, então o campo não se aplica lá.

## 4. Camada de dados e Route Handlers de sondagem

- [x] 4.1 `src/lib/chat.ts` (novo): `startConversation(tenantSlug, prechat, sourcePath)` — tenta
      casar `informedProtocolNumber` com `service_requests` (via `findByProtocol`), cria
      `chatConversations` em `waiting`. Horário/interruptor são checados pelo Route Handler antes
      de chamar (4.8), não dentro da função — mesma separação já usada em `service-request.ts`
      entre regra de permissão/estado (chamador) e escrita (`lib`).
- [x] 4.2 `src/lib/chat.ts`: `getConversationForCitizen(tenantSlug, token)` — resolve pelo hash do
      cookie, aplica `isStale`/fecha se necessário antes de devolver (`closeIfStale`, usado também
      por `getConversation`, o equivalente do lado do painel).
- [x] 4.3 `src/lib/chat.ts`: `sendMessage(tenantSlug, conversationId, authorType, body, {
      actorUserId?, attachment? })` — grava mensagem, atualiza `lastActivityAt` quando o autor é o
      cidadão.
- [x] 4.4 `src/lib/chat.ts`: `assignConversation(tenantSlug, conversationId, userId)` — checa
      `canAssign`, grava `assignedUserId`/`assignedSector` (copiado de `user.chat_sector`), muda
      para `active`; `WHERE status = 'waiting'` na própria atualização é o que recusa a segunda
      atribuição de uma corrida.
- [x] 4.5 `src/lib/chat.ts`: `transferConversation(tenantSlug, conversationId, toUserId | null,
      note, actorUserId)` — exige nota não vazia, grava mensagem `system` (aviso ao cidadão) e
      `note` (justificativa), `toUserId` nulo devolve à fila geral (`waiting`, sem atendente).
- [x] 4.6 `src/lib/chat.ts`: `closeConversation(tenantSlug, conversationId, actor, { linkedRequestId?,
      rating?, ratingComment?, wantsTranscriptEmail? })` — `actor` é `{kind:"staff",userId}
      |{kind:"citizen"}|{kind:"inactivity"}`, união discriminada em vez de string solta (mesma
      informação de `actorUserId | "citizen" | "inactivity"`, sem o risco de um id de usuário
      colidir com a palavra "citizen").
- [x] 4.7 `src/lib/chat.ts`: `waitingConversations(tenantSlug)`, `waitingCount(tenantSlug)` (para o
      contador da sidebar), `queuePosition(tenantSlug, conversationId)`, `colleagues(tenantSlug,
      excludeUserId?)` (nome, status, carga atual, setor), `attendantSummary(userId)`,
      `setChatStatus(userId, status)`, `isChatEnabled`/`setChatEnabled` (interruptor da serventia,
      guardado em `tenantContent` sob a chave `office-chat` — mesmo padrão de `office-contact`
      etc., ver `src/lib/tenant.ts`; não fazia parte do design.md original, gap fechado aqui).
- [x] 4.8 `src/app/api/chat/route.ts`: `POST` — campo-armadilha, `isRateLimited`, checa
      `isChatEnabled`/`isWithinChatHours`, inicia conversa e seta o cookie `chat_token`
      (`httpOnly`, hash do token gravado, nunca o valor puro).
- [x] 4.9 `src/app/api/chat/[conversationId]/route.ts`: `GET` (sondagem incremental,
      `?after=cursor`, aplica `isStale` antes de responder) e `POST` (enviar mensagem/anexo), dos
      dois lados — citizen via cookie, atendente via sessão — cada um só vê o que pode ver
      (notas internas filtradas para o lado do cidadão pelo próprio `listMessages`).
- [x] 4.10 `src/db/chat.test.ts` (PGlite): fluxo completo — aguardando, atribuída, transferida
      (mensagem `system` + `note`), encerrada e vinculada a um pedido; exclusão do pedido vinculado
      desvincula sem apagar a transcrição.

## 5. Widget do cidadão

- [x] 5.1 `src/app/(public)/_components/chat-widget.tsx` (novo): botão flutuante com os três
      estados (padrão, com contador, neutro fora do horário), painel do pré-chat, fila, conversa
      e encerramento — client component, cores só de `--brand-*`.
- [x] 5.2 `src/app/(public)/layout.tsx`: monta `<ChatWidget />` condicionado ao interruptor da
      serventia (lido no servidor via `isChatEnabled`) — se desligado, nem renderiza o componente
      no cliente.
- [x] 5.3 Sondagem no cliente: intervalo ~4s (mensagens) e ~15s (status ligado/horário), pausada
      quando `document.visibilityState !== "visible"`.
- [x] 5.4 Estado "fora do horário": mostra retorno do atendimento (`nextChatOpening`, novo em
      `src/core/chat/hours.ts`) e atalhos para e-mail, consulta de protocolo e agendamento (rotas
      já existentes).
- [x] 5.5 Anexos no widget: reaproveita `storeAttachments` sem `kind` (mesmo padrão posicional
      "anexo-1" já usado pelo wizard público — ver `src/app/api/chat/[conversationId]/route.ts`;
      não existe conceito de `kind` a mais em `uploads.ts`, o anexo vive direto nas colunas de
      `chat_messages`, não numa tabela compartilhada com `service_request_attachments`).
- [x] 5.6 Aviso de inatividade e tela de encerramento com avaliação (estrelas + comentário) e
      checkbox de transcrição por e-mail; endpoint novo `GET /api/chat/status` (fora da lista
      original) para o botão reagir ao interruptor sem precisar de uma conversa aberta.
- [x] 5.7 `e2e/support-chat.spec.ts` (novo): botão ausente com o chat desligado, pré-chat → fila →
      desistência → avaliação, cookie `chat_token` confirmado como `httpOnly`. Transferência e
      anexo ficam cobertos em `e2e/admin-support-chat.spec.ts` (dependem de um atendente logado);
      "fora do horário" fica em `src/core/chat/hours.test.ts`, que injeta o relógio — um e2e não
      tem como controlar a hora real do servidor de forma não frágil.

## 6. Navegação e cabeçalho do painel

- [x] 6.1 `src/app/admin/_components/nav.ts`: item "Atendimento online" (grupo "Canais do
      cidadão", permissão `chat.manage`), contador dinâmico via `waitingCount`.
- [x] 6.2 `src/app/admin/(dashboard)/layout.tsx`: buscar `waitingCount` (atrás de `chat.manage`)
      para o badge da sidebar.
- [x] 6.3 `src/app/admin/_components/page-header.tsx`: indicador "Disponível para o chat" com
      estado real. Virou async e busca `isChatEnabled` sozinho (mesmo raciocínio já usado para
      `today()` ali: toda tela chama `<AdminPageHeader title="..." />` sem argumento extra, então
      buscar dentro do componente evita mudar todo call site existente) — não fazia parte de 6.2
      no plano original, mas é o mesmo estado, só lido onde é consumido.

## 7. Console do atendente — fila e interruptor

- [x] 7.1 `src/app/admin/(dashboard)/atendimento/page.tsx`: colunas "Aguardando" (assunto,
      protocolo informado, tempo de espera colorido por urgência, "Atender") e "Em atendimento"
      (todas as conversas ativas da serventia, com atendente); checagem de `chat.manage` no
      servidor.
- [x] 7.2 `src/app/admin/(dashboard)/atendimento/actions.ts`: `toggleChatEnabledAction` (checa
      `chat.settings`), `assignConversationAction` (checa `chat.manage`, `canAssign` já embutido em
      `assignConversation`), `setStatusAction`.
- [x] 7.3 `_components/status-control.tsx`: status pessoal (Disponível/Ocupado/Ausente), grava em
      `user.chat_status` via `setStatusAction`.
- [x] 7.4 `_components/queue-poller.tsx`: `router.refresh()` a cada ~5s, pausado quando a aba não
      está visível — client component minúsculo montado na página, já que a fila em si é
      renderizada no servidor.

## 8. Console do atendente — conversa

- [x] 8.1 `src/app/admin/(dashboard)/atendimento/[id]/page.tsx`: conversa com contexto (página de
      origem, atalho para o pedido localizado via `findById`, novo em `service-request.ts`),
      respostas prontas, campo de mensagem, notas internas (fundo distinto), ação "Transferir",
      ação "Encerrar conversa".
- [x] 8.2 `src/app/admin/(dashboard)/atendimento/[id]/actions.ts`: `sendStaffMessageAction`,
      `registerNoteAction`, `transferConversationAction` (nota obrigatória), `closeConversationAction`.
- [x] 8.3 `_components/transfer-dialog.tsx`: lista de colegas com status e carga (`colleagues()`),
      opção "Devolver à fila geral", campo de nota interna obrigatório.
- [x] 8.4 `_components/conversation-console.tsx`: sondagem da conversa aberta no cliente (~3s),
      pausada quando a aba não está visível.

## 9. Encerramento vinculado a pedido

- [x] 9.1 `_components/close-dialog.tsx` (grupo 8): três opções (vincular ao protocolo localizado,
      lançar pedido novo, só encerrar).
- [x] 9.2 `src/app/admin/(dashboard)/pedidos/novo/` aceita `?deConversa=<id>`: pré-preenche nome e
      contato a partir da conversa (`getConversation`), e a action
      (`createManualServiceRequest`) vincula e encerra a conversa (`closeConversation` com
      `linkedRequestId`) ao registrar o pedido — `details.channel` passa a `"chat"` nesse caminho,
      em vez de `"counter"`.
- [x] 9.3 `src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx`: bloco "Atendimentos
      vinculados" (só aparece se houver alguma), listando transcrições via `linkedConversations`
      (novo em `src/lib/chat.ts`) — atendente e data, link para a conversa.

## 10. E2E e revisão final

- [x] 10.1 `e2e/admin-support-chat.spec.ts` (novo): interruptor refletido em qualquer tela,
      contador da sidebar, atender, limite de 3 conversas recusa a quarta, transferência recusada
      sem nota e aceita devolvendo à fila geral, encerramento vinculado a um pedido localizado.
      "Lançar pedido novo a partir da conversa" fica coberto indiretamente pela integração com
      `pedidos/novo` (mesmo formulário já testado em `e2e/admin-service-requests.spec.ts`); um
      cenário e2e dedicado exigiria um segundo atendente autenticado para transferência
      "para alguém" — mesma lacuna de fixture documentada em `e2e/support-chat.spec.ts`.
- [x] 10.2 `pnpm typecheck`, `pnpm lint`, `node scripts/check-tokens.mjs` e `pnpm build` (produção,
      Turbopack) — todos passam; 223/223 testes de unidade e PGlite passam.
- [x] 10.3 `node scripts/check-dashes.mjs`: já falha em `main` antes desta mudança (travessão em
      comentário é convenção estabelecida no repositório inteiro, ver arquivos como
      `src/db/schema.ts` e `src/core/scheduling/calendar.ts`); os arquivos novos seguem a mesma
      convenção, nenhuma regressão introduzida.
- [x] 10.4 `openspec validate add-support-chat --strict` antes do archive.

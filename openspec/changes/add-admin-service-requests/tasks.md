## 1. Banco e núcleo

- [x] 1.1 Migração Drizzle: `amount_cents integer` (nullable) em `service_requests`; tabela nova
      `service_request_requirements` (id, tenant_slug, request_id FK cascade, text, status,
      created_at, fulfilled_at, resolution_attachment_id FK opcional para
      `service_request_attachments`); index em `request_id`. Rodar `drizzle-kit generate` e
      conferir a migração gerada.
- [x] 1.2 `src/core/request/kinds.ts`: `STATUS_LABELS.service-request` com os oito valores (Novo,
      Em análise, Aguardando pagamento, Pago, Concluído, Indeferido, Cancelado, Arquivado);
      `isValidStatus(kind, status)` ou equivalente que recusa valor fora da lista.
- [x] 1.3 `src/core/request/kinds.ts` (ou novo arquivo): `suggestedNextStatuses(status)` — tabela
      de transição curada (Novo→Em análise/Cancelado; Em análise→Aguardando pagamento/Indeferido/
      Cancelado; Aguardando pagamento→Pago/Cancelado; Pago→Concluído/Cancelado;
      Concluído/Indeferido/Cancelado→Arquivado; Arquivado→nenhuma), pura, só para sugestão de UI.
- [x] 1.4 `src/core/request/requirement.ts` (novo): tipo `Requirement`, schema Zod do texto da
      exigência, sem I/O.
- [x] 1.5 `src/core/auth/roles.ts`: permissão `requests.manage`, concedida a `admin` e `staff`.
- [x] 1.6 Testes de núcleo: `src/core/request/kinds.test.ts` (vocabulário e transições) e
      `src/core/request/requirement.test.ts` (validação do texto).

## 2. Camada de dados administrativa

- [x] 2.1 `src/db/schema.ts`: tabela `serviceRequestRequirements` (Drizzle) espelhando a migração;
      `amountCents` no schema de `serviceRequests`.
- [x] 2.2 `src/lib/service-request.ts`: `listServiceRequests(tenantSlug, {status?, attribution?,
      search?})` — filtro e busca por protocolo/nome, ordenado por `createdAt` desc.
- [x] 2.3 `src/lib/service-request.ts`: `openRequestCount(tenantSlug)` — conta pedidos fora dos
      quatro andamentos terminais.
- [x] 2.4 `src/lib/service-request.ts`: `updateRequestStatus(id, status, actorUserId)` — valida
      contra a lista fechada, grava, chama `recordAudit()`.
- [x] 2.5 `src/lib/service-request.ts`: `registerRequirement(requestId, text, actorUserId)` e
      `fulfillRequirement(requirementId, attachment)` — a segunda chamada pelo lado do cidadão.
- [x] 2.6 `src/lib/service-request.ts`: `setRequestAmount(id, amountCents, actorUserId)`.
- [x] 2.7 `src/lib/service-request.ts`: `reissueAccessKey(id, actorUserId)` — gera chave nova,
      sobrescreve o hash, retorna o texto claro só para a resposta da chamada.
- [x] 2.8 `src/lib/service-request.ts`: `deleteRequest(id, actorUserId)` — grava auditoria com
      protocolo/solicitante/ato antes do `DELETE`, cascata cuida de anexos e exigências.
- [x] 2.9 `src/db/service-request.test.ts`: cobrir as funções acima (PGlite), incluindo cascata de
      exclusão e chave antiga parando de bater após reemissão.

## 3. Consulta pública — cumprir exigência

- [x] 3.1 `src/app/(public)/protocolo/protocol-lookup.tsx`: bloco de exigência pendente (texto +
      envio de anexo), reaproveitando o padrão de upload já usado para o requerimento assinado.
- [x] 3.2 Server action que valida protocolo+chave, chama `storeAttachments` e depois
      `fulfillRequirement`.
- [x] 3.3 `e2e/service-request.spec.ts`: cenário de exigência pendente aparecendo e sendo cumprida
      pela consulta.

## 4. Navegação do painel

- [x] 4.1 `src/app/admin/_components/nav.ts`: item "Pedidos de serviço" (grupo Operação, permissão
      `requests.manage`), com contador dinâmico.
- [x] 4.2 `src/app/admin/(dashboard)/layout.tsx`: buscar `openRequestCount` e repassar pro
      `AdminSidebar`/`navGroups()`.

## 5. Fila de pedidos

- [x] 5.1 `src/app/admin/(dashboard)/pedidos/page.tsx`: tabela com protocolo, solicitante, ato,
      andamento (selo), valor, data; filtros de andamento e atribuição e busca via `searchParams`;
      checagem de `requests.manage` no servidor.
- [x] 5.2 Link "Lançar pedido" para `/admin/pedidos/novo`; linha leva a `/admin/pedidos/[protocolo]`.

## 6. Detalhe do pedido

- [x] 6.1 `src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx`: seções andamento (com sugestão
      de transição), dados do solicitante (CPF mascarado), exigências, anexos do cidadão, entrega
      do documento final, valor, chave de acesso, histórico (via `audit_log` do pedido), excluir.
- [x] 6.2 `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`: uma action por operação
      (mudar andamento, registrar exigência, anexar entrega, informar valor, reemitir chave,
      excluir), cada uma checando `requests.manage` e chamando a função correspondente do passo 2.
- [x] 6.3 Confirmação explícita nas ações irreversíveis (reemitir chave, excluir).

## 7. Lançamento manual

- [x] 7.1 `src/app/admin/(dashboard)/pedidos/novo/page.tsx`: formulário atribuição → ato (reusa
      `actsOfTenant`/`actsOfAttribution`) + campos de `serviceRequestSchema`, checkbox "recebido
      presencialmente".
- [x] 7.2 Action que chama `createServiceRequest` com `details.channel = "presencial"`, sem
      honeypot/rate-limit (rota autenticada), retorna protocolo e chave gerados.

## 8. E2E e revisão final

- [x] 8.1 `e2e/admin-service-requests.spec.ts`: fila (listagem e navegação ao detalhe), mudança de
      andamento, registro de exigência, lançamento manual completo, acesso recusado sem sessão.
      (Filtros/busca da fila e o caso "sem `requests.manage`" ficaram fora: hoje `admin` e `staff`
      têm a permissão igualmente, então não há papel autenticado sem ela para exercitar esse caso.)
- [x] 8.2 Conferir que nenhuma cor sai de `--color-admin-*`/`--brand-*` (sem hex solto nas telas
      novas).
- [x] 8.3 `openspec validate add-admin-service-requests --strict` antes do archive.

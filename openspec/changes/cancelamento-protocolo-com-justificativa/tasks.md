## 1. Banco de dados e núcleo

- [x] 1.1 Migração aditiva: adicionar `status_reason` (text, nullable) em `service_requests`
      (`src/db/schema.ts`), sem default, sem afetar as demais colunas.
- [x] 1.2 Exportar o schema de validação de texto livre já usado pela exigência
      (`requirementTextSchema` em `src/core/request/requirement.ts`) sob um nome genérico
      reutilizável (ex.: `freeTextJustificationSchema`), sem duplicar a lógica de trim/min/max.
- [x] 1.3 Em `src/lib/service-request.ts`, `updateRequestStatus` passa a aceitar um parâmetro
      opcional de motivo e gravá-lo em `status_reason` junto do `status` na mesma escrita.

## 2. Server action do painel

- [x] 2.1 Em `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`, `changeStatus` passa a
      ler `formData.get("reason")` quando o `status` alvo for `cancelled` ou `rejected`.
- [x] 2.2 Validar o motivo com o schema de 1.2; recusar com mensagem em português quando vazio ou
      só espaços, sem gravar nada, para `cancelled`/`rejected`.
- [x] 2.3 Passar o motivo validado para `updateRequestStatus` (1.3).
- [x] 2.4 Estender a lista de andamentos que avisam por e-mail (linha 208 em diante) para incluir
      `rejected`, mantendo o corpo do aviso sem conteúdo (mesmo padrão de `cancelled` hoje —
      "O seu pedido foi indeferido.", sem o motivo).

## 3. Histórico do painel

- [x] 3.1 Em `listRequestHistory` (`src/lib/service-request.ts`), juntar `status_reason` (via
      join com `service_requests`) ao resultado. (Implementado sem novo join: o detalhe do pedido
      já busca a linha completa via `findByProtocol`, que agora traz `statusReason` junto.)
- [x] 3.2 Na exibição do histórico do detalhe do pedido, mostrar o motivo apenas na entrada mais
      recente de `action: "service-request.status"` quando o andamento atual do pedido for
      `cancelled` ou `rejected`.

## 4. UI do painel (status-section.tsx)

- [x] 4.1 Interceptar o clique nas pastilhas "Cancelado" e "Indeferido" para abrir um passo de
      confirmação com `<textarea name="reason">` obrigatório, em vez de submeter direto — mesmo
      padrão de confirmação já usado em `_components/close-day.tsx` (agenda).
- [x] 4.2 Aplicar o mesmo passo de confirmação com motivo quando o `<select>` de "Corrigir para
      outro andamento" estiver em `cancelled`/`rejected` e o operador clicar "Aplicar".
- [x] 4.3 Exibir a mensagem de erro do servidor (motivo vazio) no mesmo bloco de erro que o
      formulário já usa (`state.status === "error"`).
- [x] 4.4 Garantir que os demais dezesseis andamentos continuam com o comportamento atual
      (submit direto, sem passo extra).

## 5. Consulta pública de protocolo

- [x] 5.1 Em `src/app/(public)/protocolo/protocol-lookup.tsx`, exibir o motivo junto ao
      `StatusBadge` quando o andamento for `cancelled` ou `rejected`, com estilo alinhado ao
      bloco de exigência (`RequirementRow`) já existente na mesma tela.
- [x] 5.2 Quando não houver motivo gravado (pedido encerrado antes desta mudança), mostrar o
      texto "Motivo não informado" em vez de omitir o bloco.
- [x] 5.3 Repassar o motivo do server action que já monta `ServiceRequestDetail`
      (`result.statusReason`) para o componente; `PublicStatus` (busca leve, sem chave de acesso)
      não ganha o motivo — só o resultado protegido pela chave mostra conteúdo, mesma regra já
      usada para o restante do pedido.

## 6. Testes

- [x] 6.1 `node --test`: `updateRequestStatus` grava e sobrescreve `status_reason` corretamente.
      (`src/db/service-request.test.ts`, contra PGlite com as migrações reais — mesmo padrão já
      usado nesse arquivo, que exercita o SQL em vez da função `"use server"`.)
- [x] 6.2 `node --test`: `changeStatus` recusa `cancelled`/`rejected` sem motivo (vazio e só
      espaços) e aceita com motivo, para os dois andamentos. (Nenhuma action deste projeto tem
      teste unitário próprio — nem `cancelOneAppointment`, a referência direta. Cobri a validação
      que `changeStatus` delega, `statusReasonSchema`/`requiresStatusReason`, em
      `src/core/request/kinds.test.ts`; o fluxo ponta a ponta da action fica com o Playwright de
      6.5.)
- [x] 6.3 `node --test`: `changeStatus` não exige motivo para os demais andamentos. (Coberto pelo
      teste "only cancelled and rejected require a status reason" em `kinds.test.ts`.)
- [ ] 6.4 `node --test`: aviso por e-mail dispara para `rejected` sem carregar o motivo no corpo,
      igual a `cancelled`. (Não há harness de teste de e-mail neste projeto; ver 7.2 para
      verificação manual.)
- [x] 6.5 Playwright: fluxo do operador cancelando um pedido pela pastilha — motivo obrigatório,
      erro sem motivo, sucesso com motivo, motivo visível no histórico.
      (`e2e/admin-service-requests.spec.ts`)
- [x] 6.6 Playwright: consulta pública mostra o motivo para um protocolo indeferido, e mostra
      "Motivo não informado" para um cancelado sem `status_reason` (seed direto no banco de teste).
      (`e2e/service-request.spec.ts`)

## 7. Verificação manual

- [ ] 7.1 Rodar o app localmente, cancelar um protocolo pela pastilha e conferir e-mail (ambiente
      de teste), histórico do painel e consulta pública com a chave de acesso. **Pendente**: este
      worktree não tem `DATABASE_URL`/`.env.local` configurado, então não há como subir o app
      contra um banco real aqui. Fica para quem tiver o ambiente local ou para o CI.
- [ ] 7.2 Repetir para indeferimento, incluindo o e-mail que hoje não existe para esse andamento.
      **Pendente**, mesma razão de 7.1.
- [ ] 7.3 Conferir que corrigir manualmente um pedido de "Cancelado" de volta para outro andamento
      (Non-Goal: sem exigir motivo) continua funcionando como hoje. **Pendente**, mesma razão de
      7.1 — a lógica (`requiresStatusReason` só é true para `cancelled`/`rejected`, então sair
      deles não abre o passo de motivo) está coberta pelo teste automatizado em `kinds.test.ts`,
      mas a verificação manual na tela real segue pendente.

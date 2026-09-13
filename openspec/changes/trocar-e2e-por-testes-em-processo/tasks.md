## 1. Infra de teste em processo

- [x] 1.1 Criar `scripts/test-resolve.mjs`: hook de `node:module` `register()` que resolve `@/x`
      para `src/x`; sem dependência nova
- [x] 1.2 Trocar o script `test` para `node --conditions=react-server --import
      ./scripts/test-resolve.mjs --test "src/**/*.test.ts"` e confirmar que os 587 testes atuais
      seguem verdes
- [x] 1.3 Criar `src/db/test-db.ts` (helper só de teste): sobe `drizzle(new PGlite(), { schema })`
      com todas as migrações de `drizzle/*.sql` aplicadas na ordem, e expõe `close()`. Trocar os
      `before` duplicados dos testes de `src/db` e `src/lib` que já fazem isso à mão
- [x] 1.4 Piloto: `src/lib/service-request.ts` ganha `...With(db, ...)` para as funções que a
      action de `/solicitar` usa; a exportação antiga vira repasse do singleton; um teste em
      `src/lib/service-request.test.ts` prova o carregamento sob `@/` + `server-only` e uma
      query real contra PGlite

## 2. Triagem e migração: fluxos do cidadão

- [x] 2.1 `e2e/service-request.spec.ts` (40 testes): listar asserções; migrar para
      `src/lib/service-request.test.ts` o que falta (pedido duplicado, chave de acesso enviada,
      exigência pendente e cumprida, consulta por protocolo, edição de dados); apagar o spec e
      preencher a linha da triagem em `design.md`
- [x] 2.2 `e2e/channels.spec.ts`, `admin-ombudsman`, `admin-lgpd`, `admin-compliance`: descer a
      regra das actions de ouvidoria, LGPD e conformidade para `src/lib/*With`, testar contra
      PGlite (prazo, anonimato, status), apagar os specs, registrar
- [x] 2.3 `e2e/tenants.spec.ts`, `public-nav`, `platform-page`, `privacy-cookies`,
      `citizen-tracking-flag`: resolução de host para tenant e gating de seção já são
      `src/core` (conferir cobertura); a leitura da flag em cookie ganha teste em `src/lib`; o
      resto é navegação, abandonar e registrar
- [x] 2.4 `e2e/digital-seal.spec.ts`, `support-chat.spec.ts`: consulta de selo e capacidade do
      chat já têm teste em `src/core` e `src/lib` (conferir); migrar o que faltar, apagar, registrar

## 3. Triagem e migração: painel

- [x] 3.1 `e2e/admin-login.spec.ts`: isolamento de sessão por serventia e papel já cobertos em
      `src/db/tenant-scope.test.ts` e `src/lib/auth-tokens.test.ts` (conferir); cookies e
      redirecionamento abandonados; apagar e registrar
- [x] 3.2 `e2e/admin-service-requests.spec.ts` (21) e `admin-requirement-conversation`: descer
      mudança de status, exigência, cancelamento e indeferimento com justificativa, impressão, para
      `src/lib/*With`; testar transições contra PGlite; apagar, registrar
- [x] 3.3 `e2e/admin-users.spec.ts`, `admin-settings`, `admin-visual-identity`: convite,
      desativação, troca de e-mail e senha já em `src/db/*.test.ts` (conferir); configurações e
      marca ganham `src/lib` `With` com teste; apagar, registrar
- [x] 3.4 `e2e/admin-agenda.spec.ts`, `admin-publications`, `admin-transparency`: agendamento e
      publicação já em `src/db` (conferir); transparência ganha teste em `src/lib`; a varredura axe
      do transparency é abandonada (fica `check:a11y` manual); apagar, registrar
- [x] 3.5 `e2e/admin-overview.spec.ts`, `admin-global-search`, `admin-sidebar`,
      `admin-support-chat`: visão geral e busca já em `src/core/overview` e
      `src/core/request/search`; conferir, migrar o que faltar, abandonar navegação, apagar,
      registrar

## 4. Remoção e CI

- [x] 4.1 Apagar `playwright.config.ts`, `test-results/`, o script `e2e` do `package.json` e a
      pasta `e2e/` (já vazia); manter `@playwright/test` e `@axe-core/playwright` por causa de
      `check:a11y`
- [x] 4.2 `.github/workflows/verify.yml`: remover serviço `postgres`, `DATABASE_URL`,
      `DIRECT_URL`, `ADMIN_SEED_*`, `AURORA_ADMIN_*`, `db:migrate`, os dois `db:seed`,
      `playwright install` e `pnpm e2e`; manter `pnpm build` com `BETTER_AUTH_*` e
      `DEFAULT_TENANT` descartáveis; atualizar os comentários
- [x] 4.3 `.githooks/pre-push`: só o comentário, que ainda fala em e2e no CI

## 5. Convenção e documentação

- [x] 5.1 `openspec/config.yaml`: stack passa a "node --test com PGlite em processo (sem Vitest,
      sem Playwright)"; regra nova em `rules.tasks` dizendo que cobertura de fluxo é teste em
      processo em `src/lib` ou `src/db` e que Playwright não é opção
- [x] 5.2 `README.md`: seção Verificação sem `pnpm e2e`; tabela de pastas sem `e2e/`; hook
      descrito como typecheck + lint + test; explicar o helper de PGlite e a forma `With`
- [x] 5.3 Rodar `pnpm typecheck && pnpm lint && pnpm test && pnpm check:dashes && pnpm
      check:tokens && pnpm build` e conferir que a tabela "Registro da triagem" em `design.md`
      tem uma linha por spec removido

## Why

A suíte Playwright (`e2e/`, 25 specs, ~200 testes) é o passo mais caro de todo o fluxo: precisa de
`next build`, `next start`, Chromium, um Postgres real migrado e semeado com duas serventias, e
roda com um worker só no CI para não abortar navegações. São 9+ minutos por rodada, e como cada
change do OpenSpec vinha com tarefas "estender `e2e/*.spec.ts`", uma tarefa simples passava mais
tempo esperando build e browser do que sendo feita. Enquanto isso, `pnpm test` roda 587 testes,
inclusive os que batem em PostgreSQL em processo (PGlite), em menos de 10 segundos e sem segredo
nenhum. O que a suíte lenta prova de verdade (regra de negócio, isolamento por tenant, integridade
do banco) a suíte rápida já prova ou pode provar; o que sobra (pixel, navegação de browser) não
vale nove minutos por push.

## What Changes

- **BREAKING** Remove a suíte Playwright: `e2e/`, `playwright.config.ts`, o script `pnpm e2e`, e
  os passos de CI que só existiam para ela (serviço Postgres, migrate, dois seeds, instalação do
  Chromium). `@playwright/test` e `@axe-core/playwright` continuam apenas como dependência de
  `pnpm check:a11y`, que é manual e fora deste escopo.
- O gate único de verificação passa a ser a suíte em processo: `pnpm typecheck && pnpm lint &&
  pnpm test`, o mesmo em três lugares (hook de pre-push, CI, e a rodada local durante uma tarefa).
  `pnpm build` segue no CI, porque é o único passo que valida o que é do Next (rotas, fronteira
  server/client), mas não bloqueia push nem tarefa.
- A suíte em processo ganha o que hoje só o e2e cobria: a costura entre server action, `src/lib`
  e banco. Para isso o cliente Drizzle deixa de ser um singleton preso a `DATABASE_URL` e passa a
  aceitar um driver PGlite em teste, com as migrações de `drizzle/` aplicadas em memória. Não é
  runner novo: continua `node --test` com `node:assert`, como o projeto já define ("sem Vitest").
- Triagem spec a spec antes de apagar: o que cada arquivo em `e2e/` afirmava e ainda não está
  coberto por `src/core` ou `src/db` vira teste em processo; o que era só navegação ou aparência é
  registrado como abandonado de propósito no design, para ninguém reescrever por engano.
- Convenção de tarefas: `openspec/config.yaml` passa a dizer que cobertura de fluxo é teste em
  processo, nunca Playwright, e a descrição da stack deixa de listar Playwright. É isso que impede
  a próxima change de trazer o e2e de volta em uma tarefa "5.1 estender o spec".
- README e spec `pre-push-verification` param de prometer que o push roda o e2e (o hook já não
  roda há tempo; a promessa é que estava errada).

## Não-objetivos

- Trocar o runner. Vitest, Jest ou similar não entram: `node --test` já é o runner do projeto e
  já é rápido; o ganho está em tirar o browser e o banco externo, não em trocar a sintaxe de 63
  arquivos de teste que passam.
- Cobrir renderização de componentes React ou aparência (tema, layout, contraste). Isso continua
  responsabilidade de `pnpm check:tokens`, `pnpm check:a11y` (manual, contra um servidor no ar) e
  revisão de quem mexe na tela.
- Mexer no `pnpm check:a11y` ou em suas dependências.
- Reescrever os testes que já existem em `src/core` e `src/db`.
- Testar Better Auth de ponta a ponta (cookie, sessão de browser). O que se prova em processo é a
  regra que o projeto escreveu em cima dele (papel, tenant da sessão, revogação), que já tem
  teste.

## Capabilities

### New Capabilities
- `in-process-verification`: a verificação do repositório é uma suíte só, em processo, sem
  browser, sem banco externo e sem segredo; a camada de costura (`src/lib`, server actions) é
  testável contra PostgreSQL em memória com as migrações reais aplicadas.

### Modified Capabilities
- `pre-push-verification`: o gate de push deixa de ser a suíte e2e e passa a ser a suíte em
  processo (typecheck, lint, test); os cenários que citam Playwright são reescritos.

## Impact

- Removidos: `e2e/**`, `playwright.config.ts`, `test-results/`, script `e2e` no `package.json`.
- CI (`.github/workflows/verify.yml`): sai o serviço Postgres, `DATABASE_URL`/`DIRECT_URL`,
  `ADMIN_SEED_*`, `AURORA_ADMIN_*`, os dois seeds, `playwright install` e `pnpm e2e`. O job passa
  a não precisar de nada além do Node.
- `src/db/index.ts`: cliente Drizzle passa a ser construído por uma função que aceita o driver;
  produção segue `postgres-js`, teste usa `drizzle-orm/pglite`. Nenhuma query muda.
- Testes em processo precisam resolver `@/` e `server-only` fora do Next: entra um `--import`
  de resolução no script `test` (ou `imports` no `package.json`), sem dependência nova.
- `src/lib/**` e `src/app/**/actions.ts` ganham testes onde o e2e era a única cobertura.
- `openspec/config.yaml`, `README.md`, `.githooks/pre-push` (só comentário) e a spec
  `pre-push-verification`.
- Dependências: `@electric-sql/pglite` já está instalada; `drizzle-orm/pglite` já vem no pacote.
  Nada novo entra; nada sai (as duas de Playwright ficam pelo `check:a11y`).

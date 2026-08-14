## 1. Provisionamento

- [x] 1.1 Criar (ou confirmar) o projeto Supabase para o Veridia.
- [x] 1.2 Coletar as duas connection strings: pooler Supavisor modo transaction (porta 6543) e
      conexão direta (porta 5432).

## 2. Dependências

- [x] 2.1 Adicionar `postgres` (postgres-js) ao `package.json`.
- [x] 2.2 Remover `@neondatabase/serverless` do `package.json`.
- [x] 2.3 Atualizar o lockfile (`pnpm install`).

## 3. Código

- [x] 3.1 Atualizar `src/db/index.ts`: trocar `neon()` + `drizzle-orm/neon-http` por
      `postgres()` + `drizzle-orm/postgres-js`, com `{ prepare: false }` na conexão (exigido
      pelo pooler em modo transaction) e mantendo o fallback `||` para `DATABASE_URL` vazia e o
      comentário sobre build sem banco/segredo.
- [x] 3.2 Atualizar `drizzle.config.ts`: usar `DIRECT_URL` (não `DATABASE_URL`) em
      `dbCredentials.url`, e atualizar a mensagem de erro e os comentários que hoje citam a
      Neon.
- [x] 3.3 (descoberto durante a implementação, não previsto no design original) 17 specs e2e
      importam `neon` de `@neondatabase/serverless` diretamente para setup/assert via SQL bruto
      contra `DATABASE_URL`. Trocado para `postgres` (mesma API de tagged template, troca
      mecânica). Também corrigidos dois comentários em `src/lib/service-request.ts` e
      `src/lib/transparency.ts` que atribuíam a ausência de transação ao driver `neon-http`
      especificamente — o comportamento (sem transação) foi mantido, só a atribuição estava
      desatualizada.

## 4. Configuração e documentação

- [x] 4.1 Atualizar `.env.example`: comentário e exemplo de `DATABASE_URL` (pooler, porta 6543)
      apontando para Supabase em vez de Neon; adicionar `DIRECT_URL` (porta 5432) com comentário
      explicando que é só para `db:generate`/`db:migrate`.
- [x] 4.2 Atualizar a tabela de variáveis de ambiente no `README.md` (linha de `DATABASE_URL` e
      nova linha de `DIRECT_URL`).

## 5. Schema no banco novo

- [x] 5.1 Preencher `.env.local` com `DATABASE_URL`/`DIRECT_URL` da Supabase.
- [x] 5.2 Rodar `pnpm db:migrate` contra o banco Supabase e conferir que todas as migrations de
      `drizzle/` aplicam sem erro. Aplicado com sucesso (`migrations applied successfully!`).
- [x] 5.3 Rodar a app localmente contra a Supabase e validar os fluxos principais. Validado via
      `pnpm dev` + requisições diretas: login admin cria sessão real na Supabase
      (`POST /api/auth/sign-in/email` 200, cookie de sessão emitido), `/admin` autenticado
      responde 200 e não-autenticado responde 307 (redireciona pro login) — confirma leitura e
      escrita via o pooler funcionando com `prepare: false`. Home, `/admin/login`, `/protocolo` e
      `/solicitar` renderizam 200.

## 6. Verificação

- [x] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (confirma que os testes com `pglite`
      continuam intactos, já que não dependem do driver de produção). `pnpm lint` completo falha
      por dois motivos alheios a esta change (config do Biome duplicada num worktree solto em
      `.claude/worktrees/`, e uma formatação pendente em `request-form.tsx`); rodado escopado
      (`biome check src e2e drizzle.config.ts`) e limpo para todo arquivo tocado aqui.
- [x] 6.2 `pnpm build` (confirma que o placeholder de `DATABASE_URL` vazia continua funcionando
      sem driver da Neon instalado). Rodado sem `DATABASE_URL`/`DIRECT_URL` no ambiente; build
      completo.
- [x] 6.3 `pnpm e2e`. 3 falhas em `tenants.spec.ts` (seção "centrais-contato" duplicada) — pré
      existentes, sem relação com o driver de banco (não tocamos gating/tenant/layout nesta
      change); as specs que dependem de banco real seguem skippadas sem `DATABASE_URL`, como
      esperado.

## 7. Corte em produção (Vercel)

- [x] 7.1 Configurar `DATABASE_URL` e `DIRECT_URL` da Supabase no Vercel. Adicionadas primeiro só
      em Preview/Development (banco chamado de "development" pelo usuário); confirmado depois
      que esse mesmo projeto Supabase também serve como banco de Production, e as mesmas duas
      variáveis foram adicionadas em Production. Production não tinha `DATABASE_URL` configurada
      no Vercel antes desta change (não havia valor da Neon para preservar/rollback ali).
- [x] 7.2 Deploy e observação. `vercel deploy --prod` concluído com sucesso (`readyState: READY`,
      `target: production`), aliasado para `veridia-henna.vercel.app`. Validado por `curl`: login
      do superadmin (`admin@atrioss.com`) cria sessão real na Supabase, `/admin` autenticado
      responde 200, não-autenticado responde 307.
- [x] 7.3 Não havia variável antiga da Neon no Vercel para remover (Production não tinha
      `DATABASE_URL` configurada antes desta change). Decomissionar o projeto Neon em si segue
      como atividade operacional separada, fora desta change.

**Nota:** a pedido do usuário, `pnpm db:seed` (admin de serventia) não foi rodado neste banco —
só `pnpm db:seed-superadmin`, criando o admin da Átrios (`admin@atrioss.com`). O onboarding de
admins de serventia por convite por e-mail fica para uma change futura. O usuário de teste
`atrios@atrioss.com` (admin do Cartório Marinho), criado durante a validação local do grupo 5
antes deste banco virar produção, foi removido a pedido do usuário (`delete from "user"`, cascade
limpa sessão/conta). Confirmado: só resta `admin@atrioss.com` (superadmin) na tabela `user`.

## Context

`src/db/index.ts` conecta ao Postgres com `@neondatabase/serverless` (driver HTTP) e
`drizzle-orm/neon-http`. `drizzle.config.ts` usa a mesma `DATABASE_URL` para `drizzle-kit
generate`/`migrate`. Os testes (`node --test`) não passam por esse arquivo: usam
`@electric-sql/pglite` + `drizzle-orm/pglite` isolado em cada `*.test.ts`, então não são
afetados por esta troca. O deploy é Vercel, um único projeto, com todas as rotas que tocam banco
em `export const runtime = "nodejs"` (nenhuma edge function) — não há restrição de runtime que
force um driver HTTP-only como o da Neon.

A Supabase expõe Postgres de duas formas relevantes:
- **Conexão direta** (porta 5432): uma conexão TCP por cliente, só IPv6 por padrão no projeto
  novo (a menos que o add-on IPv4 seja habilitado).
- **Pooler Supavisor** (porta 6543, modo *transaction*): multiplexa muitas conexões de cliente
  em poucas conexões reais ao Postgres, compatível com IPv4, pensado para ambientes serverless
  onde cada invocação pode abrir sua própria conexão.

## Goals / Non-Goals

**Goals:**
- Trocar o driver e o adaptador Drizzle para algo que fale Postgres "de verdade" (protocolo TCP
  padrão), já que deixamos de depender do driver HTTP proprietário da Neon.
- Manter `src/db/index.ts` funcionando sem banco e sem segredo em `next build` (placeholder
  atual), sem eager connection.
- Escolher um modo de conexão que não esgote o limite de conexões do Postgres sob concorrência
  do Vercel (Route Handlers/Server Actions em `nodejs` runtime, potencialmente muitas invocações
  simultâneas).
- Manter `db:generate`/`db:migrate` funcionando sem mudança de comando.

**Non-Goals:**
- Migrar dados existentes da Neon para a Supabase (proposal já marca isso como não-objetivo).
- Mudar `src/db/schema.ts`, `auth-schema.ts` ou o histórico em `drizzle/`.
- Adotar Auth/Storage/Realtime da Supabase.
- Mudar a infraestrutura de teste (`pglite`), que já é independente do provedor de produção.

## Decisions

### Driver: `postgres` (postgres-js) + `drizzle-orm/postgres-js`

Alternativas consideradas: `pg` (node-postgres) + `drizzle-orm/node-postgres`.

Os dois funcionam com Supabase e com Drizzle. Escolhido `postgres-js` porque:
- É o driver que a própria documentação da Supabase e do Drizzle recomenda primeiro para esse
  par (Next.js + Supabase + Drizzle).
- API de conexão "lazy" equivalente à do `neon()` atual: `postgres(connectionString)` não abre
  conexão até a primeira query, então o comentário existente em `src/db/index.ts` sobre
  placeholder em build continua válido sem mudança de comportamento.
- Footprint menor que `pg` (sem binding nativo).

### Modo de conexão: pooler Supavisor (transaction mode) para a aplicação

A app roda em `nodejs` runtime no Vercel, não em edge, mas ainda assim são funções serverless:
cada invocação pode abrir sua própria conexão Postgres, e sem um pooler isso esgota o limite de
conexões do Postgres sob carga concorrente — o mesmo problema estrutural que a Neon resolvia com
o driver HTTP. A alternativa (conexão direta, porta 5432) não escala nesse modelo de execução e
ainda tem a pegadinha de ser IPv6-only por padrão.

`DATABASE_URL` passa a apontar para a connection string do pooler (porta 6543). Como o modo
*transaction* do Supavisor não suporta prepared statements no nível de sessão, a conexão do
`postgres-js` usada pela app precisa ser criada com `{ prepare: false }`.

### Segunda variável para migrations: `DIRECT_URL`

`drizzle-kit generate` roda localmente e não sofre limite de concorrência; `drizzle-kit migrate`
já é usado por `pnpm db:migrate`, plausivelmente do CI/CD ou manualmente, e DDL nem sempre é
suportado de forma confiável atrás do pooler em modo transaction. `drizzle.config.ts` passa a
usar uma variável separada, `DIRECT_URL` (conexão direta, porta 5432), só para essas operações.
Isso replica o padrão recomendado pela própria Supabase para Drizzle. `DATABASE_URL` continua
sendo a variável usada em runtime pela aplicação (`src/db/index.ts`), preservando o nome que já
é lido em todo o projeto (env vars locais, Vercel, `.env.example`, README) e reduzindo o blast
radius da troca.

## Risks / Trade-offs

- [Risco] `postgres-js` com prepared statements habilitado falha contra o pooler em modo
  transaction → Mitigação: instanciar com `{ prepare: false }` na conexão de runtime;
  documentado na decisão acima e cobrado em tasks.md.
- [Risco] Conexão direta (porta 5432) é IPv6-only por padrão na Supabase; `DIRECT_URL` rodando
  em ambiente sem IPv6 (ex.: alguns runners de CI, redes corporativas) falha → Mitigação:
  `DIRECT_URL` só é usado localmente/manualmente para `db:generate`/`db:migrate`, nunca em
  runtime da app; se necessário, habilitar o add-on IPv4 da Supabase para esse projeto.
- [Risco] Trocar a `DATABASE_URL` de produção sem coordenação derruba o app (schema ainda não
  existe no banco novo) → Mitigação: aplicar as migrations no banco Supabase novo (via
  `DIRECT_URL`) antes de apontar `DATABASE_URL` de produção para ele; ver Plano de Migração.
- [Risco] Nenhuma variável de ambiente antiga (`DATABASE_URL` apontando pra Neon) sobra para
  rollback rápido se o corte falhar → Mitigação: manter o projeto Neon ativo e a string antiga
  anotada até confirmar estabilidade na Supabase; ver Plano de Migração.

## Migration Plan

1. Provisionar o projeto na Supabase; obter as duas connection strings (pooler porta 6543 e
   direta porta 5432).
2. Trocar driver/adaptador no código (`src/db/index.ts`, `drizzle.config.ts`,
   `package.json`) — sem apontar ainda para a Supabase.
3. Localmente, com `DIRECT_URL`/`DATABASE_URL` apontando para a Supabase em `.env.local`, rodar
   `pnpm db:migrate` para aplicar todo o histórico de `drizzle/` no banco novo, ainda vazio, e
   confirmar que o schema resultante bate com o da Neon.
4. Validar a app localmente contra a Supabase (fluxos principais: login admin, pedido de
   serviço, painel).
5. Reconfigurar `DATABASE_URL` e `DIRECT_URL` no Vercel (produção e preview) para a Supabase.
   Redeploy.
6. Observar erros/latência de conexão pós-deploy. Rollback = reverter `DATABASE_URL` no Vercel
   para a string da Neon (projeto Neon permanece ativo até esse passo ser descartado).
7. Depois de confirmada a estabilidade, decomissionar o projeto Neon (fora do escopo desta
   change — atividade operacional).

Como não há migração de dados (non-goal), este plano assume que o banco Supabase começa vazio;
se já existir necessidade de preservar dados de produção da Neon no corte, isso precisa virar
uma change separada antes do passo 5.

## Open Questions

- O projeto Supabase já existe ou precisa ser criado como parte da implementação desta change?
- Existe algum consumidor externo (script, dashboard, integração) que lê `DATABASE_URL` fora
  deste repositório e que precisa ser avisado da troca de host?

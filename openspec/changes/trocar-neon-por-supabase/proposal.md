## Why

O projeto usa PostgreSQL hospedado na Neon, acessado via `@neondatabase/serverless` e o
adaptador `drizzle-orm/neon-http`. A decisão de infraestrutura mudou: o banco vai passar a ser
hospedado na Supabase. Isso troca o provedor de PostgreSQL e o driver de conexão usados pela
aplicação, sem alterar nenhuma regra de negócio.

## What Changes

- Trocar a dependência `@neondatabase/serverless` por um driver de PostgreSQL padrão compatível
  com Supabase (`postgres` ou `pg`, a definir em design.md).
- Trocar o adaptador Drizzle de `drizzle-orm/neon-http` para o adaptador correspondente ao novo
  driver (`drizzle-orm/postgres-js` ou `drizzle-orm/node-postgres`).
- Atualizar `src/db/index.ts` para a nova forma de conexão, preservando o comportamento de
  placeholder em build (sem banco e sem segredo) e o uso de `||` para `DATABASE_URL` vazia.
- Atualizar `drizzle.config.ts`: mensagem de erro e comentários que hoje mencionam Neon.
- Atualizar `.env.example` e `README.md` (tabela de variáveis de ambiente) para descrever a URL
  de conexão da Supabase em vez da Neon.
- Atualizar `package.json` (dependências) e o lockfile.
- **BREAKING**: o formato de `DATABASE_URL` muda (host, porta e parâmetros de pooling da
  Supabase são diferentes dos da Neon). Todo ambiente (local, preview, produção) precisa da
  variável reconfigurada com a nova connection string antes do deploy.

## Capabilities

### New Capabilities

- `database-connection`: como a aplicação se conecta ao PostgreSQL — conexão via pooler
  compatível com execução serverless em runtime, conexão direta só para migrations, e o
  placeholder que mantém `next build` funcionando sem banco e sem segredo. Não existia spec para
  isso até agora; a troca de provedor é a oportunidade de registrar esse comportamento.

### Modified Capabilities

(nenhuma — a troca de provedor de banco não muda o comportamento de nenhuma capability já
especificada em `openspec/specs/`)

## Non-goals

- Não migra os dados existentes da Neon para a Supabase (fora do escopo desta proposta; é uma
  atividade operacional separada, feita no momento do corte).
- Não adota outros recursos da Supabase (Auth, Storage, Realtime, Edge Functions). O projeto já
  usa Better Auth e Vercel Blob; nada disso muda. Só o banco PostgreSQL é trocado de provedor.
- Não altera o schema do banco (`src/db/schema.ts`, `auth-schema.ts`) nem as migrations já
  geradas em `drizzle/`.
- Não altera a estratégia de migração destrutiva (expand/contract) descrita no projeto.

## Impact

- Código: `src/db/index.ts`, `drizzle.config.ts`, e os 17 arquivos em `e2e/*.spec.ts` que
  importam `@neondatabase/serverless` diretamente para setup/assert via SQL bruto (descoberto
  durante a implementação — não estava listado aqui originalmente).
- Dependências: remove `@neondatabase/serverless`; adiciona o driver Postgres escolhido em
  design.md.
- Configuração: `.env.example`, `README.md` (seção de variáveis de ambiente).
- Ambientes: `DATABASE_URL` precisa ser reconfigurada em dev local (`.env.local`), Vercel
  preview e produção, com a connection string da Supabase.
- Scripts que dependem de `DATABASE_URL`: `db:generate`, `db:migrate`, `db:seed`,
  `db:seed-superadmin` — continuam funcionando sem mudança de código, desde que a variável de
  ambiente aponte para a Supabase.

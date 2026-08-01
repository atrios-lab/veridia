# Veridia

Plataforma multi-cartório da Atrios: um único codebase serve N serventias, cada uma com seu
domínio, sua marca e seu conteúdo.

## Como está organizado

| Pasta | O que vive aqui |
| --- | --- |
| `src/core/` | Núcleo de domínio puro. Sem framework, sem I/O, sem banco. Testado com `node --test`. |
| `src/app/` | Rotas do Next. |
| `src/db/` | Schema Drizzle e validação derivada. |
| `src/lib/` | Costura entre o núcleo e o framework. |
| `scripts/` | Checks de convenção e seed. |
| `e2e/` | Playwright, parametrizado sobre as serventias registradas. |
| `drizzle/` | Migrações SQL versionadas. Ver [docs/migrations.md](docs/migrations.md). |

A regra do `src/core/`: importar `next`, `react`, `drizzle-orm`, `better-auth` ou `node:fs` ali
dentro é erro de lint, verificado no CI.

## Setup

Precisa de Node 24 e pnpm 11.

```bash
pnpm install
```

Copie `.env.example` para `.env.local` e preencha:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | PostgreSQL na Neon. |
| `DEFAULT_TENANT` | Serventia servida quando o host não está mapeado. |
| `BETTER_AUTH_SECRET` | Segredo da sessão. Gere com `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | URL base da aplicação. |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | Usuário criado pelo seed. Não há cadastro público. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limit. Sem elas, o limite fica desligado. |

Com o banco de pé:

```bash
pnpm db:migrate && pnpm db:seed
```

## Rodar

```bash
pnpm dev
```

## Servir outra serventia em desenvolvimento

A serventia é resolvida pelo host da requisição. O navegador resolve qualquer nome terminado em
`.localhost` para a máquina local, então basta abrir o host declarado na config:

- <http://marinho.localhost:3000> serve o Cartório Marinho
- <http://aurora.localhost:3000> serve o Tabelionato Aurora

Um host não mapeado cai no `DEFAULT_TENANT`. Toda serventia nova precisa declarar um host
`.localhost` em `hosts`, senão não dá para servi-la em desenvolvimento nem testá-la por host.

Uma serventia nova é um arquivo em `src/core/tenant/tenants/` mais uma linha no registro de
`src/core/tenant/resolve.ts`. O teste de ponta a ponta passa a cobri-la sem nenhum caso novo.

## Verificação

O mesmo que o CI roda:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check:dashes && pnpm check:tokens && pnpm build && pnpm e2e
```

- `pnpm test` roda o núcleo e o teste de revogação de sessão, este último contra um PostgreSQL em
  processo. Nenhum teste toca banco real nem precisa de segredo.
- `pnpm check:dashes` barra travessão e meia-risca em texto visível.
- `pnpm check:tokens` barra cor hexadecimal literal fora do bloco `@theme`.

## Convenção de idioma

Código em inglês: identificadores, arquivos, comentários e commits. Texto visível ao usuário em
português, vindo da config. Siglas oficiais (`RCPN`, `NOTAS`, `RI`, `PROTESTO`, `RTD`, `RCPJ`) e
slugs de rota permanecem como estão.

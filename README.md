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

Botão novo em qualquer tela sai das classes de [docs/design-system.md](docs/design-system.md),
declaradas em `src/app/globals.css`. Não se escreve `rounded-*`, `bg-*` nem `hover:*` num botão.

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
| `ADMIN_SEED_TENANT` | Serventia do usuário criado pelo seed. Sem ela, vale o `DEFAULT_TENANT`. |
| `SUPERADMIN_SEED_EMAIL`, `SUPERADMIN_SEED_PASSWORD` | Conta da Átrios criada por `pnpm db:seed-superadmin`, opcional. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limit. Sem elas, o limite fica desligado. |

Com o banco de pé:

```bash
pnpm db:migrate && pnpm db:seed
```

## Rodar

```bash
pnpm dev
```

## Usuários do painel

O painel é de cada serventia. Todo usuário de serventia pertence a exatamente uma, e não existe
conta de serventia que abra mais de um painel. Quem precisa operar o painel de uma serventia tem
usuário nela. A única exceção é a conta da plataforma Átrios (`pnpm db:seed-superadmin`), que
entra em qualquer serventia registrada — ver `openspec/changes/add-atrios-super-admin`.

Na prática: um usuário do Cartório Marinho não entra em `aurora.localhost:3000/admin`, e a tentativa
devolve a mesma mensagem de credencial inválida, sem revelar que a conta existe em outra serventia.

Para criar o administrador de outra serventia, é o mesmo seed com outro slug:

```bash
ADMIN_SEED_TENANT=tabelionato-aurora ADMIN_SEED_EMAIL=admin@aurora.com ADMIN_SEED_PASSWORD=... pnpm db:seed
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

## Deploy

As mesmas variáveis do `.env.local` precisam existir no ambiente do deploy. Sem elas o painel não
sobe, e cada uma falha de um jeito diferente:

| Faltando | O que acontece |
| --- | --- |
| `BETTER_AUTH_SECRET` | A aplicação não inicia. É proposital: um segredo padrão é o mesmo em toda instalação da biblioteca. |
| `DATABASE_URL` | As páginas públicas funcionam, mas login e painel falham na primeira consulta. |
| `DEFAULT_TENANT` | Host não mapeado cai no Cartório Marinho, que é o padrão embutido. |
| `BETTER_AUTH_URL` | Opcional. Sem ela a biblioteca deduz a URL base da requisição, que é o que se quer num sistema com vários domínios. Se preencher, use o domínio real, não o do preview. |

O `db:migrate` roda apontando para o banco de produção só no deploy de produção. Preview usa banco
próprio ou nenhum. Ver [docs/migrations.md](docs/migrations.md).

O login funciona em qualquer domínio: o do deploy, o de preview e o de cada serventia. Não é
preciso declarar o domínio do deploy em lugar nenhum.

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

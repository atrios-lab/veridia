## Why

Veridia e a reescrita da plataforma multi-cartorio da Atrios: um unico codebase serve N serventias,
cada uma com seu dominio, sua marca e seu conteudo. O repositorio hoje e um `create-next-app` cru.

Esta mudanca entrega a fundacao que **nao depende de nenhuma decisao visual**: prova a resolucao
multi-tenant de ponta a ponta, ancora a regra de negocio num nucleo puro e testado, sobe a camada de
dados e a autenticacao, e liga o CI completo. Nenhum componente estilizado, nenhum token de marca,
nenhum modulo de negocio.

A ordem e deliberada. Descobrir um furo na resolucao por host depois de estilizar quarenta
componentes e caro; descobrir agora nao custa nada. O design system entra na mudanca seguinte, sobre
um terreno que ja provou funcionar.

## What Changes

- **Nucleo puro** em `src/core/`, escrito do zero: `TenantSchema` (Zod), `resolveTenant(host)`,
  `isSectionEnabled`, catalogo de atos e regra de custas. Proibido importar `next`, `react` ou
  qualquer I/O; testado com `node --test`.
- **Dois tenants desde o primeiro commit**: `marinho` (piloto real) e um segundo fictício
  deliberadamente diferente (apenas atribuicao `NOTAS`, sem editais). Um clone nao pega vazamento.
- **Fatia vertical sem cor**: `getTenant()` resolvendo por host e uma pagina em HTML sem estilo
  algum, listando nome da serventia e secoes habilitadas. Playwright afirma que dois hosts devolvem
  conteudos diferentes.
- **Camada de dados**: Drizzle + PostgreSQL (Neon), schema inicial (overrides de tenant, tabelas do
  Better Auth, `audit_log`), migracoes versionadas em SQL revisado e commitado.
- **Autenticacao**: Better Auth com sessao em banco (cookie opaco, revogacao imediata), seed sem
  cadastro publico, middleware protegendo `/admin`. Telas sem estilo.
- **Baseline de seguranca**: cabecalhos, cookies, rate limit, segredos so em env, trilha de auditoria.
- **CI completo** desde ja: tipos, testes, build, `check:dashes`, `check:tokens`, OpenSpec validate e
  Playwright.
- **Convencao de idioma**: codigo 100% em ingles (identificadores, arquivos, comentarios, commits);
  texto visivel ao usuario em portugues, vindo de config.
- **BREAKING**: n/a (greenfield).

## Non-Goals

- Design system, tokens de marca, injecao de tema, catalogo tipografico, componentes, landing por
  blocos, OG dinamico.
- Painel admin de verdade. Nesta entrega existe apenas o esqueleto protegido, sem estilo.
- Qualquer modulo de negocio: pedidos, agenda, publicacoes, editais, ouvidoria, LGPD,
  transparencia, fiscal e NFS-e.
- Config editavel em banco e painel do cartorio.
- Dominio proprio e emissao de certificado.
- Carga dos valores reais da tabela de custas.

## Capabilities

### New Capabilities
- `tenant-config`: configuracao da serventia como codigo versionado, validada por schema, resolucao
  por host e gating de secoes por atribuicao legal.
- `acts-catalog`: catalogo de atos e atribuicoes como dado puro e tipado.
- `fees-calculation`: regra de composicao de valor do ato (Total = Emolumento + Fundos; ISS como
  deducao; base da NFS-e = Emolumento) como utilitario puro.
- `admin-auth`: autenticacao com sessao em banco, sem cadastro publico, admin protegido.
- `platform-security-baseline`: cabecalhos, cookies, rate limit, segredos em env, auditoria.
- `database-migration`: migracoes versionadas com SQL revisado e disciplina de mudanca destrutiva em
  dois deploys.
- `continuous-integration`: verificacao antes do merge, sem segredos por desenho.

### Modified Capabilities
<!-- Nenhuma. Greenfield: nao ha specs em openspec/specs/. -->

## Impact

- **Estrutura**: app unico Next na raiz (nao monorepo). `src/core/` puro, `src/app/` rotas,
  `src/db/` schema e migracoes, `src/lib/` costura com o framework, `scripts/` checks de CI,
  `e2e/` Playwright.
- **Dependencias novas**: `zod`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`,
  `better-auth`, `@playwright/test`, `@upstash/ratelimit`, `@upstash/redis`.
- **Limpeza**: remover o scaffold do `create-next-app` (README padrao, `page.tsx` de exemplo, fontes
  Geist, CSS de exemplo).
- **Infra**: PostgreSQL na Neon via `DATABASE_URL`; deploy na Vercel em projeto unico. Nenhum segredo
  no repositorio.
- **Sistema anterior**: o repo `cartorio-marinho` continua em producao e serve como **referencia de
  comportamento**, para conferir regra de negocio quando houver duvida. Nao e fonte de copia: cada
  fluxo e reescrito do zero.

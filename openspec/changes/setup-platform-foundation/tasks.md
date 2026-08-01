## 1. Base do repositorio

- [x] 1.1 Limpar o scaffold do `create-next-app`: README padrao, `src/app/page.tsx` de exemplo,
      fontes Geist em `layout.tsx`, CSS de exemplo em `globals.css`
- [x] 1.2 Regra do Biome `noRestrictedImports` proibindo `next`, `react`, `react-dom`,
      `drizzle-orm`, `better-auth` e `node:fs` dentro de `src/core/**`
- [x] 1.3 Scripts em `package.json`: `test` (`node --test` com type stripping), `check:dashes`,
      `check:tokens`, `e2e`, `db:generate`, `db:migrate`
- [x] 1.4 `.env.example` com `DATABASE_URL`, `BETTER_AUTH_SECRET`, `DEFAULT_TENANT`,
      `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `UPSTASH_*`. Sem segredo real
- [x] 1.5 README do projeto: setup, envs, como rodar, como servir outro tenant em dev

## 2. Nucleo puro (`src/core/`)

- [x] 2.1 `tenant/schema.ts`: `TenantSchema` (Zod) com `slug`, `hosts`, `name`, `subtitle`, `cns`,
      `attributions`, `disabledSections`, `contacts`, `openingHours`, `owner`, `dpo`, `issRate`,
      `logos`, `legalFooter`
- [x] 2.2 `tenant/resolve.ts`: `resolveTenant(host, defaultSlug)` normalizando caixa, porta e `www`;
      lanca erro quando o slug padrao nao existe, em vez de servir a serventia errada
- [x] 2.3 `tenant/gating.ts`: `isSectionEnabled`, `enabledSections`, `noticeSectors` derivados das
      atribuicoes, com `disabledSections` como override
- [x] 2.4 `acts/catalog.ts`: catalogo de atos e nomes de atribuicoes, tipado
- [x] 2.5 `fees/calculate.ts`: `total = emolument + funds`; `iss = emolument * rate` como deducao;
      base da NFS-e = emolumento
- [x] 2.6 Testes do nucleo em `node --test`: schema aceita config valida e rejeita invalida; gating
      liga e desliga por atribuicao e por override; `resolveTenant` acha pelo host **sem depender do
      fallback** (usar slug padrao inexistente no caso de teste, senao o teste passa por acidente);
      composicao de valor do ato com um exemplo trabalhado

## 3. Tenants

- [x] 3.1 `src/core/tenant/tenants/marinho.ts` com os dados reais da serventia piloto
- [x] 3.2 Segundo tenant fictício, deliberadamente diferente: apenas `NOTAS`, sem editais, hosts e
      contatos proprios
- [x] 3.3 Registro e lookup por host cobrindo os dois, com teste afirmando que o host bate sem
      depender do fallback

## 4. Fatia vertical sem cor

- [x] 4.1 `src/lib/tenant.ts`: `getTenant()` lendo o header `host` (server-only), com fallback a
      `DEFAULT_TENANT`
- [x] 4.2 Pagina inicial em HTML sem estilo: nome da serventia, subtitulo, atribuicoes e lista de
      secoes habilitadas
- [x] 4.3 `generateMetadata` por tenant (titulo e favicon a partir da config)
- [x] 4.4 Rodar local com dois hosts distintos e conferir que devolvem conteudos diferentes

## 5. Camada de dados

- [x] 5.1 Drizzle + `@neondatabase/serverless` (driver `neon-http`), client em `src/db/`
- [x] 5.2 Schema inicial: `tenant_branding`, `tenant_content` (com `draft`/`published`),
      `audit_log`, mais as tabelas do Better Auth
- [x] 5.3 Zod das entidades derivado com `drizzle-zod`; refinamentos de negocio por cima
- [x] 5.4 Primeira migracao gerada, **SQL revisado a mao** e commitado
- [x] 5.5 `docs/migrations.md`: fluxo `generate` -> revisar -> commit -> `migrate`; `push` proibido;
      mudanca destrutiva em dois deploys

## 6. Autenticacao

- [x] 6.1 Better Auth com adapter Drizzle e sessao em banco; cookie HttpOnly, Secure, `SameSite=Lax`
- [x] 6.2 Seed do usuario admin a partir de `ADMIN_SEED_*`; sem endpoint de cadastro publico
- [x] 6.3 Middleware protegendo `/admin`, deixando `/admin/login` de fora
- [x] 6.4 Login, logout e uma pagina protegida, **sem estilo**
- [x] 6.5 Teste: sessao revogada no banco derruba o acesso na requisicao seguinte

## 7. Baseline de seguranca

- [x] 7.1 Cabecalhos de seguranca (CSP, HSTS) em `next.config.ts`
- [x] 7.2 Rate limit nas rotas de autenticacao e nas publicas de escrita
- [x] 7.3 `audit_log` gravando ator, acao, alvo e data, sem dado sensivel
- [x] 7.4 Conferir que nenhum segredo esta versionado e que todos vem de env

## 8. CI e qualidade

- [x] 8.1 `scripts/check-dashes.mjs`: proibe travessao e meia-risca em texto visivel
- [x] 8.2 `scripts/check-tokens.mjs`: proibe hex literal fora do bloco `@theme` e de arquivos de fonte
- [x] 8.3 Playwright parametrizado sobre os tenants, afirmando **estrutura**: cada host devolve o
      nome certo e exatamente as secoes esperadas pelo gating
- [x] 8.4 `.github/workflows/verify.yml`: `pnpm install --frozen-lockfile`, `tsc --noEmit`,
      `biome check`, `pnpm test`, `next build`, `check:dashes`, `check:tokens`,
      `openspec validate --all` (versao fixada), Playwright
- [x] 8.5 CI sem nenhum segredo: os testes nao tocam banco real
- [x] 8.6 `concurrency` cancelando execucao anterior do mesmo PR

## 9. Fechamento

- [x] 9.1 Build verde, testes passando, TypeScript strict limpo
- [ ] 9.2 Deploy na Vercel com os dois hosts resolvendo corretamente
- [x] 9.3 Conferir o criterio de aceite: dois hosts, duas serventias, zero CSS

## 1. Rota fixa em vez de flag

- [x] 1.1 Em `src/core/tenant/gating.ts`, mudar `SECTION_ROUTES["consulta-protocolo"]` de
      `/protocolo` para `/acompanhar`
- [x] 1.2 Em `src/app/(public)/layout.tsx`, trocar `/protocolo` por `/acompanhar` na lista
      `hrefs` do grupo "Serviços" em `NAV_GROUPS`
- [x] 1.3 Em `src/app/(public)/layout.tsx`, remover o import de `trackingHref`, a variável
      `lookupHref` lida da flag e a função `resolve()`; usar `SECTION_ROUTES`/`sectionNavLinks`
      diretamente em todo lugar que hoje passa por `resolve()`
- [x] 1.4 Em `src/app/(public)/page.tsx`, remover o import de `trackingHref` e o `await
      trackingHref()`; usar `SECTION_ROUTES["consulta-protocolo"]` como `action` do formulário da
      hero
- [x] 1.5 Em `src/app/(public)/solicitar/page.tsx`, remover o import de `trackingHref` e o
      `await trackingHref()`; passar `SECTION_ROUTES["consulta-protocolo"]` para `RequestForm`

## 2. Remover a flag e sua infraestrutura

- [x] 2.1 Remover `src/flags.ts`
- [x] 2.2 Remover `src/flags.test.ts`
- [x] 2.3 Remover `src/app/.well-known/vercel/flags/route.ts` (e o diretório
      `.well-known/vercel/flags/` se ficar vazio)
- [x] 2.4 Remover as dependências `flags` e `@flags-sdk/vercel` do `package.json` e atualizar o
      lockfile
- [x] 2.5 Remover `FLAGS` e `FLAGS_SECRET` do `.env.example`
- [x] 2.6 Remover a seção "Flag do acompanhamento (`/acompanhar`)" do `README.md`

## 3. Limpeza do OpenSpec

- [x] 3.1 Remover o diretório `openspec/changes/feature-flag-acompanhar/`
- [x] 3.2 Remover o diretório `openspec/changes/migrar-para-vercel-flags/`

## 4. Verificação

- [x] 4.1 Rodar `pnpm typecheck` e `pnpm lint`
- [x] 4.2 Rodar `pnpm test` (in-process) e confirmar que nenhum teste dependia de
      `src/flags.test.ts` ou do valor antigo de `SECTION_ROUTES["consulta-protocolo"]`
- [x] 4.3 Verificar manualmente: cabeçalho, submenu "Serviços", rodapé, menu do celular e o campo
      de busca da home apontam para `/acompanhar`
- [x] 4.4 Verificar manualmente: acesso direto a `/protocolo` continua funcionando (não virou
      404 nem redirect)
- [x] 4.5 Verificar manualmente: o link exibido após concluir um pedido em `/solicitar` aponta
      para `/acompanhar`

## 1. O núcleo

- [x] 1.1 `SECTION_DESCRIPTIONS` em `src/core/tenant/gating.ts`, uma linha por seção, e a descrição em cada link de `sectionNavLinks`.
- [x] 1.2 A home (`src/app/(public)/page.tsx`) lê as descrições de lá em vez de repetir o texto.

## 2. O shell público

- [x] 2.1 `NavLinks` aceita mostrar a descrição sob o rótulo.
- [x] 2.2 `NAV_GROUPS` no layout, alimentando o rodapé, o menu do celular e o painel "Mais".
- [x] 2.3 O painel "Mais" na barra do desktop, popover nativo com `MenuPopover` dentro, ancorado por CSS em `globals.css`.
- [x] 2.4 O menu do celular agrupado por tarefa, com "Início" no topo e rolagem interna.
- [x] 2.5 A barra completa só a partir de `lg`, com rótulos sem quebra de linha.

## 3. Testes

- [x] 3.1 E2e no desktop: "Mais" abre, mostra os grupos e as descrições, leva à página e fecha sozinho.
- [x] 3.2 E2e no desktop: o painel não repete o que a barra já mostra.
- [x] 3.3 E2e em 768px: o cabeçalho não estoura a largura da tela e o menu do celular é o que aparece.
- [x] 3.4 Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `check:dashes`, `check:tokens` e `check:a11y`, mais `public-nav.spec.ts` e `tenants.spec.ts`.

## 4. Fechamento

- [x] 4.1 Abrir PR; o merge é decisão do Vinícios.
- [ ] 4.2 Depois do merge, `openspec archive reorganizar-o-menu-do-site`.

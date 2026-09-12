## 1. Tokens

- [x] 1.1 Em `src/app/globals.css`, `--brand-on-dark-muted` passa a `color-mix(in srgb, white
  70%, var(--brand-primary))`, com um comentário dizendo por quê. E o bloco dos derivados
  passa a ser declarado em `:root, [data-theme]`: só em `:root`, o `var(--brand-primary)`
  resolvia no `<html>`, onde vale o piloto, e os três derivados saíam verdes em todo tenant
  (design, decisão 4). Conferido no navegador: oliva computa `#c5cac0` (70% branco + `#3f4f2e`),
  Marinho computa o verde.
- [x] 1.2 `--color-admin-on-dark-muted: var(--brand-on-dark-muted)`; remover
  `--palette-admin-on-dark-muted` e conferir que nada mais o referencia (`grep`).

## 2. Varredura

- [x] 2.1 Em `scripts/check-a11y.mjs`, incluir `/admin/esqueci-senha` nas rotas.
- [x] 2.2 Com o dev server no ar, `pnpm check:a11y` passa nos cinco hosts, inclusive
  `/plataforma`, `/admin/login` e `/admin/esqueci-senha`.

## 3. Fechamento

- [x] 3.1 `pnpm lint`, `pnpm check:tokens`, `pnpm test` (inclui `palette.test.ts`).
- [x] 3.2 Conferir no navegador o rodapé do site e o login no tema oliva e num dos outros, para
  ver que o apagado continua abaixo do corpo.

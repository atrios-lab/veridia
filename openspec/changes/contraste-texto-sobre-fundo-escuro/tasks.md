## 1. Tokens

- [ ] 1.1 Em `src/app/globals.css`, `--brand-on-dark-muted` passa a `color-mix(in srgb, white
  70%, var(--brand-primary))`, com um comentário dizendo por quê (o oliva, o primário mais
  claro, caía em 4,5:1 no limite).
- [ ] 1.2 `--color-admin-on-dark-muted: var(--brand-on-dark-muted)`; remover
  `--palette-admin-on-dark-muted` e conferir que nada mais o referencia (`grep`).

## 2. Varredura

- [ ] 2.1 Em `scripts/check-a11y.mjs`, incluir `/admin/esqueci-senha` nas rotas.
- [ ] 2.2 Com o dev server no ar, `pnpm check:a11y` passa nos cinco hosts, inclusive
  `/plataforma`, `/admin/login` e `/admin/esqueci-senha`.

## 3. Fechamento

- [ ] 3.1 `pnpm lint`, `pnpm check:tokens`, `pnpm test` (inclui `palette.test.ts`).
- [ ] 3.2 Conferir no navegador o rodapé do site e o login no tema oliva e num dos outros, para
  ver que o apagado continua abaixo do corpo.

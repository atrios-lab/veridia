# Tasks — Avisos institucionais na transparência

## 1. Seção de avisos na página pública

- [x] 1.1 Adicionar a seção "Avisos institucionais" em `src/app/(public)/transparencia/page.tsx`,
  antes de "Documentos": heading `h2`, dois cards no padrão visual da página (tokens
  `brand-*`, `rounded-2xl border border-brand-border bg-brand-card`), cada aviso com `h3`
  e texto interpolando `tenant.name`
- [x] 1.2 Escrever o texto do aviso de lavagem de dinheiro conforme a spec (compromisso,
  Provimento CNJ n. 149/2023, beneficiários finais, alto valor; sem a frase do "manual
  prévio", sem citar operações) com link para
  `https://atos.cnj.jus.br/files/original1336562023090464f5dd78ec839.pdf` em nova aba
  (`target="_blank" rel="noopener"`)
- [x] 1.3 Escrever o texto do aviso de pessoas idosas conforme a spec (cautelas do
  Provimento CGJ-RN n. 053/2010 e Lei n. 10.741/2003), sem link externo

## 2. Verificação

- [x] 2.1 Cobrir a seção no e2e da página pública (em `e2e/admin-transparency.spec.ts` ou
  spec público vizinho): avisos visíveis em `/transparencia` com o nome da serventia, e
  visíveis mesmo sem documentos publicados
- [x] 2.2 Conferir a página nos temas claro e escuro pelo host do cartório (não `localhost`
  puro), sem regressão de contraste AA; capturar screenshots para o PR
- [x] 2.3 Rodar checks do repo (Biome, `tsc`, testes) e abrir PR por branch (nunca push na
  `main`)

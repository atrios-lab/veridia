## Context

A regra pura em `src/core/tenant/brand-image.ts` mapeia cada `BrandImageKind` a um teto em bytes.
Hoje `logo-light`, `logo-dark`, `seal-light` e `seal-dark` compartilham `LOGO_MAX_BYTES = 1 MB`;
`hero` tem seu próprio `HERO_MAX_BYTES = 4 MB`. A tela de Identidade Visual só grava um par
claro/escuro (rotulado "Logotipo" na UI, mas passado como `seal-light`/`seal-dark` em
`actions.ts`, populando tanto `logos.light/dark` quanto `logos.seal.light/dark`). `checkBrandImage`
é a única porta de validação, chamada em `storeBrandImage` (`src/lib/uploads.ts`); não há checagem
de tamanho no cliente, só o `accept` do input.

## Goals / Non-Goals

**Goals:**
- Elevar o teto de `logo-light`/`logo-dark`/`seal-light`/`seal-dark` de 1 MB para 3 MB.
- Manter a mensagem de erro (`describeBrandImageProblem`) e a dica na tela coerentes com o novo
  valor.

**Non-Goals:**
- Não mexe no teto do hero (4 MB).
- Não adiciona validação de tamanho no cliente (fora do escopo; o servidor já é a fronteira real).
- Não separa o teto de `seal-*` do de `logo-*` — continuam a mesma constante, como hoje.

## Decisions

### Um único ponto de mudança: `LOGO_MAX_BYTES`

Trocar `1 * 1024 * 1024` por `3 * 1024 * 1024` em `brand-image.ts` já propaga para
`checkBrandImage`, `describeBrandImageProblem` (a mensagem de erro calcula o MB a partir do
`limit`) e para os quatro kinds que a usam. Nenhuma outra função muda. Alternativa descartada:
criar uma constante separada para `seal-*` — não há pedido para os dois tetos divergirem, e
divergir aumentaria a superfície sem necessidade (ver Non-Goals).

### Texto da tela é atualizado a mão

O hint em `visual-identity-form.tsx:270` ("até 1 MB") é uma string estática, não derivada da
constante. Atualizá-la para "até 3 MB" no mesmo commit evita a tela prometer um limite que o
servidor não aplica mais.

## Risks / Trade-offs

- [Arquivo de 3 MB é mais lento para subir em conexão ruim] → Ainda é um teto baixo para upload
  de imagem; o ganho de aceitar PNGs comuns supera o custo.
- [Hint e constante podem voltar a divergir no futuro] → Mesmo risco que já existia com "1 MB";
  não é introduzido por esta change.

## Migration Plan

Deploy único, sem migração de banco. Rollback é reverter o commit.

## Context

Os cinco temas do site público vivem em `src/app/globals.css` como blocos de tokens de paleta
(`--palette-<tema>-*`), mapeados para `--brand-*` por `[data-theme]`. Dois tons são derivados
em `:root` por `color-mix` a partir do primário: `--brand-on-dark-body` (86% branco) e
`--brand-on-dark-muted` (62% branco). O painel administrativo herda a identidade do tenant via
os mesmos `--brand-*` (`--color-admin-primary: var(--brand-primary)`), mas mantém em `@theme
static` alguns tokens fixos "de significado": erro, campo somente leitura, e, por acidente
histórico, `--palette-admin-on-dark-subtitle: #c8d4ca` e `--palette-admin-on-dark-muted:
#8fa896`, que eram do painel verde único e ficaram quando o painel passou a repintar com o
tenant.

Contrastes medidos (WCAG 2.x, texto pequeno exige 4,5:1):

| tema | primário | on-dark-muted 62% | admin muted `#8fa896` | admin subtitle `#c8d4ca` |
|---|---|---|---|---|
| verde-dourado | #123c2a | 5,76 | 4,81 | 8,05 |
| marinho-bronze | #16324f | 6,01 | 5,12 | 8,56 |
| vinho-perola | #55202c | 5,87 | 5,04 | 8,42 |
| grafite-cobre | #26302d | 6,23 | 5,32 | 8,90 |
| oliva-terracota | #3f4f2e | 4,56 | 3,47 | 5,79 |

## Decisions

### 1. Subir a derivação do apagado para 70% de branco, para todos os temas

`--brand-on-dark-muted: color-mix(in srgb, white 70%, var(--brand-primary))`. Resultado: oliva
5,31; grafite 7,50; os demais entre 7 e 8. Alternativa: override só no bloco do oliva.
Descartada: a regra do arquivo é que um tema é uma paleta e o derivado vem da derivação; um
override por tema é o começo de cinco. O custo é o apagado ficar um pouco mais claro nos quatro
temas que já passavam, ainda nitidamente abaixo do corpo (86%).

### 2. O apagado do painel deriva da marca, como o resto da identidade

`--color-admin-on-dark-muted: var(--brand-on-dark-muted)`; `--palette-admin-on-dark-muted`
sai. É o mesmo movimento que o painel já fez com primário e acento. `--palette-admin-on-dark-
subtitle` (`#c8d4ca`) fica: passa em todos os temas (5,79 no pior) e é o tom que o painel usa
em várias telas; trocá-lo é mudança de aparência que esta change não pede.

### 3. A varredura cobre as duas telas de autenticação

`check-a11y.mjs` já lista `/admin/login`; `/admin/esqueci-senha` usa o mesmo token sobre o
mesmo fundo e entra na lista, para o próximo tom fixo esquecido aparecer na varredura.

### 4. Os derivados passam a ser declarados também em `[data-theme]` (achado na implementação)

Ao conferir no navegador, o apagado computado no tenant oliva era 70% de branco misturado com
`#123c2a`, o primário do verde-dourado, e não com `#3f4f2e`. Causa: os três tons derivados
(`--brand-on-dark-body`, `--brand-on-dark-muted`, `--brand-accent-line`) eram declarados só em
`:root`, e um `var()` resolve no elemento que declara a propriedade; o `data-theme` fica num
`div` (`(public)/layout.tsx`, `admin/layout.tsx`), não no `<html>`. Resultado: em todo tenant
os derivados vinham do piloto, e a promessa do comentário ("o tom derivado sempre pertence à
paleta de onde veio") não valia. A correção é declarar o bloco em `:root, [data-theme]`, para
resolver no elemento do tema. Com isso as contas da tabela acima passam a valer de fato: oliva
5,3 no apagado (era 4,95 com o verde misturado a 70%, e abaixo de 4,5 a 62%). Efeito
colateral bem-vindo: `on-dark-body` e `accent-line` também passam a seguir o tema.

## Risks / Trade-offs

- [O apagado fica mais claro nos temas que já passavam] → É uma diferença de 62% para 70% de
  branco num texto de 12 px sobre fundo escuro; a hierarquia com o corpo (86%) se mantém.
- [`color-mix` no navegador arredonda diferente da conta] → 70% dá 5,3 no oliva, folga de
  0,8 sobre o mínimo; a varredura com o axe é o juiz final.

## Migration Plan

Deploy único. Rollback é reverter.

## 1. Tokens: repontar identidade, manter estado

- [x] 1.1 Em `src/app/globals.css`, no bloco `@theme inline` dos `--color-admin-*`, repontar os
      nove tokens de identidade (`primary`, `primary-soft`, `accent`, `on-dark-accent`, `surface`,
      `card-surface`, `border`, `active-border`, `muted`) de `var(--palette-admin-*)` para
      `var(--brand-*)`, conforme a tabela da Decisão 2 do design.md (`surface` → `--brand-tint`,
      `card-surface` → `--brand-surface`, `active-border` → `--brand-border`, os demais 1:1 pelo
      nome)
- [x] 1.2 Remover do bloco `@theme static` os nove `--palette-admin-*` de identidade que ficam
      órfãos depois de 1.1; manter intactos os de estado (`input-bg`, `input-border`,
      `readonly-bg`, `error-*`, `warning-*`, `success-*`, `card`, `text`, `faint`,
      `on-dark-subtitle`, `on-dark-muted`) e o comentário do bloco, atualizado para não afirmar mais
      que o painel é fixo
- [x] 1.3 Rodar `pnpm check:tokens` (ou script equivalente) para confirmar que nenhum hex novo foi
      introduzido fora de `@theme`

## 2. Layout raiz do painel: tema e fonte

- [x] 2.1 Em `src/app/admin/layout.tsx`, tornar o componente `async`, chamar `getTenant()` e
      aplicar `data-theme={tenant.theme}` no wrapper existente
- [x] 2.2 Trocar a importação fixa de `Spectral` pelo mapa `SERIF` de `src/lib/fonts.ts`, aplicando
      `SERIF[tenant.theme].variable` e `SERIF[tenant.theme].className` no lugar de
      `spectral.variable`
- [x] 2.3 Atualizar o comentário do arquivo que hoje diz "the admin is the platform's fixed
      aesthetic, never a tenant's theme" — não é mais verdade

## 3. Specs e contexto do projeto

- [x] 3.1 Editar o parágrafo de contexto em `openspec/config.yaml`: remover "painel admin
      (estetica da plataforma, fixa, nunca tematizavel por cartorio)" e descrever que o painel
      herda o tema publicado do tenant
- [x] 3.2 `add-admin-visual-identity` arquivada em 2026-08-05. Durante o archive em lote desta
      sessão, mais três specs surgiram com a mesma invariante de "painel fixo" ainda não coberta
      pelo delta original (`admin-auth`, `public-site-foundation`, `admin-shell`); deltas
      adicionados a `theme-admin-panel/specs/` para as quatro capacidades antes de sincronizar.

## 4. Checagem visual

- [x] 4.1 Rodado o painel local com Cartório Marinho (verde-dourado, publicado) e Tabelionato
      Aurora (observado em vinho-pérola e depois verde-dourado — a serventia estava sendo editada
      ao vivo durante a checagem, confirmando que o painel realmente segue o que está publicado a
      cada request): login, dashboard, Configurações e um banner de erro (`?erro=1`) conferidos;
      contraste bom em ambos os casos observados
- [x] 4.2 Distinção `admin-surface`/`admin-card-surface` (página vs. cartão) ficou visível nos
      casos observados; nenhum ajuste de mapeamento necessário
- [x] 4.3 Confirmado: selecionar um estilo não publicado na prévia atualiza só a caixa da prévia;
      sidebar, faixa de abas e cartões do painel ao redor continuam no estilo publicado

## 5. Testes

- [x] 5.1 `e2e/admin-login.spec.ts`: novo teste "the panel carries each office's own theme, not a
      shared fixed one" — confere `data-theme` de Marinho (`verde-dourado`) e que o de Aurora
      difere do de Marinho, sem depender de qual estilo exato Aurora tem publicado no momento
- [x] 5.2 Suíte `node --test` (129 testes) passa sem alteração; esta mudança não toca
      `src/core/tenant` nem schema

## 1. Paletas e fontes

- [x] 1.1 Acrescentar `petroleo-ouro`, `ameixa-champanhe`, `cafe-caramelo`, `indigo-areia` e
      `azul-prata` a `THEMES` em `src/core/tenant/schema.ts`.
- [x] 1.2 Declarar as cores cruas e o bloco `[data-theme]` de cada um em `src/app/brand-palettes.css`.
- [x] 1.3 Espelhar as cores em `src/core/tenant/palette.ts`.
- [x] 1.4 Ligar cada tema a uma serifada em `src/lib/fonts.ts` (Merriweather, Playfair Display,
      Crimson Pro, Literata, Source Serif 4), com `preload: false`, como as demais.

## 2. Tela de Identidade visual

- [x] 2.1 Nome e descrição de cada estilo novo em `THEME_META`.

## 3. Verificação

- [x] 3.1 Teste de contraste dos pares de texto de todos os estilos em `src/lib/palette.test.ts`.
- [x] 3.2 Bateria do CI (typecheck, lint, test, checks, openspec validate, build).

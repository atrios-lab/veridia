## Why

O site de cada serventia escolhe um entre cinco estilos (paleta mais serifada). Com mais serventias
na plataforma, cinco estilos fazem cartórios vizinhos ficarem com a mesma cara, e algumas
serventias pediram tons que não estão entre os cinco (azul, café, roxo). O pedido do dono do
projeto (23/11/2026) é oferecer mais temas.

## What Changes

- Cinco estilos novos, somando dez: Petróleo & Ouro (Merriweather), Ameixa & Champanhe (Playfair
  Display), Café & Caramelo (Crimson Pro), Índigo & Areia (Literata) e Azul & Prata (Source
  Serif 4).
- Cada estilo novo segue a mesma estrutura de tokens dos cinco atuais, em `brand-palettes.css` e no
  espelho em TypeScript usado pelos PDFs (`palette.ts`).
- A tela Configurações > Identidade visual passa a listar os dez, cada um com nome, descrição,
  amostras de cor e o nome escrito na própria serifada.
- Um teste novo mede o contraste dos pares de texto de todos os estilos (4,5:1 ou mais), porque a
  varredura de acessibilidade só alcança estilos que alguma serventia já usa.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-visual-identity`: a escolha do estilo passa de cinco para dez opções.
- `public-site-foundation`: a lista de serifadas suportadas passa de cinco para dez.

## Impact

- `src/core/tenant/schema.ts` (`THEMES`), `src/core/tenant/palette.ts`, `src/app/brand-palettes.css`,
  `src/lib/fonts.ts`, `visual-identity-form.tsx` e `src/lib/palette.test.ts`.
- Nenhuma serventia muda de estilo: as existentes continuam no tema que já têm.
- Nenhuma migração de banco: o estilo escolhido é gravado no JSON de identidade visual da serventia
  e validado pelo enum `THEMES` no servidor. Nada é apagado.
- Rollback: reverter o commit. Antes disso, confira se alguma serventia já escolheu um dos estilos
  novos; se sim, troque o estilo dela na tela antes de reverter. Senão, a identidade visual gravada
  dela deixa de passar na validação (`OfficeBrandOverrideSchema`) e é ignorada por inteiro: o site
  volta ao estilo, logotipos, foto de abertura e seções do arquivo de configuração até ela salvar
  de novo.

## Why

A serventia piloto (Ofício Único de Ielmo Marinho / RN) informou que um provimento da
Corregedoria do RN passou a vedar o uso de nome que não seja o da própria serventia. O site,
os requerimentos em PDF, os e-mails e o painel hoje apresentam a serventia como
"Cartório Marinho", um nome fantasia. O pedido da serventia é trocar esse nome pelo que a
identifica de fato, em tudo que o cidadão lê.

## What Changes

- O nome de exibição do tenant `cartorio-marinho` passa de "Cartório Marinho" para
  "Cartório Ielmo Marinho/RN" (grafia com barra sem espaços, conforme a serventia escreveu;
  caixa normal, como os demais tenants, porque o cabeçalho, o `<title>`, o remetente de e-mail
  e o rodapé do PDF imprimem a string tal como está).
- O subtítulo continua sendo a denominação oficial, "Ofício Único de Ielmo Marinho / RN",
  sem mudança de schema.
- O texto de apresentação ("Quem somos") do tenant deixa de citar o nome fantasia.
- O campo "Nome fantasia" da Adequação ao Provimento troca o exemplo de ajuda
  ("ex.: Cartório Marinho") por um exemplo fictício, que não cite uma serventia real.
- Testes e README que casam o nome antigo acompanham.
- Os logotipos e o selo (que trazem "CARTÓRIO MARINHO" gravado na imagem) **não** mudam em
  código: a serventia vai enviar a arte nova pela Identidade Visual do painel.

Como todas as ocorrências derivam de um único ponto de verdade (`tenant.name`), site, PDFs de
requerimento e declaração, e-mails e painel mudam juntos, sem tocar em cada leitor.

## Não-objetivos

- Hero da home (`home.title`): fica como está. É editável pela Identidade Visual do painel; a
  serventia ajusta junto com o logo, se quiser.
- Os outros sete tenants, que também usam "Cartório de X" como nome de exibição. Se o
  provimento valer para todos, é outra change, depois de ler o texto normativo.
- Slug `cartorio-marinho`, domínio e endereços de e-mail: internos ou já corretos.
- Tornar o subtítulo opcional ou mudar o significado dos campos `name`/`subtitle`.
- Substituir os arquivos de logo em `public/logos/`.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

(nenhuma: o comportamento especificado — cabeçalho, PDF e e-mail exibem nome e subtítulo do
tenant — não muda; muda o valor configurado de um tenant e um texto de ajuda.)

## Impact

- `src/core/tenant/tenants/marinho.ts`: `name` e `about`.
- `src/core/compliance/sections.ts`: texto de ajuda do campo `tradeName`.
- `src/core/auth/invite.test.ts`, `src/core/request/declaracao.test.ts`,
  `src/core/request/channels.test.ts`: fixtures e asserções com o nome antigo.
- `README.md`: três menções ao nome antigo.
- Nenhuma migração de banco, API pública ou dependência afetada. Overrides já salvos no
  banco (contato, marca, DPO) não carregam `name`, então não há dado a corrigir.

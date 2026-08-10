## Why

O loop das publicações está aberto: o painel publica (change `add-office-publications`, implementada — tipo, vigência por data, pré-visualização), mas a página onde o cidadão leria, `/editais`, é um `ComingSoon` que só lista os setores. Proclamas de casamento e edital de intimação de protesto são publicações **legalmente obrigatórias** — publicar onde ninguém lê não cumpre a finalidade do ato. O legado (`/Users/ntpaulo/cartorio-marinho`) tem essa página funcionando por setor; esta change traz esse comportamento para o Veridia, no padrão do Veridia.

## What Changes

- A página pública `/editais` deixa de ser `ComingSoon` e passa a exibir as publicações **vigentes** da serventia, organizadas por setor, renderizadas no servidor (sem fetch no cliente, diferente do legado).
- A publicação ganha **setor** (`sector`, anulável): proclamas pertencem sempre ao setor `proclamas`; um edital (`publicNotice`) escolhe o setor no formulário do painel, entre os setores que as atribuições da serventia permitem. Aviso (`notice`) segue sendo conteúdo da home, sem setor.
- Cada setor exibe a explicação legal fixa (que tipo de edital, com base em que lei), como no legado — texto idêntico entre serventias, declarado como config-as-code no núcleo, ao lado do mapa setor→atribuição que já existe.
- "Vazio honesto", regra do legado que fica: só aparecem setores **com publicação vigente**; sem nenhuma, a página diz que não há edital publicado no momento.
- A publicação ganha **anexo opcional** (PDF ou imagem): o operador sobe o arquivo do edital no painel, e a página pública oferece "Ver o edital (PDF)" ao lado do texto — como no legado. O texto continua obrigatório: o anexo é o documento assinado, não o substituto do que o cidadão lê na página.
- **Não-objetivos**:
  - Página de detalhe ou link permanente por edital (o legado também não tem; a lista é a página).
  - Setor `notas` (o legado listava; o gating do Veridia decidiu por 5 setores e essa decisão fica — edital sem setor cai num grupo genérico da serventia).
  - Mudar a seção "Proclamas e avisos" da home, RSS, ou notificação.

## Capabilities

### New Capabilities
<!-- Nenhuma. -->

### Modified Capabilities
- `office-publications`: a publicação ganha setor, o formulário do painel o pergunta quando o tipo exige, e a página pública `/editais` entrega o que está vigente por setor. (A spec desta capability vive na change `add-office-publications`, implementada e não arquivada; este delta é ADDED.)

## Impact

- `src/core/publications/publication.ts`: campo `sector` no modelo e no schema do formulário; derivação proclamas→`proclamas`.
- `src/core/tenant/gating.ts` (ou módulo vizinho): metadados fixos por setor (sigla, nome, tipo de edital, base legal) ao lado de `NOTICE_SECTOR_ATTRIBUTION`.
- `src/db/schema.ts` + migração Drizzle: coluna `sector` anulável em `office_publications` (expand, deploy único — **rodar `pnpm db:migrate` antes do deploy**, como na migração anterior).
- `src/app/admin/(dashboard)/publicacoes/`: select de setor no formulário quando `publicNotice`, setor visível na lista e na pré-visualização (requisito de paridade já existente).
- `src/app/(public)/editais/page.tsx`: a página real, no lugar do `ComingSoon`.
- `src/lib/publications.ts`: `livePublications` já existe e serve; no máximo um filtro por tipo. Ganha a gravação do anexo e a troca de arquivo (apagando o anterior).
- Novo `src/app/(public)/editais/[id]/arquivo/route.ts`: GET que serve o anexo, apenas de publicação vigente — rascunho e expirado não vazam nem para quem descobrir o id.
- `e2e/tenants.spec.ts` ("the notice sectors match the attributions") hoje espera todos os setores da atribuição na página; com o vazio honesto, passa a esperar os setores **com publicação vigente** — o teste muda junto, deliberadamente.

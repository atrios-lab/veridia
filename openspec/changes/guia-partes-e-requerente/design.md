## Context

A guia é gravada como JSON validado pelo `GuideSchema`. O pedido do site passa pelo `PublicGuideRequestSchema`, e `guideFromRequest` o transforma na guia do painel. O PDF e o Word são desenhados a partir das seções de `buildGuideDocument`.

## Decisions

- **Negrito por marcação**: o texto marca o negrito com `**...**`, e `splitBold` o divide em pedaços. O PDF troca a fonte a cada pedaço, e o Word cria um trecho em negrito. Se uma marca ficar aberta, o parágrafo sai como foi digitado, para nunca deixar o resto do texto em negrito.
- **Requerente no JSON**: o campo `requester` tem o papel, o nome, o CPF e o mandato, e o padrão é "não informado". O nome e o CPF vêm de quem fez o pedido no site.
- **Cônjuge sem gênero presumido**: o texto fica "NOME, CPF nº ...", porque o casamento entre pessoas do mesmo sexo é válido.
- **Anexos por parte**: cada grupo (vendedor, comprador, imóvel e procuração) usa o campo `guiaAnexos`, enviado direto ao armazenamento como os demais anexos. O nome de cada arquivo diz de qual parte ele é.
- **Contagem de Pedidos**: `countByStatus` aplica o mesmo filtro `notTaxGuide()` da lista.

## Risks / Trade-offs

- Guias antigas não têm requerente: elas recebem o padrão "não informado" e a seção "Das partes" só lista as partes.

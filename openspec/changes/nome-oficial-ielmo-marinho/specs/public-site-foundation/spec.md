## ADDED Requirements

### Requirement: Nome de exibição identifica a serventia
O nome de exibição do tenant (`tenant.name`), impresso no cabeçalho e rodapé do site, no `<title>`, no cabeçalho e rodapé dos PDFs de requerimento e declaração, no remetente e no corpo dos e-mails e no painel, DEVE (SHALL) identificar a serventia pelo município e UF ou pela denominação oficial, nunca por nome fantasia. O subtítulo (`tenant.subtitle`) DEVE (SHALL) continuar sendo a denominação oficial da serventia, como consta no Justiça Aberta. O texto de apresentação ("Quem somos") NÃO DEVE (SHALL NOT) apresentar a serventia por um nome fantasia.

#### Scenario: Serventia piloto sem nome fantasia
- **WHEN** qualquer rota pública, PDF ou e-mail do tenant `cartorio-marinho` é gerado
- **THEN** a serventia aparece como "Cartório Ielmo Marinho/RN", com o subtítulo "Ofício Único de Ielmo Marinho / RN", e a string "Cartório Marinho" não ocorre em nenhum texto gerado pelo código

#### Scenario: Um único ponto de verdade
- **WHEN** o nome de exibição de um tenant é alterado na sua configuração
- **THEN** site, PDFs, e-mails e painel passam a exibir o novo nome sem alteração em nenhum leitor

#### Scenario: Exemplo de nome fantasia não cita serventia real
- **WHEN** a Adequação ao Provimento exibe o campo "Nome fantasia"
- **THEN** o texto de ajuda usa um exemplo fictício, sem nomear uma serventia cadastrada

## ADDED Requirements

### Requirement: Numeração de documentos

O painel SHALL listar em Configurações todo documento numerado da plataforma e permitir à serventia informar,
por ano, o próximo número de cada um. O próximo número SHALL ser o maior entre o informado e o último usado
mais um, e um número já usado SHALL ser recusado.

#### Scenario: Continuar a numeração do livro

- **WHEN** a serventia informa que as guias de 2026 seguem da 020 e emite uma guia
- **THEN** a guia sai com o número 020/2026 e a seguinte com 021/2026

#### Scenario: Número já usado

- **WHEN** a serventia informa como próximo um número que já foi usado no ano
- **THEN** o painel recusa e diz qual é o próximo número livre

#### Scenario: Ano seguinte

- **WHEN** a serventia informa o próximo número do ano que vem
- **THEN** o ano atual segue sem mudança e o ano novo começa no número informado

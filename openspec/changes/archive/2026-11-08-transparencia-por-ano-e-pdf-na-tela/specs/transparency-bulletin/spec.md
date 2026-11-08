## ADDED Requirements

### Requirement: Boletins por ano na página pública

A página `/transparencia` SHALL apresentar os boletins publicados agrupados por ano de referência,
do mais recente para o mais antigo. Cada ano SHALL ser um bloco recolhível que mostra o ano e a
quantidade de boletins, e só o ano mais recente SHALL vir aberto. Dentro de cada ano, os meses SHALL
aparecer numa grade fixa de janeiro a dezembro: o mês com boletim SHALL dar acesso ao PDF, e o mês
sem boletim SHALL aparecer apagado, sem link, identificado como não publicado para tecnologia
assistiva. O boletim preliminar SHALL trazer a marca "Preliminar" na própria célula. O aviso sobre a
parcela privada SHALL continuar acima dos anos, com ou sem boletim.

#### Scenario: Ano mais recente aberto

- **WHEN** o cidadão acessa /transparencia de um tenant com boletins de 2025 e 2026
- **THEN** o bloco de 2026 aparece aberto com a grade de meses, e o de 2025 aparece fechado,
  mostrando "2025 · 12 boletins"

#### Scenario: Mês sem boletim

- **WHEN** o ano de 2026 tem boletins de janeiro a agosto
- **THEN** setembro a dezembro aparecem na grade apagados, sem link, e o leitor de tela anuncia
  "setembro de 2026: não publicado"

#### Scenario: Boletim preliminar

- **WHEN** o boletim de agosto/2026 está publicado como preliminar
- **THEN** a célula de agosto leva ao PDF e mostra a marca "Preliminar"

#### Scenario: Sem boletim publicado

- **WHEN** o tenant não tem boletim publicado
- **THEN** a seção mostra o aviso da parcela privada e a mensagem de que nenhum boletim foi
  publicado, sem bloco de ano

## ADDED Requirements

### Requirement: Guias de recolhimento

O painel SHALL gerar a guia de recolhimento (ITIV/ITBI, ITCD, laudêmio municipal, certidão imobiliária) com as
partes qualificadas, o imóvel, o valor declarado, a alíquota e o fundamento, numerada por ano, em PDF e em Word,
com a identificação da serventia. Todo dado da guia SHALL ser editável no painel, inclusive alíquota, imposto e
número. Excluir uma guia SHALL tirá-la da lista sem apagar o registro.

#### Scenario: ITIV emitida e ajustada

- **WHEN** o funcionário emite uma guia de ITIV de R$ 27.000,00 em Ielmo Marinho
- **THEN** ela sai como 001/2026, com 3% e imposto estimado de R$ 810,00; se a alíquota for trocada para 2%,
  o imposto passa a R$ 540,00 e o número continua o mesmo

#### Scenario: ITCD progressivo do RN

- **WHEN** a guia é de ITCD sobre R$ 1.200.000,00
- **THEN** o imposto é de R$ 45.000,00: 3% até R$ 500 mil, 4% até R$ 1 milhão e 5% sobre o restante

#### Scenario: Guarda de um ano

- **WHEN** faltam 30 dias para uma guia completar 12 meses no sistema
- **THEN** o painel pede que a serventia baixe as guias do ano e as guarde no próprio arquivo

## ADDED Requirements

### Requirement: Catalogo de atos e atribuicoes como dado tipado

O sistema DEVE (SHALL) expor o catalogo de atos e os nomes das atribuicoes como dado puro e tipado
no nucleo de dominio, sem I/O. Os codigos de atribuicao DEVEM (SHALL) permanecer nas siglas oficiais
(`RCPN`, `NOTAS`, `RI`, `PROTESTO`, `RTD`, `RCPJ`).

#### Scenario: Atos filtrados pela atribuicao da serventia

- **WHEN** o catalogo e consultado para uma serventia
- **THEN** retorna apenas os atos cujas atribuicoes a serventia possui

#### Scenario: Sigla oficial preservada

- **WHEN** uma atribuicao e representada em codigo
- **THEN** o valor e a sigla oficial, sem traducao

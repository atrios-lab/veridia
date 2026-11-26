## ADDED Requirements

### Requirement: Livro 3 sem imóvel
O sistema DEVE (SHALL) registrar no Livro 3 os atos do art. 178 da Lei nº 6.015/1973 com natureza, título, partes, valor, vencimento, garantias, local dos bens, dados do pacto antenupcial e protocolo, sem exigir imóvel, e DEVE (SHALL) mostrar, para cada natureza, o "Como fazer" com a regra vigente e a fonte.

#### Scenario: Penhor rural sem matrícula
- **WHEN** a funcionária cadastra um contrato de penhor rural sem informar matrícula
- **THEN** o registro é salvo sem campos de imóvel, com as partes no Indicador Pessoal, e o "Como fazer" explica que a cédula rural não se inscreve mais (Lei nº 13.986/2020) e que se registra o penhor

#### Scenario: Pacto antenupcial
- **WHEN** a funcionária escolhe a natureza "Convenção antenupcial"
- **THEN** o formulário pede os cônjuges, o regime de bens, a data do casamento, o domicílio e a escritura, e o "Como fazer" manda averbar o pacto nas matrículas dos imóveis do casal

## ADDED Requirements

### Requirement: Perímetro georreferenciado e mapa da serventia
O sistema DEVE (SHALL) ler os vértices do memorial descritivo ou da planilha do Sigef, calcular área e perímetro, desenhar a planta da matrícula e mostrar, num mapa único, os perímetros em vigor com as sobreposições entre eles, e NÃO DEVE (SHALL NOT) tirar um perímetro do banco: apagar só marca.

#### Scenario: Dois imóveis que se sobrepõem
- **WHEN** a funcionária lança o perímetro de uma matrícula que avança 50 m sobre outra
- **THEN** a matrícula e o mapa mostram a sobreposição, com a área, antes do registro

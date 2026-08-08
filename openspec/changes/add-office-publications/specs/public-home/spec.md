## ADDED Requirements

### Requirement: Seção "Proclamas e avisos" só aparece com publicação vigente

A home SHALL exibir uma seção "Proclamas e avisos" com as publicações atualmente vigentes
(proclamas, aviso e edital), ordenadas da mais recente para a mais antiga. A seção MUST NOT
aparecer quando a serventia não tem nenhuma publicação vigente.

#### Scenario: Seção some sem publicação vigente
- **WHEN** a serventia não tem nenhuma publicação com data de entrada e saída cobrindo o dia
  corrente
- **THEN** a home não renderiza a seção "Proclamas e avisos"

#### Scenario: Seção aparece com publicação vigente
- **WHEN** a serventia tem ao menos uma publicação vigente
- **THEN** a home mostra a seção com o tipo, o título e a data de entrada de cada uma

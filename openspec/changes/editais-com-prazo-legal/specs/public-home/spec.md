## ADDED Requirements

### Requirement: Seção de publicações leva o nome do que está no ar
A seção de publicações da página inicial DEVE (SHALL) se chamar pelos tipos vigentes ("Proclamas", "Avisos", "Editais", ou a combinação, como "Avisos e editais"), e cada cartão DEVE (SHALL) trazer o tipo exato publicado, a data da publicação em curso, o prazo legal quando houver e o anexo.

#### Scenario: Só editais no ar
- **WHEN** a única publicação vigente é um edital
- **THEN** a seção se chama "Editais" e o cartão diz "Edital", não "Proclamas" nem "Aviso"

#### Scenario: Aviso e edital no ar
- **WHEN** há um aviso e um edital vigentes
- **THEN** a seção se chama "Avisos e editais" e cada cartão traz o seu tipo

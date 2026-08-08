## ADDED Requirements

### Requirement: Item "Publicações" na sidebar

A sidebar SHALL listar o item "Publicações" no grupo "Serventia", atrás da permissão
`content.edit`, apontando para a lista de publicações do painel.

#### Scenario: Item visível para quem edita conteúdo
- **WHEN** um usuário com `content.edit` abre o painel
- **THEN** a sidebar mostra o item "Publicações" no grupo "Serventia"

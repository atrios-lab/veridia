## MODIFIED Requirements

### Requirement: Grupo "Ajuda" com o item de vídeos de treinamento

A navegação da sidebar SHALL terminar com o grupo "Ajuda", contendo o item "Treinamento" que
leva a `/admin/ajuda`, oferecido a todo papel do painel sem permissão adicional. O item SHALL
ser omitido enquanto não houver vídeo publicado, pela regra de que link sem destino útil é
pior que link ausente, exceto para uma sessão com `tutorials.manage`, para quem o item é o
caminho até o gerenciamento; a rota SHALL existir de qualquer forma.

#### Scenario: Item visível para todo papel
- **WHEN** um usuário com papel `staff` abre o painel e há ao menos um vídeo publicado
- **THEN** a sidebar mostra "Treinamento" sob o grupo "Ajuda", por último

#### Scenario: Sem vídeo publicado esconde o item
- **WHEN** não há vídeo publicado e a sessão não tem `tutorials.manage`
- **THEN** a sidebar não mostra o grupo "Ajuda", e `/admin/ajuda` continua respondendo

#### Scenario: Plataforma sempre vê o item
- **WHEN** não há vídeo publicado e a sessão é de um `superadmin`
- **THEN** a sidebar mostra "Treinamento", por onde ele chega a "Gerenciar vídeos"

#### Scenario: Item da tela atual em destaque
- **WHEN** o usuário está em `/admin/ajuda`
- **THEN** o item "Treinamento" aparece marcado como página atual (`aria-current="page"`)

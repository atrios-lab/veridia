## ADDED Requirements

### Requirement: Grupo "Ajuda" com o item de vídeos-aula

A navegação da sidebar SHALL terminar com o grupo "Ajuda", contendo o item "Vídeos-aula" que
leva a `/admin/ajuda`, oferecido a todo papel do painel sem permissão adicional. O item SHALL
ser omitido enquanto o catálogo de vídeos estiver vazio, pela regra de que link sem destino
útil é pior que link ausente; a rota SHALL existir de qualquer forma.

#### Scenario: Item visível para todo papel
- **WHEN** um usuário com papel `staff` abre o painel e o catálogo tem ao menos um vídeo
- **THEN** a sidebar mostra "Vídeos-aula" sob o grupo "Ajuda", por último

#### Scenario: Catálogo vazio esconde o item
- **WHEN** o catálogo não tem nenhum vídeo
- **THEN** a sidebar não mostra o grupo "Ajuda", e `/admin/ajuda` continua respondendo

#### Scenario: Item da tela atual em destaque
- **WHEN** o usuário está em `/admin/ajuda`
- **THEN** o item "Vídeos-aula" aparece marcado como página atual (`aria-current="page"`)

### Requirement: Cabeçalho de página oferece o vídeo da tela

O cabeçalho de página de toda tela do painel SHALL mostrar o link "Como usar esta tela" quando
o catálogo de vídeos-aula tem um vídeo cuja rota cobre a rota atual, e nada quando não tem. O
link SHALL ser resolvido pelo cabeçalho a partir da rota da requisição, sem que cada tela
precise declará-lo.

#### Scenario: Tela coberta pelo catálogo
- **WHEN** a pessoa abre `/admin/agenda` e o catálogo tem um vídeo com rota `/admin/agenda`
- **THEN** o cabeçalho mostra "Como usar esta tela" ao lado do título, apontando para o vídeo

#### Scenario: Tela sem vídeo
- **WHEN** a pessoa abre uma tela cuja rota nenhum vídeo cobre
- **THEN** o cabeçalho é o mesmo de hoje, sem o link

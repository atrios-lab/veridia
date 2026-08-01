## ADDED Requirements

### Requirement: Migracoes versionadas com SQL revisado

Toda alteracao de schema DEVE (SHALL) existir como arquivo de migracao SQL versionado no
repositorio, gerado a partir do schema e **revisado por pessoa** antes do merge. O comando que
aplica diff direto no banco sem gerar historico NAO DEVE (SHALL NOT) ser usado em nenhum ambiente
compartilhado.

#### Scenario: Alteracao de schema acompanha migracao

- **WHEN** o schema muda em um pull request
- **THEN** o PR inclui o arquivo de migracao SQL correspondente

#### Scenario: Aplicacao direta sem historico e proibida

- **WHEN** alguem tenta sincronizar o banco compartilhado sem gerar migracao
- **THEN** o fluxo e recusado pela convencao documentada e pela revisao

### Requirement: Mudanca destrutiva em dois deploys

Remocao ou renomeacao de coluna ou tabela DEVE (SHALL) ser dividida em dois deploys: primeiro
adicionar e passar a escrever no novo formato mantendo o antigo, depois remover o antigo quando
nenhum codigo em producao o usa.

#### Scenario: Renomear coluna sem derrubar producao

- **WHEN** uma coluna precisa ser renomeada
- **THEN** o primeiro deploy adiciona a nova e mantem a antiga, e apenas um deploy posterior remove a antiga

### Requirement: Producao migra no deploy

A migracao de producao DEVE (SHALL) rodar automaticamente no deploy, antes da publicacao. Ambientes
de preview NAO DEVEM (SHALL NOT) migrar o banco de producao.

#### Scenario: Preview nao altera producao

- **WHEN** um deploy de preview e criado
- **THEN** nenhuma migracao e aplicada ao banco de producao

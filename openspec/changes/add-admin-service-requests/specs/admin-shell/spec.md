## MODIFIED Requirements

### Requirement: Navegação só oferece o que existe e o que a pessoa pode acessar

A navegação da sidebar SHALL listar apenas rotas do painel que existem no aplicativo, agrupadas
sob rótulos de seção. Um item cuja rota exija permissão que o papel da sessão não tem SHALL ser
omitido. A omissão do item NÃO SHALL ser tratada como controle de acesso: a rota correspondente
SHALL checar a permissão no servidor de qualquer forma.

#### Scenario: Item da tela atual em destaque

- **WHEN** o usuário está em `/admin/configuracoes`
- **THEN** o item "Configurações" aparece marcado como página atual (`aria-current="page"`) e os
  demais não

#### Scenario: Rota inexistente não vira item de menu

- **WHEN** a sidebar é renderizada e uma tela como "Usuários" ainda não existe no aplicativo
- **THEN** nenhum item de menu aponta para ela

#### Scenario: Esconder o item não substitui a checagem

- **WHEN** um usuário com papel `staff` navega diretamente para uma rota que exige `user.manage`,
  sem o item correspondente na sidebar
- **THEN** a própria rota recusa o acesso no servidor

#### Scenario: "Pedidos de serviço" passa a existir na navegação

- **WHEN** um usuário com a permissão `requests.manage` abre a sidebar
- **THEN** o item "Pedidos de serviço" aparece no grupo "Operação", com o contador de pedidos em
  aberto daquela serventia

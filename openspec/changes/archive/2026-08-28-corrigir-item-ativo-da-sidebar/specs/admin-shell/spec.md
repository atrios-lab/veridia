## MODIFIED Requirements

### Requirement: Navegação só oferece o que existe e o que a pessoa pode acessar

A navegação da sidebar SHALL listar apenas rotas do painel que existem no aplicativo, agrupadas
sob rótulos de seção. Um item cuja rota exija permissão que o papel da sessão não tem SHALL ser
omitido. A omissão do item NÃO SHALL ser tratada como controle de acesso: a rota correspondente
SHALL checar a permissão no servidor de qualquer forma.

O destaque de página atual SHALL refletir a rota em que a pessoa está a cada navegação, inclusive
nas navegações feitas no cliente entre telas que compartilham a mesma casca, sem depender de
recarregamento da página.

#### Scenario: Item da tela atual em destaque

- **WHEN** o usuário está em `/admin/configuracoes`
- **THEN** o item "Configurações" aparece marcado como página atual (`aria-current="page"`) e os
  demais não

#### Scenario: Destaque acompanha navegação no cliente

- **WHEN** o usuário está em `/admin/pedidos` e clica no item "Publicações" da sidebar, sem
  recarregar a página
- **THEN** "Publicações" passa a ser o único item marcado como página atual, e "Pedidos de
  serviço" deixa de estar marcado

#### Scenario: Rota inexistente não vira item de menu

- **WHEN** a sidebar é renderizada e a tela "Pedidos de serviço" ainda não existe no aplicativo
- **THEN** nenhum item de menu aponta para ela

#### Scenario: Esconder o item não substitui a checagem

- **WHEN** um usuário com papel `staff` navega diretamente para uma rota que exige `user.manage`,
  sem o item correspondente na sidebar
- **THEN** a própria rota recusa o acesso no servidor

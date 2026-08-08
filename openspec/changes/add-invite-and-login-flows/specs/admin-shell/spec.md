## ADDED Requirements

### Requirement: Casca bloqueada durante criação de senha

Em `/admin/redefinir-senha`, o sistema SHALL renderizar a mesma casca do painel (selo da
serventia, nome, "Painel administrativo") com a navegação vazia, substituída por um texto
explicando que a senha precisa ser criada para liberar o painel, em vez de itens de menu que
levariam a rotas ainda inacessíveis.

#### Scenario: Convidado abre o link de primeiro acesso
- **WHEN** uma pessoa com link de convite válido abre `/admin/redefinir-senha`
- **THEN** a casca do painel aparece com o selo e o nome da serventia, sem nenhum item de
  navegação, e com o texto explicando que a senha precisa ser criada para liberar o painel

#### Scenario: Sem navegação, sem acesso indireto
- **WHEN** a casca bloqueada é exibida em `/admin/redefinir-senha`
- **THEN** nenhum link da sidebar aponta para outra rota do painel

### Requirement: Item Usuários na navegação

A sidebar SHALL incluir o item "Usuários", apontando para `/admin/usuarios`, seguindo a mesma
regra de omissão por permissão (`user.manage`) já aplicada aos demais itens.

#### Scenario: Registrador vê Usuários na sidebar
- **WHEN** uma sessão com `user.manage` (papel Registrador) abre qualquer tela do painel
- **THEN** o item "Usuários" aparece na sidebar, no grupo Serventia

#### Scenario: Operador não vê Usuários na sidebar
- **WHEN** uma sessão sem `user.manage` (papel Operador) abre qualquer tela do painel
- **THEN** o item "Usuários" não aparece na sidebar dessa sessão

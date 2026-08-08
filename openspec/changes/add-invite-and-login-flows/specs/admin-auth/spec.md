## ADDED Requirements

### Requirement: Emissão de token de convite ao criar conta

Ao criar uma conta pela tela de Usuários, o sistema SHALL emitir um token de primeiro acesso
válido por 48 horas para essa conta, associado a ela, sem gravar nenhuma senha.

#### Scenario: Token emitido junto com a conta
- **WHEN** uma conta é criada com nome, e-mail e papel
- **THEN** o sistema grava um token de primeiro acesso válido por 48 horas para a conta recém-
  criada, e a conta não tem senha até que o token seja consumido

### Requirement: Reenvio ou nova senha invalida o token anterior

Ao emitir um novo token de convite ou de nova senha para uma conta, o sistema SHALL invalidar
qualquer token de redefinição de senha emitido anteriormente para aquela mesma conta, de modo
que nunca mais de um link continue válido ao mesmo tempo.

#### Scenario: Reenviar convite invalida o link anterior
- **WHEN** um novo convite é emitido para uma conta que já tinha um convite pendente
- **THEN** o link antigo deixa de funcionar e só o novo, válido por 48 horas, funciona

#### Scenario: Nova senha invalida um link de convite pendente
- **WHEN** "Nova senha" é acionada para uma conta que ainda tinha um link de convite pendente sem
  ter sido usado
- **THEN** o link de convite anterior deixa de funcionar e só o novo link de nova senha funciona

### Requirement: Nova senha não expõe nem altera a senha atual até a troca

Emitir um link de nova senha para uma conta ativa SHALL manter a senha atual funcionando para
login até que a pessoa complete a criação da nova senha pelo link, e NÃO SHALL, em nenhum
momento, expor a senha atual ou a nova a quem emitiu o link.

#### Scenario: Login com a senha antiga antes da troca
- **WHEN** um link de nova senha foi emitido para uma conta, mas a pessoa ainda não abriu o link
- **THEN** a conta continua entrando normalmente com a senha atual

#### Scenario: Criar a nova senha encerra sessões antigas
- **WHEN** a pessoa completa a criação da nova senha pelo link de "Nova senha"
- **THEN** a senha antiga deixa de funcionar, as sessões abertas antes da troca são encerradas, e
  a pessoa é levada à Visão geral já autenticada com a nova senha

### Requirement: Auditoria distingue primeiro acesso de nova senha

Ao consumir um link de `/admin/redefinir-senha`, o sistema SHALL gravar no log de auditoria uma
ação diferente conforme a conta já tinha senha antes: primeiro acesso para quem nunca teve, troca
de senha para quem já tinha.

#### Scenario: Consumir um convite de primeiro acesso
- **WHEN** uma conta sem senha anterior cria sua senha pelo link de convite
- **THEN** o log de auditoria registra uma ação de primeiro acesso, não de troca de senha

#### Scenario: Consumir um link de nova senha
- **WHEN** uma conta que já tinha senha cria a nova senha pelo link de "Nova senha"
- **THEN** o log de auditoria registra uma ação de troca de senha, não de primeiro acesso

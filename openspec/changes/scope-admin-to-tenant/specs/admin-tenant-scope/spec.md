## ADDED Requirements

### Requirement: Usuario do painel pertence a uma serventia

Todo usuario do painel DEVE (SHALL) pertencer a exatamente uma serventia, identificada pelo slug do
registro de serventias. O sistema NAO DEVE (SHALL NOT) permitir usuario sem serventia nem usuario
com acesso a mais de uma. O slug DEVE (SHALL) ser validado contra o registro no momento da criacao.

#### Scenario: Usuario nasce vinculado a uma serventia

- **WHEN** um usuario do painel e criado
- **THEN** ele carrega o slug da serventia a que pertence

#### Scenario: Usuario sem serventia e recusado

- **WHEN** a criacao de um usuario nao informa a serventia
- **THEN** a operacao falha e nenhum usuario e criado

#### Scenario: Serventia inexistente e recusada

- **WHEN** a criacao de um usuario informa um slug que nao esta no registro de serventias
- **THEN** a operacao falha com erro explicito, em vez de criar um usuario que nunca conseguira
  entrar

### Requirement: Acesso ao painel exige a serventia do usuario

O acesso a qualquer rota do painel DEVE (SHALL) exigir que a serventia resolvida pelo host da
requisicao seja a serventia do usuario da sessao. A verificacao DEVE (SHALL) acontecer no servidor,
a cada requisicao, e DEVE (SHALL) vir de funcao pura do nucleo de dominio, testavel sem banco e sem
servidor. Papel e serventia DEVEM (SHALL) ser condicoes independentes: ambas precisam valer.

#### Scenario: Usuario entra no painel da sua serventia

- **WHEN** um usuario com papel de acesso ao painel acessa o painel pelo dominio da sua serventia
- **THEN** o painel carrega

#### Scenario: Usuario nao entra no painel de outra serventia

- **WHEN** um usuario acessa o painel pelo dominio de uma serventia que nao e a sua
- **THEN** o acesso e recusado e ele nao ve nenhum dado daquela serventia

#### Scenario: Papel sem escopo nao basta

- **WHEN** um usuario com papel de administrador acessa o painel de outra serventia
- **THEN** o acesso e recusado, porque o papel nao amplia o escopo

#### Scenario: Escopo sem papel nao basta

- **WHEN** um usuario da serventia certa nao tem papel de acesso ao painel
- **THEN** o acesso e recusado

### Requirement: Login por dominio de outra serventia nao cria acesso

O sistema DEVE (SHALL) recusar a autenticacao quando o dominio da requisicao pertence a uma
serventia que nao e a do usuario. A resposta DEVE (SHALL) ser a mesma resposta generica de
credencial invalida, sem revelar que a conta existe em outra serventia. Nenhuma sessao utilizavel
DEVE (SHALL) permanecer apos a recusa.

#### Scenario: Credencial correta no dominio errado e recusada

- **WHEN** um usuario autentica com credenciais validas pelo dominio de outra serventia
- **THEN** a autenticacao e recusada e ele permanece na tela de login

#### Scenario: Recusa nao revela a existencia da conta

- **WHEN** a autenticacao e recusada por dominio de outra serventia
- **THEN** a resposta e igual a de e-mail ou senha invalidos

#### Scenario: Nenhuma sessao sobrevive a recusa

- **WHEN** a autenticacao e recusada por dominio de outra serventia
- **THEN** nenhuma sessao utilizavel resta, e a requisicao seguinte com o cookie devolvido e tratada
  como nao autenticada

### Requirement: Recusa de acesso registrada em auditoria

O sistema DEVE (SHALL) registrar na trilha de auditoria a tentativa de acesso ao painel de outra
serventia, com ator, acao, serventia alvo e data. O registro NAO DEVE (SHALL NOT) conter senha nem
token.

#### Scenario: Tentativa em serventia alheia gera registro

- **WHEN** uma autenticacao e recusada por dominio de outra serventia
- **THEN** existe um registro de auditoria com o ator, a serventia tentada e a data

### Requirement: Sem acesso a mais de uma serventia

O sistema NAO DEVE (SHALL NOT) oferecer conta com acesso a varias serventias, nem papel que ignore o
escopo, nem chave de suporte que abra qualquer painel. Quem precisa operar o painel de uma serventia
DEVE (SHALL) ter usuario naquela serventia.

#### Scenario: Nao existe conta que abre todos os paineis

- **WHEN** o modelo de usuarios e inspecionado
- **THEN** nenhum usuario e capaz de acessar o painel de mais de uma serventia

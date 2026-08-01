## ADDED Requirements

### Requirement: Sessao em banco, revogavel

O sistema DEVE (SHALL) autenticar por sessao persistida em banco, referenciada por cookie opaco
HttpOnly, Secure e `SameSite=Lax`. A sessao DEVE (SHALL) poder ser revogada e a revogacao DEVE
(SHALL) valer na requisicao seguinte. O sistema NAO DEVE (SHALL NOT) depender de token stateless que
permaneca valido apos a revogacao.

#### Scenario: Login cria sessao

- **WHEN** um usuario autentica com credenciais validas
- **THEN** uma sessao e criada em banco e o cookie opaco e devolvido

#### Scenario: Revogacao derruba o acesso imediatamente

- **WHEN** a sessao e removida do banco
- **THEN** a requisicao seguinte com aquele cookie e tratada como nao autenticada

#### Scenario: Credencial invalida nao revela qual campo falhou

- **WHEN** e-mail ou senha estao errados
- **THEN** a resposta e generica e nao distingue usuario inexistente de senha incorreta

### Requirement: Sem cadastro publico

O sistema NAO DEVE (SHALL NOT) expor endpoint de cadastro publico. Usuarios do painel DEVEM (SHALL)
nascer por seed ou convite interno.

#### Scenario: Seed cria o primeiro usuario

- **WHEN** o seed roda com as variaveis de ambiente de administrador
- **THEN** o usuario e criado e consegue autenticar

#### Scenario: Tentativa de autocadastro nao existe

- **WHEN** um visitante procura rota de cadastro
- **THEN** nenhuma rota de cadastro publico existe

### Requirement: Painel protegido por sessao

Toda rota sob o painel administrativo DEVE (SHALL) exigir sessao valida, exceto a tela de login. A
verificacao DEVE (SHALL) acontecer no servidor.

#### Scenario: Acesso sem sessao redireciona ao login

- **WHEN** um visitante sem sessao acessa uma rota do painel
- **THEN** e redirecionado para a tela de login

#### Scenario: Tela de login permanece acessivel

- **WHEN** um visitante sem sessao acessa a tela de login
- **THEN** a pagina carrega normalmente

### Requirement: Autorizacao de negocio fora da biblioteca

A biblioteca de autenticacao DEVE (SHALL) responder apenas quem e o usuario. A regra de o que cada
papel pode fazer DEVE (SHALL) viver no nucleo de dominio, para que trocar de biblioteca nao obrigue
a reescrever autorizacao.

#### Scenario: Regra de papel e testavel sem servidor

- **WHEN** a autorizacao de um papel e verificada
- **THEN** a decisao vem de funcao pura do nucleo, testavel sem banco e sem servidor

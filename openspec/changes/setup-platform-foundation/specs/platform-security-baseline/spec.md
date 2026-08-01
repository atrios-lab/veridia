## ADDED Requirements

### Requirement: Cabecalhos e cookies seguros

O sistema DEVE (SHALL) responder com cabecalhos de seguranca (incluindo CSP e HSTS) e emitir cookies
de sessao com HttpOnly, Secure e `SameSite=Lax`.

#### Scenario: Resposta traz cabecalhos de seguranca

- **WHEN** qualquer pagina e servida
- **THEN** os cabecalhos de seguranca estao presentes

### Requirement: Segredos apenas em variaveis de ambiente

O repositorio NAO DEVE (SHALL NOT) conter segredo algum. Toda credencial DEVE (SHALL) vir de
variavel de ambiente, e o arquivo de exemplo DEVE (SHALL) trazer apenas nomes e valores fictícios.

#### Scenario: Arquivo de exemplo sem valor real

- **WHEN** o arquivo de exemplo de ambiente e lido
- **THEN** ele lista as variaveis necessarias sem nenhum valor real

### Requirement: Rate limit em rotas sensiveis

O sistema DEVE (SHALL) aplicar limite de requisicoes nas rotas de autenticacao e nas rotas publicas
de escrita.

#### Scenario: Tentativas repetidas de login sao limitadas

- **WHEN** varias tentativas de login partem da mesma origem em curto intervalo
- **THEN** as excedentes sao recusadas pelo limite

### Requirement: Trilha de auditoria

O sistema DEVE (SHALL) registrar ator, acao, alvo e data para toda operacao que altera estado
sensivel. O registro NAO DEVE (SHALL NOT) conter dado pessoal desnecessario nem segredo.

#### Scenario: Acao sensivel gera registro

- **WHEN** uma operacao que altera estado sensivel e concluida
- **THEN** existe um registro de auditoria com ator, acao, alvo e data

#### Scenario: Auditoria nao vaza segredo

- **WHEN** um registro de auditoria e gravado
- **THEN** ele nao contem senha, token nem conteudo de documento

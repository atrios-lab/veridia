## ADDED Requirements

### Requirement: Conexão de runtime via pooler compatível com execução serverless
A aplicação SHALL conectar ao PostgreSQL em runtime através de um pooler de conexões (não uma
conexão direta), para não esgotar o limite de conexões do banco sob invocações concorrentes das
Route Handlers e Server Actions no Vercel. A conexão SHALL ser criada sem depender de prepared
statements de sessão, já que o pooler opera em modo transaction.

#### Scenario: Múltiplas requisições concorrentes não esgotam o limite de conexões
- **WHEN** várias Route Handlers/Server Actions que tocam o banco são invocadas ao mesmo tempo
- **THEN** cada invocação usa uma conexão do pooler (não uma conexão direta dedicada), e o banco
  não recusa novas conexões por excesso de conexões abertas

#### Scenario: Query em runtime não depende de prepared statement de sessão
- **WHEN** a aplicação executa uma query através da conexão de runtime
- **THEN** a query é executada sem exigir um prepared statement de sessão, permanecendo
  compatível com o pooler em modo transaction

### Requirement: Build sem `DATABASE_URL` não conecta ao banco
`next build` e outros processos que não fazem requisição real (como CI sem segredos) SHALL
completar com sucesso mesmo sem `DATABASE_URL` definida ou com valor vazio, sem tentar abrir
conexão com um banco real. Qualquer query real contra esse estado SHALL falhar apenas na
primeira tentativa de uso, nunca na inicialização do módulo.

#### Scenario: `next build` sem `DATABASE_URL` e sem banco disponível
- **WHEN** `next build` roda em um ambiente sem `DATABASE_URL` definida e sem acesso a um banco
  real (ex.: CI)
- **THEN** o build completa com sucesso, sem tentar estabelecer conexão de rede com um banco

#### Scenario: Query real contra a URL placeholder falha no uso, não na inicialização
- **WHEN** o módulo de banco é importado sem `DATABASE_URL` definida
- **THEN** a importação em si não levanta erro; só uma query real subsequente falha

### Requirement: Migrations de schema usam conexão direta, não o pooler
`drizzle-kit generate` e `drizzle-kit migrate` SHALL usar uma connection string de conexão direta
ao PostgreSQL (não o pooler de runtime), já que DDL nem sempre é suportado de forma confiável
atrás de um pooler em modo transaction.

#### Scenario: `db:migrate` aplica DDL usando a conexão direta
- **WHEN** `pnpm db:migrate` roda contra o banco configurado
- **THEN** a conexão usada é a direta (não a de pooler), permitindo que operações DDL das
  migrations apliquem sem restrição do pooler

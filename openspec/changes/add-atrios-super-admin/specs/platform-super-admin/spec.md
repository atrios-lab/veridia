# platform-super-admin

## ADDED Requirements

### Requirement: Acesso do superadmin a qualquer serventia

O sistema SHALL permitir que um usuário com papel `superadmin` autentique e opere o painel `/admin` de qualquer serventia registrada, acessando pelo domínio dela. O painel apresentado SHALL ser o painel normal da serventia do host — tema, dados e escopo daquela serventia — sem visão agregada entre serventias.

#### Scenario: Login em serventias diferentes com a mesma conta

- **WHEN** um superadmin entra com suas credenciais em `/admin/login` no domínio da serventia A e depois no domínio da serventia B
- **THEN** o sistema autentica nos dois casos e cada sessão opera exclusivamente sobre os dados da serventia daquele host

#### Scenario: Papéis de serventia continuam restritos

- **WHEN** um usuário `admin` ou `staff` da serventia A tenta entrar pelo domínio da serventia B
- **THEN** o sistema recusa como hoje, com a mensagem genérica de credencial inválida

### Requirement: Superadmin tem todas as permissões do painel

Um usuário `superadmin` SHALL ter todas as permissões existentes do painel na serventia que estiver acessando, verificadas no servidor como para qualquer papel.

#### Scenario: Ação restrita a admin executada por superadmin

- **WHEN** um superadmin acessa uma área do painel que exige uma permissão de `admin` (ex.: gestão de usuários)
- **THEN** o sistema autoriza a ação pela checagem de permissão no servidor

### Requirement: Criação de superadmin restrita a CLI

O sistema SHALL permitir criar contas `superadmin` somente por script de linha de comando. As telas do painel SHALL NOT oferecer o papel `superadmin` na criação ou edição de usuários, e a validação no servidor SHALL rejeitar `superadmin` vindo do painel.

#### Scenario: Formulário de usuários não oferece o papel

- **WHEN** um admin de serventia abre a criação de usuário em `/admin/usuarios`
- **THEN** os papéis disponíveis são apenas os de serventia (`admin`, `staff`)

#### Scenario: Requisição forjada com papel superadmin

- **WHEN** uma requisição de criação de usuário via painel chega ao servidor com `role: "superadmin"`
- **THEN** o sistema rejeita a requisição na validação, sem criar a conta

### Requirement: Superadmin invisível às listas de usuários das serventias

Contas `superadmin` SHALL NOT aparecer na lista de usuários (`/admin/usuarios`) de nenhuma serventia.

#### Scenario: Lista de usuários de uma serventia

- **WHEN** a lista de usuários de qualquer serventia é carregada
- **THEN** nenhuma conta `superadmin` consta na lista

### Requirement: Ações de superadmin auditadas na serventia acessada

Toda entrada, saída e ação de um `superadmin` no painel de uma serventia SHALL constar na trilha de auditoria daquela serventia, identificando a conta que agiu.

#### Scenario: Ação em um cartório aparece na auditoria dele

- **WHEN** um superadmin executa uma ação auditável no painel da serventia A
- **THEN** o registro aparece na trilha de auditoria da serventia A com a identidade do superadmin

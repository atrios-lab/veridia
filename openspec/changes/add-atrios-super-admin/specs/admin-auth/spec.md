# admin-auth — delta

## MODIFIED Requirements

### Requirement: Erro genérico de credencial inválida
O sistema SHALL responder com uma única mensagem genérica de erro para senha incorreta, e-mail
sem conta e conta de uma serventia diferente da do domínio acessado, sem indicar qual desses
motivos ocorreu. Exceção: credenciais válidas de um usuário `superadmin` da plataforma SHALL
autenticar em qualquer domínio de serventia registrada.

#### Scenario: Senha incorreta
- **WHEN** o formulário é enviado com um e-mail existente e senha errada
- **THEN** o sistema mostra "E-mail ou senha inválidos." e não indica que o e-mail existe

#### Scenario: Conta de outra serventia
- **WHEN** o formulário é enviado com credenciais válidas de um usuário `admin` ou `staff` de
  outra serventia
- **THEN** o sistema encerra qualquer sessão criada, mostra a mesma mensagem "E-mail ou senha
  inválidos." e não menciona a serventia a que a conta pertence

#### Scenario: Superadmin entra em qualquer serventia
- **WHEN** o formulário é enviado com credenciais válidas de um usuário `superadmin`, em
  qualquer domínio de serventia registrada
- **THEN** o sistema autentica e leva ao painel da serventia daquele domínio

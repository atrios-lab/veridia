## ADDED Requirements

### Requirement: Liberação de acesso pela Átrios

A conta mestre da Átrios SHALL poder desligar e religar a verificação em duas etapas de qualquer serventia,
em uma tela que nenhum outro perfil vê. Com a verificação desligada, a serventia SHALL entrar no painel só
com a senha.

#### Scenario: Desligar para uma serventia

- **WHEN** a Átrios desliga a verificação em duas etapas de uma serventia
- **THEN** quem é dessa serventia entra só com a senha, e as outras serventias continuam pedindo o código

#### Scenario: Perfil de cartório

- **WHEN** um administrador de cartório tenta abrir a tela de liberação de acesso
- **THEN** o painel responde que a página não existe

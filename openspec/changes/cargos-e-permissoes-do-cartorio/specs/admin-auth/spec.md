## ADDED Requirements

### Requirement: Cargos e permissões definidos pelo Tabelião/Registrador

O painel SHALL oferecer os cargos Tabelião/Registrador, Substituto Legal, Substituto, Escrevente, Auxiliar de
Cartório, Contador e RH. O Tabelião/Registrador SHALL definir o que cada cargo faz e vê, e SHALL ser o único a
cadastrar pessoas, definir permissões e ver a auditoria.

#### Scenario: Liberar uma área para um cargo

- **WHEN** o Tabelião/Registrador marca "Pedidos de serviço e guias de recolhimento" para o Contador
- **THEN** quem é Contador passa a ver e usar os pedidos e as guias

#### Scenario: Permissão reservada

- **WHEN** alguém tenta dar a outro cargo o cadastro de pessoas ou a auditoria
- **THEN** essas permissões não são gravadas, e continuam só com o Tabelião/Registrador

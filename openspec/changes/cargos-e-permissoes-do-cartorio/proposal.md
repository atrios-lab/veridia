## Why

O painel só tinha dois papéis, Registrador e Operador. Uma serventia tem mais cargos, cada um com um papel
diferente no dia a dia. Quem decide o que cada cargo faz e vê é o titular.

## What Changes

- **Cargos do painel:**
  - **Tabelião/Registrador** (`admin`): acesso total. É o único que cadastra as pessoas, define as
    permissões e vê a auditoria.
  - **Substituto Legal**, **Substituto**, **Escrevente** (`staff`, que antes se chamava "Operador"),
    **Auxiliar de Cartório**, **Contador** e **RH**.
  - Os ids `admin` e `staff` continuam os mesmos, então nenhuma conta existente precisa ser alterada no
    banco.
- **Padrões:** cada cargo começa com um padrão (`core/auth/roles.ts`).
  - O Substituto Legal tem tudo, menos cadastrar pessoas e a auditoria.
  - O Escrevente mantém o que o Operador tinha.
- **Configurações › Perfis e permissões** (só o Tabelião/Registrador): uma tabela de cargos e permissões
  para marcar o que cada cargo faz e vê. Fica em `tenant_content` (`office-role-permissions`), com
  auditoria.
- **Reservado ao titular:** cadastrar pessoas e definir permissões (`user.manage`) e a auditoria
  (`audit.manage`) nunca podem ser entregues a outro cargo.
- **Na sessão:** `getSession` leva as permissões efetivas da pessoa, e toda checagem do painel (`can`)
  usa essas permissões. Telas, ações e rotas passam a respeitar a escolha do titular.
- **A conta mestre da Átrios** continua com tudo, em todas as serventias.
- **Banco:** nenhuma migração.

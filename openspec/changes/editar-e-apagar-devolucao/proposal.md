## Why

Depois de devolver o requerimento assinado ao solicitante, o cartório não conseguia mais mexer no motivo. Se escrevesse algo errado ou incompleto, ou se tivesse devolvido por engano, não havia como corrigir. O dono do projeto pediu que tudo o que se grava tenha as opções de editar, alterar e apagar.

## What Changes

- A devolução do requerimento ganha o botão **Editar motivo**. O solicitante passa a ler o texto novo e, se o funcionário marcar, recebe um e-mail.
- Ganha também o botão **Apagar devolução**, que pede confirmação. O arquivo volta para "a conferir", como antes de devolver, e o motivo sai da tela do solicitante.
- Nada sai do banco: cada texto alterado ou apagado fica no "Histórico da devolução" do pedido, e a auditoria registra as duas ações com rótulo em português.
- Uma nova devolução, ou um novo arquivo enviado pelo solicitante, não apaga esse histórico.
- O `CLAUDE.md` passa a ter a regra: toda funcionalidade nova que grava algo já nasce com editar, alterar e apagar. Apagar sempre desfaz, oculta ou cancela, sem remover a linha do banco.

## Non-goals

- Mudar o banco: o histórico vai no JSON `details` do pedido.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `service-request`: a devolução do requerimento assinado pode ser editada e apagada, com histórico.

## Impact

- `src/core/request/signed-form-check.ts`, `src/lib/signed-form-reading.ts`, ações e tela do pedido no painel (`pedidos/[protocolo]`), rótulos de auditoria, `CLAUDE.md`.

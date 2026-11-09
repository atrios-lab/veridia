## Why

Quem marcava "Atendido" no lugar de "Não compareceu" (ou o contrário) não tinha como voltar
atrás, e um agendamento lançado errado não saía da agenda, mesmo depois de marcado.

## What Changes

- **Desfazer**: agendamento marcado como atendido ou não compareceu volta para agendado, para ser
  marcado de novo.
- **Excluir**: tira o agendamento da agenda em qualquer situação (inclusive atendido) e libera o
  horário. Nada é apagado: o registro fica cancelado e marcado como excluído (`removed_at`),
  fora de todas as listas, com a trilha de auditoria. O cidadão não recebe e-mail (para avisar,
  continua o Cancelar).
- **Banco (só acrescenta)**: coluna `appointments.removed_at` (migração 0036).

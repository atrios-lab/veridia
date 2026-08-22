## Why

Dois eventos ainda acontecem em silêncio depois do change `avisar-cidadao-por-email`. Quando o cidadão cancela o próprio agendamento pelo link, ele vê uma tela e não leva comprovante nenhum — e o e-mail de confirmação que ele guarda continua dizendo que o atendimento está de pé. E quando a serventia anexa o formulário que o cidadão precisa imprimir e apresentar para cumprir uma exigência, ninguém avisa — o gesto irmão (`deliverDocumentAction`, o documento final) já avisa.

## What Changes

- Confirmação por e-mail ao cidadão quando ele cancela o agendamento pelo link, com o botão levando de volta à agenda (mesma saída dos cancelamentos feitos pela serventia).
- Aviso via `notifyCitizen` quando o operador anexa um formulário a uma exigência: há algo para imprimir, consulte com a sua chave.
- Ambos melhor esforço, como todos os demais: falha de e-mail nunca falha a ação.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `appointment-scheduling`: "Cancelamento pelo link do e-mail" passa a exigir a confirmação por e-mail do cancelamento.
- `admin-service-requests`: "Avisos por e-mail nas ações que afetam o cidadão" ganha o evento "formulário anexado à exigência".

## Impact

- `src/core/scheduling/emails.ts` — novo builder `buildAppointmentSelfCancelledEmail` (texto de quem cancelou por vontade própria, não o de quem foi cancelado pela serventia).
- `src/lib/email/appointment.ts` — nova função de envio reusando `renderEmailCard*` e o padrão de melhor esforço do arquivo.
- `src/app/(public)/agendar/cancelar/actions.ts` — chamada após `cancelAppointment`.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts` — `attachRequirementFormAction` ganha a chamada a `notifyCitizen` que `deliverDocumentAction` já tem.
- Nenhuma mudança em transporte ou templates.

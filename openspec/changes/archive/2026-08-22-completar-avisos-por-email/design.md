## Context

Toda a infra existe: builders de agenda em `src/core/scheduling/emails.ts`, envio de melhor esforço em `src/lib/email/appointment.ts` (`sendAppointmentCancelledEmail` cobre os dois cancelamentos feitos pela serventia), e `notifyCitizen` para avisos de protocolo. Faltam duas pontas: o cancelamento que o próprio cidadão faz (`cancelByToken`) e o formulário de exigência (`attachRequirementFormAction`).

## Goals / Non-Goals

**Goals:**
- Comprovante por e-mail do auto-cancelamento, com botão para reagendar.
- Aviso de formulário anexado à exigência, sem o arquivo.

**Non-Goals:**
- Avisar a serventia do auto-cancelamento (o painel é o canal dela; e-mail para a serventia seria um padrão novo que nenhum fluxo tem hoje).
- Lembrete de véspera (precisa de cron, que o repo deliberadamente não tem).
- Deduplicar aviso de exigência + aviso de formulário quando o operador faz os dois em seguida: são gestos separados na UI, o conteúdo é distinto, e o custo de um e-mail a mais é menor que o de uma janela de dedupe.

## Decisions

- **Builder próprio para o auto-cancelamento**, não reuso de `buildAppointmentCancelledEmail`: aquele texto abre com "a serventia precisou cancelar" e traz motivo — ambos errados aqui. Novo `buildAppointmentSelfCancelledEmail` sem campo `reason`, primeira linha confirmando que foi o próprio cidadão, botão "Agendar novo horário" apontando para `/agendar`.
- **Envio dentro de `cancelByToken`, depois de `cancelAppointment`**, mesmo padrão try/log de `appointment.ts`: o cancelamento consumado nunca volta atrás por causa de e-mail. O endereço vem do próprio `appointment` retornado por `findByCancelToken` — nenhuma query nova.
- **Formulário de exigência**: cópia do bloco de `deliverDocumentAction` — `findById` para contato e protocolo, `notifyCitizen` com corpo "há um formulário para imprimir na sua exigência". O `findById` entra no lugar do `listRequirements` já feito? Não: `listRequirements` não traz o contato do pedido; o `findById` é a query que os irmãos do arquivo já fazem.

## Risks / Trade-offs

- [Cidadão cancela e reagenda em seguida → dois e-mails] → é o comportamento de qualquer sistema de agendamento; cada e-mail é um comprovante de um fato distinto.
- [Operador registra exigência e anexa formulário no mesmo minuto → dois avisos] → aceito (ver Non-Goals); se incomodar na prática, a dedupe é uma decisão futura com dados reais.

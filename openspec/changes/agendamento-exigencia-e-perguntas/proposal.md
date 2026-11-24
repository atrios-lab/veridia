## Why

Antes do atendimento, o cartório às vezes precisa de um documento ou de uma resposta do cliente.
Hoje o cliente só consegue anexar documentos por conta própria na consulta do protocolo; o
cartório não tem como pedir nada, nem perguntar, sem ligar. A cliente pediu (24/11/2026) uma
exigência que o cartório abre quando achar necessário, e um campo de perguntas e respostas que
só o funcionário abre e que ele fecha depois, para o cliente não ficar perguntando.

No site, o cartão "Fechado agora · abre quinta às 8h" pula o feriado sem dizer qual é, e o cliente
pode achar que o cartório esqueceu a quarta.

## What Changes

- **Exigência no agendamento.** No detalhe do agendamento, o funcionário abre uma exigência
  ("Pedir documento ou providência"). O cliente recebe e-mail e vê "O cartório pediu" na consulta
  do protocolo, logo acima de "Documentos enviados por você". O funcionário marca como cumprida ou
  reabre, edita (guardando o texto anterior) e apaga (só oculta, com justificativa).
- **Perguntas e respostas abertas pelo funcionário.** O funcionário escreve ao cliente (as
  perguntas se abrem), o cliente responde pela consulta enquanto estiverem abertas, e o
  funcionário as fecha ("Fechar perguntas"). Fechadas, o cliente só lê. O painel avisa quando o
  cliente escreveu e espera resposta.
- **Feriado no cartão de horário.** Quando há feriado entre agora e a reabertura, o cartão diz
  qual: "Fechado agora · amanhã é feriado de São João · abre quinta às 8h".

## Impact

- Banco: tabela nova `appointment_messages` (migração `0083`, só cria). Nada é apagado.
- `src/core/scheduling/conversation.ts`, `src/lib/appointment-messages.ts`, e-mail novo ao
  cliente, painel (detalhe do agendamento), consulta do protocolo, auditoria.
- `src/core/chat/hours.ts` (cartão de horário).

## Why

Na agenda, o funcionário via só uma linha por agendamento. Não tinha onde ler com calma o que o cliente
escreveu, anotar o que combinou por telefone, guardar um arquivo ou corrigir um nome ou CPF digitado errado.

## What Changes

- Botão **Detalhes** em cada agendamento da agenda do dia, que abre a página do agendamento:
  - **o que o cliente informou**: a observação e os documentos que enviou pela consulta;
  - **anotações internas**, com autor e hora, que o cliente não vê;
  - **anexos da serventia**, que o cliente não vê (a consulta mostra só os arquivos que o próprio cliente
    enviou);
  - **dados do cliente**: nome, CPF, telefone, e-mail, serviço, modo e observação, corrigíveis, com
    auditoria. Dia e horário não mudam aqui: para isso, cancela e reserva de novo.
- **Banco: só acrescenta.** Migração `0039_detalhes_do_agendamento`: tabela `appointment_notes` e coluna
  `appointment_attachments.uploaded_by`.

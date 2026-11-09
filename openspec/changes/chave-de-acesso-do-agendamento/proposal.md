## Why

A consulta de um protocolo de agendamento (AGD) pedia a chave de acesso ("Destrave o detalhe"),
mas o agendamento não emitia chave: o cidadão ficava sem como ver o detalhe nem enviar um
documento antes de vir.

## What Changes

- **Chave no agendamento**: ao agendar pelo site, o cidadão recebe protocolo e chave de acesso,
  mostrados na confirmação (com copiar e "Abrir o agendamento") e enviados no e-mail de
  confirmação. Só o hash da chave é guardado.
- **Consulta com a chave**: em `/protocolo` e `/acompanhar`, o AGD com a chave mostra data,
  horário, agenda, serviço, atendimento, aviso de chegada, o que levar e os documentos enviados.
- **Documentos antes de vir**: enquanto o agendamento estiver marcado e não tiver passado, o
  cidadão anexa documentos (um por vez). O painel mostra "Enviou antes: Documento 1…" no
  agendamento, com o arquivo para abrir.
- **Perdi a chave**: funciona também para AGD, com o e-mail do agendamento. Agendamentos antigos
  e os reservados no balcão, que não têm chave, conseguem uma por esse caminho.
- **Texto da consulta**: para AGD, diz que a chave veio na confirmação e no e-mail.
- **Banco (só acrescenta)**: coluna `appointments.access_key_hash` e tabela
  `appointment_attachments` (migração 0035). Nada é apagado.

## Não-objetivos

- Apagar automaticamente os arquivos do agendamento depois de um prazo.
- Imprimir a chave no comprovante, que é mostrado na recepção.

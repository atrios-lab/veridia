## ADDED Requirements

### Requirement: Exigência e perguntas no agendamento
O funcionário DEVE (SHALL) poder abrir uma exigência num agendamento ainda por vir, e o cliente
DEVE (SHALL) vê-la na consulta do protocolo, com o envio de documentos logo abaixo, e receber
e-mail. O funcionário DEVE (SHALL) poder marcar a exigência como cumprida, reabri-la, editá-la
guardando o texto anterior e apagá-la só ocultando, com justificativa e registro na auditoria.

O funcionário DEVE (SHALL) poder abrir e fechar perguntas e respostas. O cliente DEVE (SHALL)
poder responder pela consulta só enquanto estiverem abertas e o agendamento estiver por vir;
fechadas, a conversa DEVE (SHALL) continuar visível para leitura.

#### Scenario: Cartório pede um documento
- **WHEN** o funcionário abre a exigência "Envie a certidão de casamento atualizada"
- **THEN** o cliente recebe e-mail, vê "O cartório pediu" na consulta e envia o PDF em
  "Documentos enviados por você"

#### Scenario: Pergunta respondida e fechada
- **WHEN** o funcionário escreve uma pergunta, o cliente responde e o funcionário clica em
  "Fechar perguntas"
- **THEN** a conversa fica visível dos dois lados e o cliente não consegue mais escrever

#### Scenario: Apagar sem perder o registro
- **WHEN** o funcionário apaga uma mensagem e informa a justificativa
- **THEN** a mensagem some da consulta do cliente, e o registro e a justificativa ficam na
  auditoria

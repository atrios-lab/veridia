## ADDED Requirements

### Requirement: Aviso por e-mail à serventia quando o cidadão responde
Quando o cidadão escreve na conversa de uma exigência pendente, a serventia SHALL receber um
aviso por e-mail no seu contato institucional (`tenant.contacts.email`), com o número do
protocolo e o nome do requerente quando houver, e um botão que leva direto ao pedido no painel.
O aviso NÃO SHALL carregar o texto da mensagem do cidadão nem os anexos enviados com ela. O envio
SHALL ser fire-and-forget: falha de e-mail nunca falha o registro da mensagem do cidadão.

#### Scenario: Mensagem do cidadão avisa a serventia
- **WHEN** o cidadão, autenticado por protocolo + chave, escreve numa exigência pendente
- **THEN** a serventia recebe um e-mail com o protocolo e um botão para o pedido no painel, sem o
  texto da mensagem

#### Scenario: Anexo sem texto também avisa
- **WHEN** o cidadão envia só um anexo, sem mensagem escrita, numa exigência pendente
- **THEN** a serventia recebe o mesmo aviso, sem o arquivo

#### Scenario: Falha no envio não impede o registro da mensagem
- **WHEN** o provedor de e-mail falha ao enviar o aviso à serventia
- **THEN** a mensagem do cidadão continua gravada e visível na conversa dos dois lados

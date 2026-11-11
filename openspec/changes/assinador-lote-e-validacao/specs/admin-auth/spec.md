## ADDED Requirements

### Requirement: Assinatura visível, lote e lista de documentos assinados

O assinador SHALL mostrar a faixa e o QR de verificação também quando o PDF já vem assinado. Nesse caso, eles
SHALL ir como aparência da nova assinatura, sem invalidar as anteriores. O assinador SHALL assinar vários PDFs
com a senha digitada uma vez. O documento assinado SHALL abrir para impressão. Excluir um documento da lista
SHALL NOT apagar o registro da assinatura, que continua respondendo à verificação.

#### Scenario: CNH já assinada

- **WHEN** a serventia assina um PDF que já tem a assinatura do órgão emissor
- **THEN** a primeira página mostra a faixa com o nome de quem assinou e o QR
- **AND** a assinatura do órgão emissor continua válida

#### Scenario: Excluir da lista

- **WHEN** quem assinou exclui o documento da lista
- **THEN** o arquivo deixa de abrir no painel e na página pública
- **AND** o código continua mostrando as assinaturas, e o documento pode voltar à lista

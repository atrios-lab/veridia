## ADDED Requirements

### Requirement: Arquivos do protocolo ficam 30 dias depois do encerramento
Todo arquivo de um protocolo (pedido de serviço, solicitação LGPD ou manifestação de ouvidoria) SHALL ficar disponível enquanto o protocolo estiver em andamento, e SHALL ser apagado do armazenamento 30 dias depois do encerramento, contados no calendário da serventia. Um arquivo enviado depois do encerramento SHALL contar os 30 dias do próprio envio. A regra SHALL valer para todos os tipos de anexo: o que o cidadão enviou, o requerimento e a declaração assinados, o comprovante de pagamento, o documento entregue, o documento do indeferimento, o formulário da exigência e os arquivos das mensagens da exigência. Reaberto o protocolo, a contagem SHALL parar; encerrado de novo, SHALL recomeçar. Apagado o arquivo, o registro (nome, tipo, tamanho, data de envio e data do apagamento) SHALL continuar.

A regra é da plataforma; a justificativa é a LGPD (art. 6º, III, e arts. 15 e 16), que não fixa o número de dias.

#### Scenario: Pedido em andamento há meses
- **WHEN** um pedido aberto tem um anexo do cidadão enviado há 90 dias
- **THEN** o arquivo continua disponível

#### Scenario: Pedido concluído há 31 dias
- **WHEN** o cidadão tenta baixar o documento entregue de um pedido concluído há 31 dias
- **THEN** a rota responde 410 e a consulta mostra o documento como apagado, sem botão Baixar

#### Scenario: Pedido reaberto
- **WHEN** um pedido concluído há 20 dias volta para "Em processamento"
- **THEN** os arquivos ficam enquanto ele estiver aberto, e os 30 dias recomeçam no novo encerramento

### Requirement: Consulta mostra até quando o arquivo fica
Depois do encerramento, a consulta pública do protocolo SHALL mostrar a data até a qual os arquivos ficam disponíveis, no lugar de "por 30 dias". Um arquivo apagado SHALL aparecer como apagado, com a data, sem botão de download.

#### Scenario: Documento entregue com o pedido concluído
- **WHEN** o cidadão consulta um pedido concluído em 01/12
- **THEN** a consulta diz que o documento fica disponível até 31/12

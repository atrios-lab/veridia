## ADDED Requirements

### Requirement: Painel expurga e avisa o prazo dos arquivos
O painel SHALL apagar os arquivos vencidos pela regra dos 30 dias ao abrir a fila de pedidos, a da LGPD e a da ouvidoria, sem tarefa agendada. Cada arquivo apagado SHALL deixar `request.attachment-purge` na auditoria, sem autor, no histórico do protocolo. A rota de documento do painel e a da consulta pública SHALL responder 410 a um arquivo vencido ou apagado, mesmo antes de o expurgo passar por ele.

O detalhe de um protocolo encerrado SHALL dizer até quando os arquivos ficam, em destaque nos últimos 7 dias, e, depois do apagamento, quando foram apagados. Um anexo apagado SHALL aparecer sem "Ver" nem "Excluir".

#### Scenario: Fila abre com pedido encerrado há 40 dias
- **WHEN** o operador abre a fila de pedidos e há um pedido concluído há 40 dias com anexos
- **THEN** os arquivos são apagados do armazenamento, o pedido continua com o texto e o histórico, e a auditoria registra cada apagamento sem autor

#### Scenario: Últimos dias para baixar
- **WHEN** o operador abre um pedido concluído há 25 dias
- **THEN** o detalhe avisa que os arquivos ficam só até a data do fim dos 30 dias, para baixar o que a serventia precisar guardar

#### Scenario: Link antigo para arquivo apagado
- **WHEN** o operador abre o link "Ver" de um anexo já vencido
- **THEN** a rota responde 410 dizendo que o arquivo foi apagado pela regra dos 30 dias

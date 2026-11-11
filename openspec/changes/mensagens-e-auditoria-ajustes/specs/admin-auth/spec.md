## ADDED Requirements

### Requirement: Horário de almoço aprovado pelo titular e auditoria sem apagar

O horário de almoço SHALL ter no máximo 1 hora por dia. Ele SHALL valer só depois da aprovação do
Tabelião/Registrador e SHALL NOT ser pedido de novo enquanto houver pedido pendente. Arquivar registros da
auditoria e excluir anotações SHALL NOT apagar dados.

#### Scenario: Pedido de almoço

- **WHEN** um escrevente pede almoço das 12h às 13h
- **THEN** o pedido vai para a auditoria e espera o titular
- **AND** só depois da aprovação o escrevente aparece em almoço nesse horário, e volta a disponível depois

#### Scenario: Arquivar da lista

- **WHEN** o titular arquiva registros marcados
- **THEN** eles saem da lista e continuam em "Arquivados", de onde voltam

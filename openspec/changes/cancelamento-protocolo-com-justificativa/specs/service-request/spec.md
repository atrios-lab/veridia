## ADDED Requirements

### Requirement: Justificativa de cancelamento ou indeferimento na consulta de protocolo

A consulta pública de protocolo SHALL exibir a justificativa junto ao selo do andamento quando o
pedido estiver "Cancelado" ou "Indeferido". Quando a mudança para esses andamentos aconteceu antes
desta justificativa existir e não há motivo gravado, a consulta SHALL informar que o motivo não
foi informado, em vez de omitir o bloco ou sugerir uma falha.

#### Scenario: Motivo visível na consulta
- **WHEN** o cidadão consulta um protocolo indeferido com o motivo "Certidão anexada ilegível"
- **THEN** a consulta mostra o selo "Indeferido" e, junto dele, o texto do motivo

#### Scenario: Pedido cancelado antes desta mudança
- **WHEN** o cidadão consulta um protocolo cancelado antes de a justificativa existir, sem motivo
  gravado
- **THEN** a consulta mostra o selo "Cancelado" e a informação de que o motivo não foi informado

#### Scenario: Outros andamentos não mostram motivo
- **WHEN** o cidadão consulta um protocolo em qualquer andamento que não seja Cancelado nem
  Indeferido
- **THEN** nenhum bloco de motivo aparece

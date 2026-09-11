## ADDED Requirements

### Requirement: PDF como alternativa ao motivo em texto ao indeferir

Ao mudar o andamento de um pedido para "Indeferido", a confirmação SHALL aceitar um PDF anexado
como alternativa (ou complemento) ao texto do motivo. Pelo menos um dos dois — texto não vazio ou
PDF anexado — SHALL ser obrigatório; os dois juntos SHALL ser aceitos. O servidor SHALL recusar a
confirmação quando nenhum dos dois for informado. Essa alternativa vale só para "Indeferido": a
mudança para "Cancelado" continua exigindo texto, sem opção de PDF. O PDF SHALL passar pela mesma
validação de tipo (`application/pdf`) e tamanho já usada nos demais anexos do pedido, e SHALL ficar
gravado como anexo do pedido, associado à mudança de andamento. O histórico do pedido SHALL exibir
o link do PDF anexado na entrada daquela mudança de andamento, junto do texto do motivo quando
também informado.

#### Scenario: Indeferimento só com PDF, sem texto
- **WHEN** o operador anexa um PDF e confirma o indeferimento sem escrever nada no campo de motivo
- **THEN** o servidor aceita a mudança, grava o PDF como anexo do pedido e o histórico mostra o
  link do documento, sem texto de motivo

#### Scenario: Indeferimento só com texto, sem PDF
- **WHEN** o operador escreve o motivo e confirma o indeferimento sem anexar nenhum arquivo
- **THEN** o servidor aceita a mudança normalmente, como já acontecia antes desta mudança

#### Scenario: Indeferimento com texto e PDF juntos
- **WHEN** o operador escreve o motivo e também anexa um PDF antes de confirmar
- **THEN** o servidor aceita a mudança e grava os dois; o histórico mostra o texto e o link do PDF
  na mesma entrada

#### Scenario: Indeferimento sem texto e sem PDF é recusado
- **WHEN** o operador tenta confirmar o indeferimento com o campo de motivo vazio e nenhum arquivo
  anexado
- **THEN** o servidor recusa a mudança e o andamento do pedido não muda

#### Scenario: PDF fora do tipo aceito é recusado
- **WHEN** o operador tenta anexar um arquivo que não é PDF (ex.: uma imagem) no passo de
  confirmação do indeferimento
- **THEN** o servidor recusa o arquivo com a mesma mensagem de erro já usada para tipo de anexo
  inválido nos demais uploads do painel

#### Scenario: Cancelamento não ganha a opção de PDF
- **WHEN** o operador muda o andamento de um pedido para "Cancelado"
- **THEN** a confirmação continua exigindo só o texto do motivo, sem campo de anexo

## ADDED Requirements

### Requirement: Prazo estimado informado na emissão do protocolo
Ao concluir a solicitação, junto do número do protocolo, o sistema SHALL exibir o prazo estimado de análise como data-limite ("até DD/MM/AAAA"), calculado a partir da data de criação com o prazo padrão do cartório em dias corridos.

#### Scenario: Confirmação da solicitação online
- **WHEN** o cidadão conclui o envio de um pedido de serviço e a tela de confirmação exibe o protocolo
- **THEN** a confirmação exibe também o prazo estimado de análise com a data-limite calculada do padrão do cartório

### Requirement: Situação do prazo na consulta do protocolo
A consulta pública do protocolo SHALL exibir a situação do prazo de um pedido de serviço em andamento: em qual dia da contagem ele está ("dia X de N") e a data prevista. O prazo exibido SHALL ser o gravado no pedido quando o cartório o ajustou, ou o calculado da data de criação com o padrão do cartório quando não há prazo gravado. Pedidos em andamento terminal (concluído, indeferido, cancelado, arquivado) SHALL NOT exibir prazo. Quando a data prevista já passou, a consulta SHALL informar que o prazo está em revisão pelo cartório, sem usar a palavra "vencido" nem contagem de dias de atraso.

#### Scenario: Pedido dentro do prazo
- **WHEN** o cidadão consulta um protocolo de pedido em andamento cuja data prevista ainda não passou
- **THEN** a consulta mostra o dia atual da contagem, o total de dias e a data prevista

#### Scenario: Pedido com prazo ajustado pelo cartório
- **WHEN** o cartório zerou ou ajustou o prazo do pedido e o cidadão consulta o protocolo
- **THEN** a contagem e a data prevista exibidas refletem o prazo gravado, não o calculado da criação

#### Scenario: Data prevista já passou
- **WHEN** o cidadão consulta um protocolo em andamento cuja data prevista já passou
- **THEN** a consulta informa que o prazo está em revisão pelo cartório, sem exibir dias de atraso

#### Scenario: Pedido encerrado
- **WHEN** o cidadão consulta um protocolo em andamento terminal
- **THEN** a consulta não exibe bloco de prazo

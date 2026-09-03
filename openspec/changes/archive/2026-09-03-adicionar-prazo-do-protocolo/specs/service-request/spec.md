## ADDED Requirements

### Requirement: Prazo estimado informado na emissão do protocolo
Ao concluir a solicitação, junto do número do protocolo, o sistema SHALL exibir o prazo estimado de análise como data-limite ("até DD/MM/AAAA"), contado da emissão em dias úteis, com o prazo legal do ato pedido. Para ato sem prazo legal, SHALL usar o prazo padrão do cartório. A previsão SHALL vir acompanhada da ressalva de que os pedidos são atendidos por ordem de chegada.

#### Scenario: Confirmação da solicitação online
- **WHEN** o cidadão conclui o envio de um pedido de serviço e a tela de confirmação exibe o protocolo
- **THEN** a confirmação exibe a data-limite contada em dias úteis com o prazo legal daquele ato, e a ressalva da ordem de chegada

### Requirement: Situação do prazo na consulta do protocolo
A consulta pública do protocolo SHALL exibir a situação do prazo de um pedido de serviço em andamento: em qual dia útil da contagem ele está ("dia X de N") e a data prevista, com a ressalva da ordem de chegada. O prazo exibido SHALL ser, nesta ordem: o gravado no pedido quando o cartório o ajustou, o prazo legal do ato, ou o padrão do cartório. No dia do protocolo, quando nenhum dia útil correu ainda, SHALL informar que a contagem começa no próximo dia útil. Pedidos em andamento terminal (concluído, indeferido, cancelado, arquivado) SHALL NOT exibir prazo. Quando a data prevista já passou, a consulta SHALL informar que o prazo está em revisão pelo cartório, sem usar a palavra "vencido" nem contagem de dias de atraso.

#### Scenario: Pedido dentro do prazo
- **WHEN** o cidadão consulta um protocolo de pedido em andamento cuja data prevista ainda não passou
- **THEN** a consulta mostra o dia atual da contagem, o total de dias e a data prevista

#### Scenario: Contagem em dias úteis
- **WHEN** o prazo de um pedido atravessa fim de semana ou feriado nacional
- **THEN** esses dias não avançam a contagem nem a data prevista

#### Scenario: Consulta no mesmo dia do protocolo
- **WHEN** o cidadão consulta um protocolo emitido hoje
- **THEN** a consulta informa que a contagem começa no próximo dia útil, com a data prevista

#### Scenario: Pedido com prazo ajustado pelo cartório
- **WHEN** o cartório zerou ou ajustou o prazo do pedido e o cidadão consulta o protocolo
- **THEN** a contagem e a data prevista exibidas refletem o prazo gravado, não o prazo legal do ato

#### Scenario: Data prevista já passou
- **WHEN** o cidadão consulta um protocolo em andamento cuja data prevista já passou
- **THEN** a consulta informa que o prazo está em revisão pelo cartório, sem exibir dias de atraso

#### Scenario: Pedido encerrado
- **WHEN** o cidadão consulta um protocolo em andamento terminal
- **THEN** a consulta não exibe bloco de prazo

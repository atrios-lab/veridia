## ADDED Requirements

### Requirement: Prazo suspenso na consulta do protocolo
Quando o prazo de um pedido de serviço estiver suspenso, a consulta pública do protocolo SHALL informar que o prazo está suspenso e o motivo (aguardando o cumprimento da exigência, aguardando o pagamento, ou ambos), em lugar da contagem "dia X de N" e da data prevista. Quando o prazo for retomado, a consulta SHALL voltar a exibir a contagem e a data prevista vigentes, com a ressalva da ordem de chegada.

#### Scenario: Exigência pendente
- **WHEN** o cidadão consulta um protocolo com exigência pendente
- **THEN** a consulta diz que o prazo está suspenso aguardando o cumprimento da exigência, sem data prevista

#### Scenario: Pagamento pendente
- **WHEN** o cidadão consulta um protocolo em "Aguardando pagamento" com valor lançado
- **THEN** a consulta diz que o prazo está suspenso aguardando o pagamento, sem data prevista

#### Scenario: Prazo retomado
- **WHEN** o cidadão consulta o protocolo depois de a exigência ser cumprida
- **THEN** a consulta volta a mostrar a contagem e a data prevista vigentes, com a ressalva da ordem de chegada

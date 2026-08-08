## ADDED Requirements

### Requirement: Pedido pode nascer de uma conversa de atendimento

O lançamento manual de pedido (`/admin/pedidos/novo`) SHALL aceitar ser iniciado a partir de uma
conversa de atendimento encerrada, pré-preenchendo nome e contato do cidadão a partir dela. O
pedido criado por esse caminho SHALL registrar a conversa de origem.

#### Scenario: Pedido criado a partir da conversa
- **WHEN** o atendente encerra uma conversa escolhendo "Lançar um pedido novo a partir desta
  conversa"
- **THEN** o pedido criado guarda a referência à conversa de origem, sem exigir preencher de novo
  nome e contato já conhecidos

### Requirement: Histórico do pedido lista transcrições vinculadas

O detalhe do pedido SHALL exibir as transcrições de conversa vinculadas a ele, com data, atendente
e link para abrir a transcrição completa.

#### Scenario: Transcrição no histórico do pedido
- **WHEN** um atendente vincula, ao encerrar, uma conversa a um pedido existente
- **THEN** o detalhe daquele pedido passa a listar a transcrição, com data e atendente

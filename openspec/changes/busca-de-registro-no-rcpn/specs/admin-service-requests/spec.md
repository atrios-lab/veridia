## ADDED Requirements

### Requirement: Resposta da busca de registro
O detalhe de um pedido de busca de registro DEVE (SHALL) mostrar o cartão "Resposta da busca" no lugar da entrega, com a pergunta se o registro foi localizado e o texto ao cidadão, ambos obrigatórios. Enviar a resposta DEVE (SHALL) concluir o pedido, registrar no histórico e avisar o cidadão por e-mail sem o conteúdo da resposta. O valor é facultativo: o detalhe DEVE (SHALL) manter o cartão de valor, e a serventia que cobra a busca o informa.

#### Scenario: Registro localizado
- **WHEN** o operador marca "Sim, consta nesta serventia", escreve que a profissão é agricultor e envia
- **THEN** o pedido fica "Concluído", o histórico mostra que a busca foi respondida, e o cidadão recebe o e-mail "Resposta da sua busca"

#### Scenario: Serventia que cobra a busca
- **WHEN** o operador informa o valor de um pedido de busca
- **THEN** a trilha mostra "Aguardando pagamento", e a consulta do protocolo mostra a cobrança

#### Scenario: Serventia que não cobra a busca
- **WHEN** o operador responde a busca sem informar valor
- **THEN** o pedido é concluído sem nenhuma cobrança

#### Scenario: Corrigir a resposta
- **WHEN** o operador corrige uma resposta já enviada
- **THEN** a nova resposta substitui a anterior na consulta do protocolo

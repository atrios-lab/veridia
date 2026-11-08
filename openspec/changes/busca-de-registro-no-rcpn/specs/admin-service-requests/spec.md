## ADDED Requirements

### Requirement: Resposta da busca de registro
O detalhe de um pedido de busca de registro DEVE (SHALL) mostrar o cartão "Resposta da busca" no lugar do valor e da entrega, com a pergunta se o registro foi localizado e o texto ao cidadão, ambos obrigatórios. Enviar a resposta DEVE (SHALL) concluir o pedido, registrar no histórico e avisar o cidadão por e-mail sem o conteúdo da resposta. O servidor SHALL NOT aceitar valor num pedido de busca.

#### Scenario: Registro localizado
- **WHEN** o operador marca "Sim, consta nesta serventia", escreve que a profissão é agricultor e envia
- **THEN** o pedido fica "Concluído", o histórico mostra que a busca foi respondida, e o cidadão recebe o e-mail "Resposta da sua busca"

#### Scenario: Valor na busca
- **WHEN** alguém tenta informar valor num pedido de busca
- **THEN** o servidor recusa com a orientação de responder pela resposta da busca

#### Scenario: Corrigir a resposta
- **WHEN** o operador corrige uma resposta já enviada
- **THEN** a nova resposta substitui a anterior na consulta do protocolo

## ADDED Requirements

### Requirement: Detalhe do pedido exibe as perguntas do cidadão
O detalhe do pedido no painel SHALL exibir um card "Perguntas do cidadão" com a mesma thread visível na consulta do cidadão: cada mensagem com autor (nome do solicitante ou nome do operador que respondeu) e data/hora, em ordem cronológica, e o selo derivado "Aguardando resposta" / "Respondida". O acesso SHALL exigir sessão autenticada com permissão `requests.manage`, verificada no servidor.

#### Scenario: Operador vê a pergunta no contexto do pedido
- **WHEN** um cidadão enviou uma pergunta pela consulta do protocolo e o operador abre o detalhe do pedido
- **THEN** o card "Perguntas do cidadão" mostra a pergunta com o nome do solicitante, data/hora e o selo "Aguardando resposta"

#### Scenario: Sem permissão não há acesso
- **WHEN** uma requisição sem sessão com `requests.manage` tenta ler ou responder perguntas de um pedido
- **THEN** o servidor recusa a operação

### Requirement: Operador responde e a resposta aparece na consulta do cidadão
O card SHALL ter um composer "Responder ao cidadão…" com botão "Enviar resposta". A resposta SHALL ser validada no núcleo (mesmas regras de corpo da pergunta) e, uma vez registrada, SHALL aparecer automaticamente na consulta do cidadão pelo protocolo, identificada pela serventia, sem qualquer passo adicional (e-mail manual, telefone).

#### Scenario: Resposta chega à consulta do cidadão
- **WHEN** o operador envia "Serve cópia simples, desde que legível" como resposta
- **THEN** a mensagem entra na thread, o selo do card passa a "Respondida" e a mesma resposta aparece na consulta do cidadão destravada por protocolo + chave

### Requirement: Pergunta e resposta entram na auditoria do pedido
Cada pergunta do cidadão SHALL gravar entrada de auditoria `service-request.question` (sem autor de sessão, como as demais ações do cidadão) e cada resposta SHALL gravar `service-request.question.reply` com o operador como autor, ambas com `targetId` do pedido. As entradas SHALL aparecer no card "Histórico" do detalhe, com rótulo em português, junto das demais ações (mudança de andamento, exigência etc.), e SHALL sobreviver à exclusão do protocolo como o restante da auditoria.

#### Scenario: Resposta aparece no histórico
- **WHEN** a operadora Helena responde uma pergunta
- **THEN** o card "Histórico" passa a mostrar "Helena … respondeu uma pergunta do cidadão" com data/hora, acima dos eventos anteriores

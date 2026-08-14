## ADDED Requirements

### Requirement: Consulta detalhada exibe a thread de perguntas do pedido
A consulta destravada por protocolo + chave de pedidos do tipo `service-request` SHALL exibir um card "Perguntas sobre este pedido" com o histórico de perguntas e respostas em ordem cronológica, cada mensagem com autor e data/hora. Mensagens do cidadão SHALL aparecer como "Você"; mensagens da serventia SHALL aparecer com o nome da serventia. O card SHALL informar a expectativa de resposta ("o cartório responde em até 1 dia útil") e MUST NOT exibir presença online, indicador de "digitando" ou qualquer sinal de tempo real. A thread SHALL ser visível apenas com protocolo + chave válidos, na mesma regra de acesso do restante do detalhe.

#### Scenario: Histórico com autor e data/hora
- **WHEN** o cidadão destrava o detalhe de um pedido que tem uma pergunta enviada em 03/08 e uma resposta da serventia em 04/08
- **THEN** o card mostra as duas mensagens em ordem cronológica, a primeira como "Você" com data/hora de 03/08 e a segunda com o nome da serventia e data/hora de 04/08

#### Scenario: Consulta pública sem chave não expõe a thread
- **WHEN** alguém consulta o protocolo sem informar a chave de acesso
- **THEN** nenhuma pergunta ou resposta é exibida ou retornada

### Requirement: Cidadão envia pergunta pela própria consulta
O card de perguntas SHALL permitir enviar uma pergunta em texto, sem pedir e-mail nem telefone, autenticada por protocolo + chave e sujeita ao mesmo rate limit das demais ações públicas do protocolo. O corpo da pergunta SHALL ser validado no núcleo (texto obrigatório após trim, limite máximo de tamanho) com mensagens de erro em português. Após o envio, a pergunta SHALL aparecer imediatamente na thread.

#### Scenario: Envio de pergunta sem dados de contato
- **WHEN** o cidadão escreve "O documento precisa ser autenticado?" e clica em "Enviar pergunta"
- **THEN** a pergunta entra na thread com autor "Você" e data/hora, sem que nenhum campo de e-mail ou telefone tenha sido pedido

#### Scenario: Pergunta vazia é rejeitada
- **WHEN** o cidadão tenta enviar uma pergunta em branco ou só com espaços
- **THEN** a ação retorna erro de validação em português e nada é gravado

### Requirement: Selo de status indica pergunta pendente na consulta
O card de perguntas SHALL exibir um selo derivado da última mensagem da thread: "Aguardando resposta" quando a última mensagem é do cidadão, "Respondida" quando a última mensagem é da serventia. Sem mensagens, o card MUST NOT exibir selo.

#### Scenario: Pergunta sem resposta mostra "Aguardando resposta"
- **WHEN** a última mensagem da thread é uma pergunta do cidadão
- **THEN** o selo exibido é "Aguardando resposta"

#### Scenario: Resposta da serventia muda o selo
- **WHEN** a serventia registra uma resposta após a pergunta
- **THEN** o selo exibido passa a ser "Respondida"

### Requirement: Cidadão é avisado por e-mail quando a serventia responde
Quando a serventia registra uma resposta, o sistema SHALL enviar e-mail ao contato de e-mail informado no pedido avisando que há resposta disponível na consulta do protocolo. O e-mail MUST NOT conter a chave de acesso nem o teor da resposta — apenas a orientação de consultar pelo protocolo. Quando o contato informado no pedido não é um e-mail, o envio SHALL ser omitido sem erro; falha no envio MUST NOT impedir o registro da resposta.

#### Scenario: Resposta dispara aviso por e-mail
- **WHEN** o operador envia uma resposta em um pedido cujo contato é um e-mail
- **THEN** o cidadão recebe e-mail avisando que sua pergunta foi respondida e orientando a consultar o protocolo, sem a chave nem o texto da resposta

#### Scenario: Contato sem e-mail não bloqueia a resposta
- **WHEN** o operador responde um pedido cujo contato informado é só um telefone
- **THEN** a resposta é registrada normalmente e nenhum e-mail é enviado

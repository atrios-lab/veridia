# Requirement Conversation

## ADDED Requirements

### Requirement: Conversa dentro do card da exigência

Cada exigência SHALL ter sua própria conversa, exibida dentro do card da exigência nos dois lados — o detalhe do pedido no painel e a consulta de protocolo do cidadão. Cada mensagem SHALL mostrar autor (nome do operador ou nome do requerente), data e hora, e avatar com iniciais. A conversa NÃO SHALL existir fora do card: não é um canal do pedido, é da exigência.

#### Scenario: Cidadão pergunta pela consulta

- **WHEN** o cidadão, autenticado por protocolo + chave, escreve "O documento precisa ser autenticado ou serve cópia simples?" na exigência pendente
- **THEN** a mensagem aparece na conversa daquela exigência, no painel e na consulta, com autor e hora

#### Scenario: Serventia responde pelo painel

- **WHEN** a operadora responde no campo "Responder ao cidadão…" do card
- **THEN** a mensagem aparece na conversa com o nome da operadora, e o card indica o estado "Respondida"

#### Scenario: Mensagem nova do cidadão sinalizada

- **WHEN** o cidadão escreve depois da última resposta da serventia
- **THEN** o card da exigência no painel sinaliza que há mensagem nova aguardando

### Requirement: Anexos na mensagem do cidadão

A mensagem do cidadão SHALL aceitar até 3 anexos (imagem ou PDF, mesmos limites de tipo e tamanho dos demais uploads), gravados como anexos do pedido presos à mensagem. O download SHALL passar pela mesma rota protegida por protocolo + chave (lado do cidadão) e pela rota autenticada do painel (lado do operador).

#### Scenario: Foto do documento na mensagem

- **WHEN** o cidadão envia uma mensagem com a foto do documento anexada
- **THEN** a mensagem aparece na conversa com o arquivo, e o operador abre o arquivo pelo painel

#### Scenario: Arquivo inválido recusado

- **WHEN** um arquivo que não é imagem nem PDF acompanha a mensagem
- **THEN** o envio é recusado com mensagem clara e nada é gravado

### Requirement: Escrita do cidadão protegida contra abuso

A rota de escrita do cidadão na conversa SHALL exigir protocolo + chave válidos com a mesma resposta neutra das demais rotas (não distingue protocolo inexistente de chave errada), SHALL ter rate limit próprio mais apertado que o global, e SHALL carregar o honeypot invisível do formulário público.

#### Scenario: Chave errada

- **WHEN** uma escrita chega com chave que não confere
- **THEN** a resposta é a mesma de protocolo inexistente, e nada é gravado

#### Scenario: Robô no honeypot

- **WHEN** a escrita chega com o campo isca preenchido
- **THEN** a resposta simula sucesso e nenhuma mensagem é gravada

### Requirement: Cumprimento encerra a conversa

Quando a exigência for marcada como cumprida, a conversa SHALL encerrar: nenhum dos lados consegue escrever, e o histórico permanece legível nos dois lados. A conversa de exigência cumprida SHALL ser imutável.

#### Scenario: Conversa encerrada para o cidadão

- **WHEN** a exigência é marcada como cumprida pelo operador
- **THEN** a consulta do cidadão mostra a conversa como histórico, sem campo de escrita

#### Scenario: Conversa encerrada para a serventia

- **WHEN** a exigência está cumprida
- **THEN** o card no painel mostra a conversa sem o campo "Responder ao cidadão…"

### Requirement: Aviso por e-mail na resposta da serventia

Quando a serventia responde na conversa, o cidadão SHALL ser avisado por e-mail — sem o conteúdo da mensagem, apenas o protocolo e a instrução de consultar com a chave. O envio SHALL ser fire-and-forget (falha de e-mail nunca falha a resposta) e SHALL ocorrer apenas quando o contato do requerente for um e-mail.

#### Scenario: Resposta gera aviso

- **WHEN** a operadora envia uma resposta na conversa e o contato do pedido é um e-mail
- **THEN** um aviso "a serventia respondeu na exigência do seu pedido" chega ao contato, sem o texto da resposta

#### Scenario: Contato é telefone

- **WHEN** o contato do pedido é um número de telefone
- **THEN** nenhum e-mail é tentado e a resposta é gravada normalmente

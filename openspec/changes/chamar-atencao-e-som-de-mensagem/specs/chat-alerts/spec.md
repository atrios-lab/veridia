## ADDED Requirements

### Requirement: Atendente ouve a mensagem nova também com a conversa aberta

Cada mensagem nova do cidadão numa conversa do atendente SHALL tocar o "Som de nova mensagem"
(padrão "Bolha de chat", o mesmo do cidadão), inclusive com a conversa aberta na tela. Com a
conversa aberta e visível, SHALL tocar só o som, sem cartão, tremor ou notificação.

#### Scenario: Conversa aberta

- **WHEN** o atendente está com a conversa aberta e o cidadão envia uma mensagem
- **THEN** toca o som de nova mensagem e nada mais

### Requirement: Cidadão chama a atenção do cartório a cada 10 minutos sem resposta

O chat do site SHALL oferecer "Chamar atenção", liberado só depois de 10 minutos desde o mais
recente entre o início da conversa, a última resposta do cartório e o último chamado do cidadão.
O servidor SHALL recusar um chamado antes disso. O chamado SHALL deixar uma linha de sistema na
conversa, SHALL contar como atividade do cidadão e SHALL fazer o painel do atendente da conversa
(ou de quem atende a fila, se ela ainda espera) tocar o toque "Chamar atenção", tremer e piscar
"Chat", mesmo com "tremer a tela" desligado.

#### Scenario: Antes dos 10 minutos

- **WHEN** a conversa começou há 5 minutos sem resposta
- **THEN** o botão mostra "Chamar atenção (em 5 min)" desabilitado e o servidor recusaria o chamado

#### Scenario: Depois dos 10 minutos

- **WHEN** o cidadão chama após 10 minutos sem resposta
- **THEN** o painel do atendente treme e toca, e o botão do cidadão volta a esperar 10 minutos

### Requirement: Cartório chama a atenção do cidadão sem limite

O console da conversa SHALL oferecer "Chamar atenção", sem limite de vezes. No site, o chat do
cidadão SHALL abrir, a janela SHALL tremer, SHALL tocar o toque "Chamar atenção" e o celular
SHALL vibrar onde o navegador oferece.

#### Scenario: Chamado com o chat fechado

- **WHEN** o atendente chama e o cidadão está com a janela do chat fechada
- **THEN** a janela abre, treme e toca

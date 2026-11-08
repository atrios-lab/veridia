## ADDED Requirements

### Requirement: Toques variados e intensos

"Avisos do atendimento" SHALL oferecer ao menos 15 toques originais em grupos (Clássicos, Retrô,
Chat e celular, Urgentes), além de "Sem som", com volume padrão de 90%. Os toques SHALL passar por
um reforço com limitador, para soar alto sem distorcer. Nenhum toque SHALL copiar o som de uma
marca.

#### Scenario: Escolher um toque

- **WHEN** o atendente escolhe "Retrô 8 bits" na lista
- **THEN** o toque toca na hora, como prévia, e passa a ser o dos avisos

### Requirement: Chamar atenção com a tela

Com "Tremer a tela e piscar Chat" ligado (padrão), cada aviso novo SHALL fazer o painel tremer
uma vez e "Chat" piscar na tela três vezes em 1,5s, com o título e o nome do aviso. A repetição
até atender SHALL NOT tremer nem piscar. Com movimento reduzido, nada SHALL tremer nem piscar.

#### Scenario: Conversa nova

- **WHEN** um cidadão entra na fila e o atendente está em outra tela do painel
- **THEN** o painel treme, "Chat · Nova conversa na fila · nome · assunto" pisca e o cartão fica

### Requirement: Repetir a partir de 10 segundos

A repetição até atender SHALL oferecer 10, 15, 30 e 60 segundos, com 10 como padrão.

#### Scenario: Opções

- **WHEN** o atendente abre o intervalo da repetição
- **THEN** a primeira opção é "10 segundos"

### Requirement: Cidadão é avisado das respostas

No chat do site, cada resposta nova do cartório SHALL tocar um aviso suave (se o "Som de aviso"
estiver ligado, o padrão), piscar o título da aba enquanto a página está em segundo plano e fazer
o botão do chat pulsar com o contador enquanto a janela está fechada. A notificação do navegador
SHALL existir só se o cidadão pedir, e SHALL NOT mostrar o texto da mensagem. A primeira carga da
conversa e as mensagens do próprio cidadão SHALL NOT avisar, e cada mensagem SHALL contar uma vez
só.

#### Scenario: Resposta com a janela fechada

- **WHEN** o cidadão fecha a janela do chat e o cartório responde
- **THEN** toca o aviso, o botão pulsa e o contador mostra 1

#### Scenario: Primeira resposta numa conversa sem mensagens

- **WHEN** a conversa ainda não tem mensagem e chega a primeira resposta do cartório
- **THEN** o aviso toca, porque é resposta nova, não a primeira carga

#### Scenario: Mensagem do próprio cidadão

- **WHEN** o cidadão envia uma mensagem
- **THEN** nada toca

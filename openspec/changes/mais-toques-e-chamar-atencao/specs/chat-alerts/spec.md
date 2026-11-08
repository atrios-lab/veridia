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

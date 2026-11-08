## ADDED Requirements

### Requirement: Atendente é avisado em qualquer tela do painel

Para quem tem `chat.manage`, o painel SHALL consultar o atendimento a cada 5 segundos em todas as
telas, também com a aba em segundo plano, e SHALL avisar de conversa nova na fila, de mensagem
nova do cidadão numa conversa do atendente e de conversa transferida para ele. A primeira
consulta ao abrir o painel SHALL NOT anunciar o que já estava lá. Quem está "Ausente" SHALL NOT
ser chamado pela fila.

#### Scenario: Conversa nova fora da tela de atendimento

- **WHEN** o atendente está em Pedidos e um cidadão entra na fila
- **THEN** toca o som escolhido, aparece a notificação do navegador (se autorizada) e um cartão
  piscando "1 pessoa aguardando atendimento" com "Ver fila"

#### Scenario: Atender não avisa a si mesmo

- **WHEN** o atendente clica em "Atender" numa conversa da fila
- **THEN** nenhum aviso de transferência é dado a ele

#### Scenario: Mensagem na conversa aberta

- **WHEN** chega mensagem do cidadão na conversa que o atendente está olhando
- **THEN** não há aviso, porque a própria tela mostra a mensagem

### Requirement: Atendente escolhe como é avisado

A tela de Atendimento SHALL ter "Avisos do atendimento" com: toque (5 opções ou "Sem som"),
volume de 0 a 100% com "Testar", repetir até atender (15, 30 ou 60s), aviso piscando na tela e
notificações do navegador. As escolhas SHALL ficar salvas no navegador; valor salvo inválido SHALL
voltar ao padrão (Sino, 80%, repetir a cada 30s, aviso e notificação ligados).

#### Scenario: Pedido de permissão

- **WHEN** a permissão de notificação ainda não foi dada e o atendente clica "Ativar notificações"
- **THEN** o navegador pergunta e, autorizado, mostra uma notificação de confirmação

#### Scenario: Notificação bloqueada

- **WHEN** o navegador bloqueou as notificações do site
- **THEN** a tela mostra como liberar no Chrome, sem botão que não funcionaria

#### Scenario: Som bloqueado pelo navegador

- **WHEN** há aviso pendente e o navegador ainda não deixou a página tocar som
- **THEN** o painel mostra "O navegador bloqueou o som. Clique aqui para ativar."

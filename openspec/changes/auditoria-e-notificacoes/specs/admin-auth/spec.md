## ADDED Requirements

### Requirement: Auditoria do painel e notificação para esclarecimentos

O painel SHALL ter a aba Auditoria. Só quem tem `audit.manage` (o Tabelião/Registrador) e a conta mestre da
Átrios SHALL ver a trilha em detalhe. A conta mestre SHALL ver a trilha de qualquer serventia ou de todas. O
Tabelião/Registrador SHALL poder anotar registros, gerar o PDF, enviar por e-mail e notificar a pessoa que
praticou o ato. A notificação SHALL trazer fundamentação legal e dar 24 horas para resposta. Ela SHALL chegar
ao e-mail da pessoa e SHALL poder ser assinada digitalmente e impressa. Os demais cargos SHALL ver só as
notificações endereçadas a eles e SHALL responder pela aba.

#### Scenario: Notificar um escrevente

- **WHEN** o Tabelião/Registrador marca dois registros de um escrevente e envia a notificação
- **THEN** a notificação recebe o próximo número do ano e o prazo de 24 horas
- **AND** chega ao e-mail do escrevente com o PDF e aparece na aba Auditoria dele

#### Scenario: Só a pessoa notificada responde

- **WHEN** outra pessoa tenta responder a notificação
- **THEN** a resposta é recusada
- **AND** a pessoa notificada responde uma única vez, com texto e anexos

#### Scenario: Escrevente não vê a trilha

- **WHEN** um escrevente abre a aba Auditoria
- **THEN** vê só as próprias notificações, nunca a trilha da serventia

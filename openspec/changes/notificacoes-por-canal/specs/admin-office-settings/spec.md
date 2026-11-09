## ADDED Requirements

### Requirement: Notificações por canal

O painel SHALL oferecer em Configurações, para cada canal (chat, agenda, guias, pedidos, LGPD,
ouvidoria), a escolha da serventia entre notificar e silenciar, o aviso na tela, a notificação do
navegador, o som e o tremor da tela com vibração. A escolha SHALL valer para todos os atendentes da
serventia, e um canal sem escolha salva SHALL seguir o padrão.

#### Scenario: Silenciar um canal

- **WHEN** a serventia marca "Silenciar" na agenda e salva
- **THEN** um agendamento novo não mostra aviso, não toca som, não treme a tela e não manda notificação

#### Scenario: Trocar o som

- **WHEN** a serventia escolhe outro som para as guias e salva
- **THEN** o próximo pedido de guia toca o som escolhido

#### Scenario: Pedido registrado no balcão

- **WHEN** o próprio balcão registra um pedido
- **THEN** o painel não avisa dele como pedido novo do site

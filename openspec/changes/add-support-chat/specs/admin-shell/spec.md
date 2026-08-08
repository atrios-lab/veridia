## ADDED Requirements

### Requirement: Item "Atendimento online" com contador de conversas aguardando

A sidebar SHALL listar o item "Atendimento online" no grupo "Canais do cidadão", atrás da
permissão `chat.manage`, com um contador do número de conversas em espera na serventia, visível
em qualquer tela do painel.

#### Scenario: Item aparece com a permissão
- **WHEN** um usuário com `chat.manage` abre qualquer tela do painel
- **THEN** a sidebar mostra "Atendimento online" com o número de conversas aguardando

#### Scenario: Contador atualiza entre navegações
- **WHEN** uma conversa nova entra na fila enquanto o usuário está em `/admin/configuracoes`
- **THEN** o contador do item "Atendimento online" reflete o novo total na próxima navegação ou
  sondagem

### Requirement: Indicador "Disponível para o chat" no cabeçalho reflete estado real

O cabeçalho do painel SHALL exibir o indicador "Disponível para o chat" com o estado real da
serventia (ligado/desligado), substituindo o elemento puramente visual, sem lógica, registrado em
`add-admin-service-requests`.

#### Scenario: Indicador reflete o interruptor
- **WHEN** a serventia está com o chat desligado
- **THEN** o cabeçalho do painel mostra o indicador no estado desligado, em qualquer tela

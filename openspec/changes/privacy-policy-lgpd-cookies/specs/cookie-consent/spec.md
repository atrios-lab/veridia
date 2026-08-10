## ADDED Requirements

### Requirement: Aviso de cookies na primeira visita

O site público SHALL exibir, na primeira visita do cidadão, um aviso informando que o site usa
apenas cookies essenciais ao funcionamento (sessão e atendimento por chat), com link para a
página `/privacidade` e uma única ação de ciência ("Entendi"). Como não há cookies não
essenciais, o aviso MUST NOT oferecer gestão de categorias nem botão de recusa — é ciência,
não opt-in.

#### Scenario: Aviso exibido na primeira visita

- **WHEN** o cidadão acessa qualquer página pública sem ciência registrada
- **THEN** o aviso aparece sem bloquear a leitura da página, com o link para a política e a
  ação de ciência

#### Scenario: Ciência registrada silencia o aviso

- **WHEN** o cidadão aciona "Entendi"
- **THEN** a escolha é persistida no navegador e o aviso não reaparece nas visitas seguintes

### Requirement: Aviso não bloqueia navegação nem tratamento essencial

O aviso SHALL ser não modal: o cidadão SHALL conseguir navegar e usar os canais do site sem
interagir com ele. Os cookies essenciais MUST continuar funcionando independentemente da
ciência, pois seu tratamento se ampara em execução do serviço, não em consentimento. Exceção
única: o chat de atendimento, que grava cookie próprio e ocupa o mesmo canto da tela, SHALL
aparecer somente depois da ciência — e imediatamente, sem exigir recarga.

#### Scenario: Navegação livre com aviso visível

- **WHEN** o cidadão navega entre páginas sem acionar a ciência
- **THEN** formulários e consultas funcionam normalmente e o aviso permanece visível

#### Scenario: Chat aguarda a ciência

- **WHEN** o cidadão ainda não acionou "Entendi"
- **THEN** o botão do chat não é exibido
- **WHEN** o cidadão aciona "Entendi"
- **THEN** o aviso some e o botão do chat aparece sem recarregar a página

### Requirement: Aviso restrito ao site público

O aviso de cookies SHALL existir apenas no site público. O painel admin MUST NOT exibir o
aviso: o acesso autenticado de colaborador não é visita de titular.

#### Scenario: Painel admin sem aviso

- **WHEN** um colaborador usa o painel admin
- **THEN** nenhum aviso de cookies é exibido

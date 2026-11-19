## ADDED Requirements

### Requirement: Entrega na hora

O painel SHALL manter uma conexão com o servidor que avisa, em menos de um segundo, mensagem nova, edição, exclusão, reação e leitura, também com o painel em outra aba. Sem a conexão, o painel SHALL continuar consultando periodicamente como antes.

#### Scenario: Mensagem chega na hora
- **WHEN** um colega envia uma mensagem
- **THEN** ela aparece na conversa aberta do outro em menos de um segundo, e o aviso aparece em qualquer outra tela do painel

### Requirement: Digitando

Enquanto alguém escreve numa conversa, o outro membro SHALL ver "digitando…" na conversa e na lista. O aviso SHALL sumir no envio ou poucos segundos depois de parar de escrever.

#### Scenario: Aparece e some
- **WHEN** o colega começa a escrever e depois envia
- **THEN** "digitando…" aparece enquanto escreve e some quando a mensagem chega

### Requirement: Leitura, resposta e reação

Cada mensagem própria SHALL mostrar se foi enviada, entregue ou lida. Uma mensagem SHALL poder responder a outra da mesma conversa, mostrando o trecho citado. Cada pessoa SHALL poder reagir com um emoji da lista, um por mensagem; reagir de novo com o mesmo emoji SHALL desfazer, sem apagar registro.

#### Scenario: Reação desfeita sem apagar
- **WHEN** a pessoa toca de novo na própria reação
- **THEN** a reação some da conversa e o registro fica guardado

### Requirement: Sons por pessoa

Cada pessoa SHALL escolher o som da mensagem (ou o da serventia, ou nenhum) e o do "Chamar atenção", ouvir antes, ajustar o volume, escolher se toca com a conversa aberta ou com o painel em outra aba, se repete até ler, e ligar "Não perturbe" por 30 minutos, 1 hora ou até o dia seguinte.

#### Scenario: Não perturbe
- **WHEN** a pessoa liga "Não perturbe" por 1 hora e chega mensagem
- **THEN** não toca som, mas o aviso e o número de não lidas aparecem

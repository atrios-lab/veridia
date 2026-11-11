## ADDED Requirements

### Requirement: Mensagens internas com supervisão do titular

O painel SHALL ter mensagens internas entre as pessoas da serventia, com texto, arquivos, áudio e "chamar
atenção". Só os participantes de uma conversa e o Tabelião/Registrador (e a conta da Átrios) SHALL ler a
conversa e os arquivos dela. A tela SHALL avisar a todos que o Tabelião/Registrador pode ler as conversas.

#### Scenario: Recado entre colegas

- **WHEN** o escrevente manda uma mensagem para a auxiliar
- **THEN** a auxiliar ouve o som e vê "Fulano diz:" no canto, em qualquer tela do painel

#### Scenario: Supervisão

- **WHEN** o Tabelião/Registrador abre "Todas as conversas"
- **THEN** vê cada conversa da serventia, só para leitura
- **AND** alguém fora da conversa, sem ser o titular, não consegue abri-la nem baixar os arquivos

## MODIFIED Requirements

### Requirement: Publicação atômica com descarte

A aba SHALL gravar todas as suas escolhas numa única operação, acionada por "Salvar e publicar".
Nenhuma alteração SHALL valer no site público antes disso. "Descartar mudanças" SHALL devolver o
formulário e a prévia ao que está publicado. Uma gravação bem-sucedida SHALL registrar entrada em
`audit_log` com autor, ação e serventia, SHALL revalidar o site público, e SHALL confirmar o
sucesso ao usuário por um toast transitório — não por um elemento que permanece fixo na tela até a
próxima ação.

#### Scenario: Nada vale antes de publicar

- **WHEN** o usuário troca estilo, textos e seções e sai da tela sem publicar
- **THEN** o site público continua exatamente como estava

#### Scenario: Descartar volta ao publicado

- **WHEN** o usuário aciona "Descartar mudanças"
- **THEN** o formulário e a prévia voltam ao estado publicado, sem gravar nada

#### Scenario: Uma gravação, um rastro

- **WHEN** uma publicação é aceita
- **THEN** existe uma linha em `audit_log` identificando quem publicou, em qual serventia e
  quando, o site público passa a servir o novo conteúdo, e o usuário vê um toast confirmando a
  publicação

#### Scenario: Falha de gravação não publica pela metade

- **WHEN** a gravação falha no banco
- **THEN** nenhuma das escolhas passa a valer e a tela informa a falha preservando o que foi
  preenchido

#### Scenario: Editar depois de publicar não sugere nova publicação

- **WHEN** o usuário publica com sucesso e, em seguida, troca o estilo (ou qualquer outro campo)
  de novo sem acionar "Salvar e publicar" outra vez
- **THEN** nada na tela dá a entender que essa nova escolha já foi publicada — o toast da
  publicação anterior já desapareceu sozinho, sem depender de a tela rastrear se os campos ainda
  batem com o que foi salvo

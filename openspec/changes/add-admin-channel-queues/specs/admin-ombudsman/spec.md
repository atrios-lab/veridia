## ADDED Requirements

### Requirement: Fila de manifestações com tipo, situação e identificação

O painel SHALL oferecer `/admin/ouvidoria`, atrás da permissão `channels.manage`, listando as
manifestações (`kind = "ombudsman"`) da serventia, mais recentes primeiro, cada linha mostrando o
protocolo, o tipo (Reclamação, Sugestão, Elogio, Denúncia), a situação, e se a manifestação é
identificada ou anônima.

#### Scenario: Manifestação anônima sinalizada na fila

- **WHEN** uma manifestação foi registrada sem nome nem contato
- **THEN** a linha da fila mostra "Anônima · sem contato informado"

#### Scenario: Manifestação identificada sinalizada na fila

- **WHEN** uma manifestação tem nome e contato
- **THEN** a linha da fila mostra que é identificada e por qual meio a resposta chegaria

#### Scenario: Manifestação sob sigilo

- **WHEN** uma manifestação foi registrada com `confidential = true`
- **THEN** a linha da fila indica "identidade em sigilo", sem expor o nome do manifestante ali

### Requirement: Responder manifestação identificada, disponível na consulta pelo registro

Quando a manifestação tem contato informado, o operador SHALL poder escrever uma resposta e
enviá-la — o que grava a resposta, marca a manifestação como respondida e a torna disponível na
consulta pelo número de registro — ou salvar a resposta como rascunho sem concluir.

#### Scenario: Enviar resposta conclui a manifestação

- **WHEN** o operador escreve uma resposta a uma manifestação identificada e clica em "Enviar
  resposta e concluir"
- **THEN** a manifestação passa para `status = "answered"`, a resposta fica disponível na consulta
  pelo número de registro, e um evento é registrado no histórico

#### Scenario: Salvar rascunho não conclui nem notifica

- **WHEN** o operador clica em "Salvar rascunho" numa manifestação identificada
- **THEN** o texto é salvo e reaparece pré-preenchido depois, sem mudar a situação nem ficar
  visível a quem manifestou

### Requirement: Manifestação anônima sem contato só recebe anotação interna

Quando a manifestação não tem nome nem contato, o painel SHALL NÃO oferecer o formulário de
resposta ao manifestante — apenas um campo de anotação interna, visível só à equipe, com um aviso
explicando que não há como enviar resposta por não haver a quem responder.

#### Scenario: Sem formulário de resposta na manifestação anônima sem contato

- **WHEN** o operador abre uma manifestação sem `applicantName` nem `contact`
- **THEN** a tela não mostra nenhum campo nem botão de envio de resposta ao manifestante, e mostra
  o aviso de que a manifestação não tem contato

#### Scenario: Anotação interna não é enviada a ninguém

- **WHEN** o operador escreve uma anotação interna numa manifestação anônima sem contato e salva
- **THEN** a anotação fica associada à manifestação, um evento é registrado no histórico, e nada é
  enviado nem fica visível fora do painel

### Requirement: Contador de manifestações em aberto na sidebar

O painel SHALL mostrar, no item "Ouvidoria" da sidebar, a quantidade de manifestações com
`status` diferente de `"answered"` e `"done"` da serventia.

#### Scenario: Contador soma novas e em apuração

- **WHEN** a serventia tem 2 manifestações `new`, 1 `in-review` e 4 `answered`
- **THEN** o contador ao lado de "Ouvidoria" mostra 3

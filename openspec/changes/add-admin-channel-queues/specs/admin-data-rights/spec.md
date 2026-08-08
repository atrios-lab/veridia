## ADDED Requirements

### Requirement: Fila de requerimentos LGPD com prazo legal visível

O painel SHALL oferecer `/admin/lgpd`, atrás da permissão `channels.manage`, listando os
registros de `kind = "data-rights"` da serventia, mais recentes primeiro, cada linha mostrando o
protocolo, o titular e um indicador de prazo: "Vence em N dias" para requerimentos dentro do
prazo legal de 15 dias (Lei 13.709/2018) e ainda sem resposta, "Prazo vencido há N dias" para os
que já passaram do prazo sem resposta, e a situação (Recebido/Respondido/Cancelado) para os
demais.

#### Scenario: Requerimento perto do vencimento em destaque

- **WHEN** um requerimento tem `status = "new"` e a data de hoje está a 3 dias ou menos do prazo
  de 15 dias contado do recebimento
- **THEN** a linha da fila mostra "Vence em N dias" com destaque visual de atenção

#### Scenario: Requerimento vencido em destaque mais forte

- **WHEN** um requerimento tem `status = "new"` e a data de hoje já passou do prazo de 15 dias
- **THEN** a linha da fila mostra "Prazo vencido há N dias" com destaque visual de urgência,
  contando a partir do dia seguinte ao prazo

#### Scenario: Acesso sem a permissão

- **WHEN** uma sessão sem a permissão `channels.manage` visita `/admin/lgpd`
- **THEN** a rota responde como não encontrada, sem listar nenhum requerimento

### Requirement: Detalhe do requerimento mostra o pedido do titular por completo

O detalhe de um requerimento LGPD (`/admin/lgpd/[protocolo]`) SHALL mostrar o direito solicitado
(por extenso, não o código interno), a descrição que o titular escreveu, o nome e o contato
informados, e o anexo de identidade enviado pelo titular, quando houver.

#### Scenario: Direito e descrição por extenso

- **WHEN** o operador abre um requerimento cujo `details.right` é `"access"`
- **THEN** a tela mostra "Ver quais dados a serventia tem sobre a titular (acesso aos dados)" e o
  texto livre que o titular descreveu, não o valor bruto `"access"`

#### Scenario: Anexo de identidade visível quando enviado

- **WHEN** o titular anexou um arquivo de identidade ao registrar o requerimento
- **THEN** o detalhe mostra o nome do arquivo, identificado como enviado pelo titular

#### Scenario: Prazo mostrado com a data limite

- **WHEN** o operador abre um requerimento recebido em 04/08/2026
- **THEN** a tela mostra a data limite de resposta (19/08/2026, 15 dias corridos) e em qual dia do
  prazo hoje está

### Requirement: Responder ao titular, com anexo opcional, ou salvar rascunho

O operador SHALL poder escrever uma resposta ao titular, anexar opcionalmente um relatório de
dados, e enviá-la — o que grava a resposta, a marca o requerimento como respondido e a torna
visível ao titular pela consulta de protocolo existente — ou salvar a resposta como rascunho sem
concluir o requerimento nem torná-la visível ao titular.

#### Scenario: Enviar resposta conclui o requerimento

- **WHEN** o operador escreve uma resposta e clica em "Enviar resposta e concluir"
- **THEN** o requerimento passa para `status = "answered"`, a resposta fica disponível na consulta
  de protocolo do titular, e um evento é registrado no histórico do requerimento

#### Scenario: Anexo opcional de relatório de dados

- **WHEN** o operador anexa um arquivo ao enviar a resposta
- **THEN** o arquivo fica disponível ao titular junto da resposta na consulta de protocolo

#### Scenario: Salvar rascunho não conclui nem notifica

- **WHEN** o operador clica em "Salvar rascunho"
- **THEN** o texto é salvo e reaparece pré-preenchido na próxima vez que a tela é aberta, o
  requerimento continua `status = "new"`, e nada fica visível ao titular

#### Scenario: Resposta enviada limpa o rascunho

- **WHEN** um requerimento tinha um rascunho salvo e o operador envia a resposta final
- **THEN** o rascunho não fica retido junto da resposta enviada

### Requirement: Contador de requerimentos em aberto na sidebar

O painel SHALL mostrar, no item "Requerimentos LGPD" da sidebar, a quantidade de requerimentos
com `status = "new"` da serventia.

#### Scenario: Contador soma só os não respondidos

- **WHEN** a serventia tem 3 requerimentos `new` e 5 `answered`
- **THEN** o contador ao lado de "Requerimentos LGPD" mostra 3

## ADDED Requirements

### Requirement: Protocolo e chave de acesso do agendamento

O agendamento feito pelo site SHALL receber protocolo AGD e chave de acesso, mostrados na
confirmação e enviados no e-mail de confirmação; só o hash da chave SHALL ser guardado. Com o
protocolo e a chave, a consulta SHALL mostrar o detalhe do agendamento e, enquanto ele estiver
marcado e não tiver passado, SHALL aceitar documentos digitais em PDF enviados pelo cidadão
(recusando outros formatos), que o painel SHALL mostrar no agendamento. A confirmação, a consulta
e o e-mail SHALL avisar que os documentos em PDF adiantam a análise e que precisam estar legíveis
e em PDF pesquisável. "Perdi a chave" SHALL emitir uma nova chave para o AGD quando o e-mail
conferir com o do agendamento.

#### Scenario: Agendamento pelo site

- **WHEN** o cidadão confirma um agendamento
- **THEN** a confirmação mostra "Protocolo AGD.2026.000010" e a "Chave de acesso", e o e-mail traz os dois

#### Scenario: Documento antes de vir

- **WHEN** o cidadão abre o AGD com a chave e anexa um PDF
- **THEN** a consulta mostra "Documento 1" e o painel mostra "Enviou antes: Documento 1" no agendamento

#### Scenario: Agendamento antigo sem chave

- **WHEN** o cidadão pede uma nova chave com o protocolo AGD e o e-mail do agendamento
- **THEN** recebe uma chave por e-mail e passa a abrir o agendamento com ela

#### Scenario: Foto recusada

- **WHEN** o cidadão tenta anexar uma imagem PNG ao agendamento
- **THEN** a consulta responde "Envie o documento em PDF, legível e pesquisável" e nada é guardado

## ADDED Requirements

### Requirement: Duas agendas com grade e serviços próprios

A configuração SHALL ter as agendas "Atendimento do cartório" e "Atendimento com o tabelião",
cada uma com a sua grade semanal e os serviços que atende. A lista de serviços SHALL ser o
catálogo de um cartório de ofício único, agrupado por atribuição, cada serviço com o que
levar, para a serventia só marcar; um serviço SHALL poder ser marcado nas duas. Uma agenda
com horários e sem serviço marcado SHALL ser recusada ao salvar.

#### Scenario: Serventia marca serviços do tabelião

- **WHEN** a serventia abre a aba do tabelião, marca "Testamento" e "Procuração pública", põe horários e salva
- **THEN** o site oferece a agenda do tabelião só com esses serviços

#### Scenario: Agenda com horários e sem serviço

- **WHEN** a serventia salva uma agenda com horários e nenhum serviço marcado
- **THEN** o painel recusa e diz qual agenda precisa de serviço

### Requirement: Agenda do dia por agenda, com comprovante

A agenda do dia SHALL ter uma aba por agenda e mostrar só os agendamentos e horários dela. Cada
agendamento ativo ou atendido SHALL oferecer "Comprovante", o mesmo PDF do cidadão. Enquanto
as agendas dividirem os horários, um horário ocupado na outra agenda SHALL aparecer como
ocupado, com o nome dela.

#### Scenario: Comprovante impresso no balcão

- **WHEN** o atendente clica em "Comprovante" num agendamento
- **THEN** abre o PDF com o timbre da serventia, o horário, a hora de chegada e o que trazer

## MODIFIED Requirements

### Requirement: Listas de serviços e modos de atendimento editáveis

A serventia SHALL escolher os serviços de cada agenda no catálogo e SHALL poder criar
serviços próprios, cada um com a lista do que levar, e a lista de modos de atendimento como
cartões marcáveis (modos conhecidos com descrição; um modo já configurado fora da lista
conhecida SHALL continuar aparecendo e selecionável). As listas SHALL alimentar os campos do
formulário público. Um agendamento gravado SHALL preservar o rótulo do serviço da época, mesmo
que a lista mude depois.

#### Scenario: Serviço renomeado depois do agendamento

- **WHEN** a serventia renomeia ou remove um serviço que já tem agendamento gravado
- **THEN** o agendamento antigo continua exibindo o rótulo com que foi criado

#### Scenario: Serviço próprio com o que levar

- **WHEN** a serventia cria um serviço próprio, escreve o que levar e salva
- **THEN** o serviço entra na agenda aberta e a lista dele vai no comprovante

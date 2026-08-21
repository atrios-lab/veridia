## ADDED Requirements

### Requirement: Agendamento recebe protocolo AGD

Todo agendamento criado (pelo site ou pelo balcão) SHALL receber um protocolo
`AGD.AAAA.NNNNNN`, numerado por serventia e por ano na mesma disciplina dos demais canais: a
corrida entre duas criações simultâneas SHALL ser decidida por restrição única, com nova
tentativa de sequência para o perdedor. A consulta pública de protocolo SHALL encontrar um
protocolo AGD e responder tipo "Agendamento", estado e datas, sem expor dados pessoais.
Agendamentos anteriores à numeração MAY permanecer sem protocolo.

#### Scenario: Cidadão consulta o protocolo do agendamento

- **WHEN** um cidadão consulta na página pública um protocolo AGD existente
- **THEN** vê tipo "Agendamento", o estado atual e as datas de criação e atualização

### Requirement: Serviço "só com o tabelião" anunciado ao cidadão

Um serviço marcado "só com o tabelião" na configuração SHALL ser anunciado como tal no
formulário público de agendamento, antes da escolha do horário, para o cidadão saber que o
atendimento depende do tabelião.

#### Scenario: Cidadão escolhe serviço marcado

- **WHEN** o cidadão abre o formulário público e o serviço escolhido está marcado
- **THEN** o formulário mostra a indicação "só com o tabelião" junto ao serviço

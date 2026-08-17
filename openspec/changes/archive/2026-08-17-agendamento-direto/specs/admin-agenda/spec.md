# admin-agenda

## ADDED Requirements

### Requirement: Acesso à agenda exige a permissão `channels.manage`

As telas e ações da agenda no painel SHALL exigir a permissão `channels.manage`, re-checada no
servidor em cada ação de escrita. Esconder o link é cortesia; o controle é do servidor.

#### Scenario: Operador sem permissão

- **WHEN** um usuário sem `channels.manage` submete qualquer ação da agenda
- **THEN** a ação é recusada no servidor com a mensagem de falta de permissão, sem efeito

### Requirement: Grade semanal configurável pela serventia

A serventia SHALL configurar, no painel, os horários de início que atende em cada dia da semana
(segunda a sexta), podendo deixar dias sem nenhum horário. A grade salva SHALL valer
imediatamente para a página pública de agendamento. Horários já agendados MUST NOT ser
apagados pela edição da grade: remover um horário da grade apenas o retira da oferta futura.

#### Scenario: Serventia define terças e quintas

- **WHEN** a serventia salva a grade com horários apenas em terça e quinta
- **THEN** a página pública passa a oferecer apenas terças e quintas, nos horários salvos

#### Scenario: Horário removido da grade com agendamento vivo

- **WHEN** a serventia remove da grade um horário que já tem agendamento em data futura
- **THEN** o agendamento existente permanece vivo e visível na agenda do dia; apenas novas
  datas deixam de oferecer aquele horário

### Requirement: Listas de serviços e modos de atendimento editáveis

A serventia SHALL manter no painel a lista de serviços agendáveis (rótulos livres, ex.:
"Registro de recém-nascido", "Tabelião") e a lista de modos de atendimento (ex.: "Presencial",
"On-line"). As listas SHALL alimentar os campos do formulário público. Um agendamento gravado
SHALL preservar o rótulo do serviço da época, mesmo que a lista mude depois.

#### Scenario: Serviço renomeado depois do agendamento

- **WHEN** a serventia renomeia ou remove um serviço que já tem agendamento gravado
- **THEN** o agendamento antigo continua exibindo o rótulo com que foi criado

### Requirement: Agenda do dia

O painel SHALL mostrar os agendamentos por dia, com horário, nome, contato, serviço e modo de
cada um, e os estados agendado, atendido e cancelado. As ações disponíveis SHALL ser marcar
atendido e cancelar; confirmar e propor outro horário MUST NOT existir.

#### Scenario: Dia com agendamentos

- **WHEN** o operador abre a agenda de um dia com agendamentos
- **THEN** vê a lista ordenada por horário com nome, serviço, modo e contato de cada cidadão

### Requirement: Cancelamento individual com motivo por e-mail

O cancelamento de um agendamento pelo painel SHALL exigir um motivo e SHALL enviar ao cidadão
um e-mail com o dia, o horário e o motivo. O horário cancelado SHALL voltar à oferta pública. A
ação SHALL ser registrada na auditoria.

#### Scenario: Serventia cancela um horário

- **WHEN** o operador cancela um agendamento informando o motivo
- **THEN** o agendamento passa a cancelado, o cidadão recebe o e-mail com o motivo e o horário
  volta a ser oferecido no site

### Requirement: Fechar um dia inteiro

O painel SHALL oferecer fechar uma data específica com motivo. O fechamento SHALL cancelar
todos os agendamentos vivos da data, enviar a cada cidadão o e-mail com o motivo, e retirar a
data da oferta pública. A ação SHALL ser registrada na auditoria.

#### Scenario: Tabelião fecha uma quarta-feira

- **WHEN** o operador fecha uma data que tem três agendamentos vivos, informando o motivo
- **THEN** os três passam a cancelados, cada cidadão recebe o e-mail com o motivo, e a data
  deixa de ser oferecida na página pública

#### Scenario: Falha de envio não desfaz o fechamento

- **WHEN** o envio de um dos e-mails de cancelamento falha
- **THEN** o fechamento e os cancelamentos permanecem valendo, e a falha fica registrada no log
  para a serventia contatar o cidadão pelo telefone

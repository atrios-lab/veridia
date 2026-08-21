## ADDED Requirements

### Requirement: Régua de dias úteis com ocupação

A agenda do dia SHALL exibir uma régua de dias úteis (segunda a sexta; sábado e domingo MUST
NOT aparecer) com, por dia: dia da semana e do mês, marca "hoje", ocupação "X de Y" contando
agendamentos não cancelados sobre os horários da grade, e o estado "Fechado" quando a data está
em `closedDates`. Setas SHALL paginar a régua para frente e para trás sem trocar o dia
selecionado; escolher um dia da régua abre a agenda daquele dia.

#### Scenario: Semana com dia fechado

- **WHEN** o operador abre a agenda e uma das datas da régua está fechada
- **THEN** o cartão da data mostra "Fechado" no lugar da ocupação, e os demais mostram "X de Y"

### Requirement: O dia lista horários livres, não só agendamentos

A lista do dia SHALL cobrir todos os horários da grade da data: os agendados (qualquer status)
e os livres. Um horário livre ainda oferecido no site SHALL dizer que aparece no site para
agendamento; um horário livre que já passou MUST NOT ser oferecido para reserva. Em data
fechada, horários livres MUST NOT aparecer como reserváveis. O cabeçalho do dia SHALL resumir
"N horários · N agendados · N livres no site".

#### Scenario: Dia com grade de três horários e dois agendados

- **WHEN** o operador abre um dia futuro com grade de três horários e dois agendamentos vivos
- **THEN** vê três linhas: duas com os agendamentos e uma "Livre — aparece no site", e o resumo
  "3 horários · 2 agendados · 1 livre no site"

### Requirement: Reserva de balcão em horário livre

Um horário livre e ainda oferecido SHALL aceitar "Reservar para um cidadão": nome e telefone
obrigatórios, e-mail opcional, serviço e modo das listas configuradas. A reserva SHALL passar
pelas mesmas regras do site (dia oferecido, horário livre, corrida decidida pelo banco) e ser
gravada com origem de balcão, exibida com a marca "Reservado no balcão". Com e-mail informado,
o cidadão SHALL receber a mesma confirmação com link de cancelamento; sem e-mail, nenhum envio.
A ação SHALL exigir `channels.manage` re-checada no servidor e ser auditada.

#### Scenario: Serventia reserva por telefone

- **WHEN** o operador reserva um horário livre com nome, telefone e serviço, sem e-mail
- **THEN** o horário sai da oferta do site, a linha mostra "Reservado no balcão" e nenhum
  e-mail é enviado

#### Scenario: Horário tomado na corrida

- **WHEN** um cidadão do site toma o horário no instante em que o operador reserva
- **THEN** exatamente uma das duas gravações vale e a outra recebe recusa clara

### Requirement: Marcar falta do cidadão

Um agendamento vivo SHALL aceitar a ação "Faltou", que o passa ao status `no_show` (rotulado
"Faltou"). A falta MUST NOT enviar e-mail ao cidadão, MUST NOT liberar o horário e SHALL ser
auditada. Um agendamento cancelado ou já atendido MUST NOT aceitar a ação.

#### Scenario: Cidadão não compareceu

- **WHEN** o operador marca "Faltou" em um agendamento vivo
- **THEN** a linha passa ao estado "Faltou" e nada é enviado ao cidadão

### Requirement: Protocolo exibido por agendamento

Cada linha de agendamento SHALL exibir o protocolo `AGD.AAAA.NNNNNN` quando o agendamento o
tem. Agendamentos anteriores à numeração MAY não ter protocolo e a linha simplesmente o omite.

#### Scenario: Agendamento novo na lista do dia

- **WHEN** o operador abre o dia de um agendamento criado após a numeração
- **THEN** a linha mostra o protocolo no formato AGD.AAAA.NNNNNN

### Requirement: Barra lateral da agenda do dia

A agenda do dia SHALL manter, em qualquer estado da grade: um cartão permanente que leva à
configuração da agenda (dizendo que vale para todas as semanas); o cartão "Fechar este dia"
com o efeito e a quantidade de cancelamentos, quando a data não está fechada; e, quando houver,
o cartão "Dias fechados à frente" listando as datas fechadas de hoje em diante com ação
"Reabrir" por data e a nota de que dia sem horário configurado não precisa ser fechado. Uma
data fechada selecionada SHALL mostrar o motivo e a ação de reabrir.

#### Scenario: Grade já preenchida

- **WHEN** o operador abre a agenda do dia com a grade preenchida
- **THEN** o cartão de configuração está presente e leva à tela de configuração

#### Scenario: Datas fechadas à frente

- **WHEN** existem datas fechadas de hoje em diante
- **THEN** o cartão lista cada uma com "Reabrir", e reabrir remove a data de `closedDates` sem
  reviver agendamentos já cancelados

## MODIFIED Requirements

### Requirement: Grade semanal configurável pela serventia

A serventia SHALL configurar, no painel, os horários de início que atende em cada dia da semana
(segunda a sexta), podendo deixar dias sem nenhum horário. A edição SHALL ser estruturada: um
chip por horário com remoção individual, adição por seletor de hora (sem digitação de formato),
e "Copiar de segunda" para repetir a grade de segunda em um dia vazio. Cada dia SHALL indicar
sua capacidade ("N cidadãos/dia") ou que não aparece no site. A grade salva SHALL valer
imediatamente para a página pública de agendamento. Horários já agendados MUST NOT ser apagados
pela edição da grade: remover um horário da grade apenas o retira da oferta futura, e a remoção
de um horário com agendamento futuro SHALL pedir confirmação dizendo isso. A tela SHALL exibir
uma prévia, calculada do estado ainda não salvo, de como o cidadão verá os dias e horários
(ocupados riscados), e uma barra de alterações não salvas com descartar e salvar.

#### Scenario: Serventia define terças e quintas

- **WHEN** a serventia salva a grade com horários apenas em terça e quinta
- **THEN** a página pública passa a oferecer apenas terças e quintas, nos horários salvos

#### Scenario: Horário removido da grade com agendamento vivo

- **WHEN** a serventia remove da grade um horário que já tem agendamento em data futura
- **THEN** a remoção pede confirmação, o agendamento existente permanece vivo e visível na
  agenda do dia, e apenas novas datas deixam de oferecer aquele horário

#### Scenario: Prévia reflete o que ainda não foi salvo

- **WHEN** a serventia adiciona um horário e ainda não salvou
- **THEN** a prévia já mostra o horário novo e a barra de alterações não salvas está visível

### Requirement: Listas de serviços e modos de atendimento editáveis

A serventia SHALL manter no painel a lista de serviços agendáveis, cada um com um alternador
"Só com o tabelião", e a lista de modos de atendimento como cartões marcáveis (modos conhecidos
com descrição; um modo já configurado fora da lista conhecida SHALL continuar aparecendo e
selecionável). As listas SHALL alimentar os campos do formulário público. Um agendamento
gravado SHALL preservar o rótulo do serviço da época, mesmo que a lista mude depois.

#### Scenario: Serviço renomeado depois do agendamento

- **WHEN** a serventia renomeia ou remove um serviço que já tem agendamento gravado
- **THEN** o agendamento antigo continua exibindo o rótulo com que foi criado

#### Scenario: Serviço marcado "só com o tabelião"

- **WHEN** a serventia liga o alternador de um serviço e salva
- **THEN** o formulário público passa a anunciar a marca desse serviço ao cidadão

### Requirement: Agenda do dia

O painel SHALL mostrar os agendamentos por dia, com horário, nome, contato, serviço, modo e
protocolo (quando houver) de cada um, e os estados agendado, reservado no balcão, atendido,
faltou e cancelado. As ações disponíveis sobre um agendamento vivo SHALL ser marcar atendido,
marcar falta e cancelar; confirmar e propor outro horário MUST NOT existir.

#### Scenario: Dia com agendamentos

- **WHEN** o operador abre a agenda de um dia com agendamentos
- **THEN** vê a lista ordenada por horário com nome, serviço, modo, contato e estado de cada um

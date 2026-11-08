## ADDED Requirements

### Requirement: Horário do balcão aceita intervalo

`counterHours` SHALL aceitar um intervalo opcional (`lunchBreak`) com início e fim no formato
`HH:MM`. O intervalo SHALL terminar depois de começar e SHALL ficar estritamente dentro da
abertura e do fechamento. Sem intervalo, o horário é contínuo como antes.

#### Scenario: Intervalo com meia hora

- **WHEN** a configuração declara abertura 8, fechamento 16 e intervalo de "12:00" a "13:30"
- **THEN** o schema aceita e o balcão está fechado de 12h00 a 13h29

#### Scenario: Intervalo fora do expediente é recusado

- **WHEN** o intervalo declarado começa antes da abertura ou termina depois do fechamento
- **THEN** o schema recusa com a mensagem "O intervalo tem de ficar dentro do horário de
  atendimento."

### Requirement: Linha antiga do painel não apaga o intervalo da configuração

Um override de horário gravado antes do intervalo existir (sem a chave `lunchBreak`) SHALL herdar
o intervalo da configuração em código quando ele couber nas horas salvas. Um override com
`lunchBreak: null` SHALL valer como "sem intervalo".

#### Scenario: Override antigo herda o intervalo

- **WHEN** a configuração tem intervalo de 12h às 14h e o override salvo é `{ startHour: 8, endHour: 18 }`
- **THEN** o horário em vigor é 8h às 18h com intervalo de 12h às 14h

#### Scenario: Override explícito sem intervalo

- **WHEN** o override salvo traz `lunchBreak: null`
- **THEN** o horário em vigor não tem intervalo

### Requirement: Status do balcão é calculado e escrito em um lugar só

O site SHALL calcular "aberto agora" a partir de `counterHours`, em minutos, considerando dia útil
(sem fim de semana nem feriado nacional) e o intervalo. Chat, página de contato, indicador do
painel e home SHALL usar o mesmo cálculo, e a home e a página de contato SHALL usar o mesmo texto.

#### Scenario: Aberto, fechando no fim do dia

- **WHEN** o balcão abre de 8h às 14h sem intervalo e são 10h de uma terça útil
- **THEN** o texto é "Aberto agora · fecha às 14h"

#### Scenario: Aberto, com intervalo pela frente

- **WHEN** o balcão tem intervalo de 12h às 14h e são 10h de uma terça útil
- **THEN** o texto é "Aberto agora · intervalo às 12h"

#### Scenario: Em intervalo

- **WHEN** o balcão tem intervalo de 12h às 13h30 e são 13h de uma terça útil
- **THEN** o status é fechado, o chat não aceita conversa e o texto é "Em intervalo · volta às 13h30"

#### Scenario: Fechado até o próximo dia útil

- **WHEN** é sábado
- **THEN** o texto é "Fechado agora · abre segunda às 8h"

#### Scenario: Feriado em dia de semana

- **WHEN** é quarta-feira, 24 de junho (São João)
- **THEN** o status é fechado, o chat não aceita conversa e o texto é "Fechado hoje, feriado de
  São João · abre quinta às 8h", dizendo que é feriado e qual

#### Scenario: Dados estruturados com dia partido

- **WHEN** o balcão tem intervalo
- **THEN** o JSON-LD da serventia declara duas `OpeningHoursSpecification`, manhã e tarde

### Requirement: Dias sem expediente seguem o Código de Normas do estado

Um dia útil SHALL ser um dia de semana que não é feriado nacional nem dia em que o Código de
Normas do estado da serventia fecha os serviços extrajudiciais. Para o RN (Provimento 156/2016,
§6º), SHALL fechar também: segunda e terça de Carnaval, quarta-feira de Cinzas, 24/06 (São
João), 29/06 (São Pedro), 24/12, 31/12 e o feriado estadual de 03/10 (Lei 8.913/2006). A regra
SHALL valer para todo cálculo de dia útil: status do balcão, chat, agenda, prazos de pedidos e
editais.

#### Scenario: São João não é dia útil

- **WHEN** um prazo de 1 dia útil começa em 23/06/2026
- **THEN** ele vence em 25/06/2026, pulando o São João

#### Scenario: Quarta de Cinzas fecha o dia inteiro

- **WHEN** a data é a quarta-feira de Cinzas
- **THEN** ela não é dia útil

#### Scenario: Estado sem calendário não passa despercebido

- **WHEN** um segundo estado entra em `SUPPORTED_STATES`
- **THEN** o código não compila sem a lista desse estado e um teste avisa que `isBusinessDay`
  tem de passar a receber o estado

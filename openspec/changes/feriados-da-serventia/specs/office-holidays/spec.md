## ADDED Requirements

### Requirement: Serventia declara os próprios dias sem expediente

Cada serventia SHALL poder ter uma lista de feriados próprios, cada um com nome, data e se repete
todo ano. Um feriado anual SHALL valer no mesmo dia e mês de todo ano; um de data única, só
naquela data. A lista SHALL começar vazia.

#### Scenario: Feriado anual

- **WHEN** a serventia cadastra "São Sebastião" em 20/01 com "Todo ano"
- **THEN** 20/01/2026 e 20/01/2027 não são dias úteis para ela

#### Scenario: Data única

- **WHEN** a serventia cadastra um ponto facultativo em 14/08/2026 sem "Todo ano"
- **THEN** só 14/08/2026 deixa de ser dia útil

### Requirement: Feriado próprio vale em todo cálculo de dia útil

Os feriados próprios SHALL ser considerados em todo cálculo de dia útil da serventia: status do
balcão e chat, horários oferecidos na agenda (site, painel e prévia da configuração), prazos dos
pedidos (fila, detalhe, consulta do cidadão, retomada após pausa) e datas dos editais.

#### Scenario: Prazo pula o feriado próprio

- **WHEN** um prazo de 1 dia útil começa numa sexta, a segunda é feriado nacional e a terça é
  feriado próprio da serventia
- **THEN** o prazo vence na quarta

#### Scenario: Agenda não oferece horário no feriado próprio

- **WHEN** a sexta-feira é feriado próprio da serventia e a agenda atende às sextas
- **THEN** o site oferece a sexta seguinte

#### Scenario: Status diz o nome do feriado próprio

- **WHEN** hoje, uma segunda, é o "Dia do Evangélico" cadastrado pela serventia
- **THEN** o status é "Fechado hoje, feriado de Dia do Evangélico · abre terça às 8h"

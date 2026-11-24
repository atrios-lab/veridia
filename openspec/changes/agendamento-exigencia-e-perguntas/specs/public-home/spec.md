## ADDED Requirements

### Requirement: Feriado no cartão de horário
O cartão de horário do site DEVE (SHALL) dizer qual é o feriado, além de quando reabre, quando o cartório está fechado e há um dia útil de feriado entre agora e a reabertura.

#### Scenario: Feriado amanhã
- **WHEN** é terça à noite e quarta é feriado de São João
- **THEN** o cartão diz "Fechado agora · amanhã é feriado de São João · abre quinta às 8h"

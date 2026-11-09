## ADDED Requirements

### Requirement: Sugestão dos horários do dia anterior

Na configuração de uma agenda, um dia da semana sem horários SHALL mostrar como sugestão os
horários do dia anterior mais próximo que tenha horários, com uma ação que os copia para o dia,
junto com os serviços de cada horário.

#### Scenario: Terça vazia

- **WHEN** a segunda tem 08:00, 09:00 e 10:00 e a terça está vazia
- **THEN** a terça mostra "Sugestão, os mesmos de segunda" e "Usar os mesmos de segunda" copia os três horários

### Requirement: Serviços por horário

Cada horário de cada dia da semana SHALL poder ser restrito a alguns serviços da agenda. Sem
restrição, o horário atende todos os serviços da agenda. Ao salvar, a restrição de um horário
que saiu da grade e os serviços que a agenda não oferece mais SHALL ser descartados.

#### Scenario: 08:30 só para firma

- **WHEN** o cartório marca, na segunda às 08:30, só "Reconhecimento de firma"
- **THEN** o horário aparece como "08:30 · Reconhecimento de firma" e é salvo assim

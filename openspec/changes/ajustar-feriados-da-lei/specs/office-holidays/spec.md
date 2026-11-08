## ADDED Requirements

### Requirement: Serventia ajusta os feriados da lei

A serventia SHALL poder desligar, para si, qualquer feriado nacional ou do Código de Normas do
estado, pelo id da regra, valendo para todos os anos. Um feriado desligado SHALL deixar de fechar
a serventia em todo cálculo de dia útil. "Alterar" SHALL desligar o feriado da lei e trazer para
os feriados próprios uma linha com o mesmo nome e a data daquele ano, anual quando a data é fixa.
Um id que o calendário não conhece SHALL ser recusado.

#### Scenario: Feriado da lei que não vale na localidade

- **WHEN** a serventia marca "Não fecha aqui" no São Pedro e salva
- **THEN** 29/06 passa a ser dia útil para ela, e o São João continua fechando

#### Scenario: Feriado da lei em outra data

- **WHEN** a serventia altera o São João para 25/06 com "Todo ano"
- **THEN** 24/06 é dia útil e 25/06 fecha com o nome "São João"

#### Scenario: Desfazer

- **WHEN** a serventia toca em "Voltar a considerar" e salva
- **THEN** o feriado da lei volta a fechar a serventia

#### Scenario: Linha antiga

- **WHEN** o override salvo não tem `disabledHolidays`
- **THEN** todos os feriados da lei continuam valendo

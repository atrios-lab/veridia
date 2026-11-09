## ADDED Requirements

### Requirement: Vagas por horário e grade sugerida

Cada horário da agenda SHALL ter um número de vagas (padrão 1), e a agenda do dia SHALL mostrar as
vagas livres de cada horário. O painel SHALL oferecer montar a grade a partir do horário de
funcionamento, do número de pessoas atendendo, do almoço em turnos e da duração de cada serviço,
intercalando os serviços rápidos, e aplicar a grade sugerida aos dias escolhidos antes de salvar.

#### Scenario: Vinte atendentes

- **WHEN** o cartório pede a grade para 20 pessoas, das 08:00 às 14:00
- **THEN** a sugestão tem 20 vagas às 08:00, e ao usar e salvar o horário aparece como "08:00 ×20"

#### Scenario: Agenda do dia com vagas

- **WHEN** dois cidadãos marcam 08:00 num horário de 20 vagas
- **THEN** a agenda do dia mostra os dois às 08:00 e "Livre: 18 vagas"

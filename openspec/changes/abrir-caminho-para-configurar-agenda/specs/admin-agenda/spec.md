## ADDED Requirements

### Requirement: A configuração da agenda é alcançável a partir da agenda do dia

A agenda do dia no painel SHALL oferecer, em qualquer estado da grade semanal, um caminho
visível para a tela de configuração da agenda. O aviso de grade vazia MAY continuar oferecendo
a mesma chamada de ação, mas MUST NOT ser a única forma de chegar lá: uma serventia que já
salvou horários SHALL conseguir voltar para editá-los sem apagar a grade nem digitar a URL.

#### Scenario: Grade já preenchida

- **WHEN** o operador abre a agenda do dia de uma serventia que já tem horários salvos na grade
- **THEN** vê na própria tela um caminho para a configuração da agenda e chega à tela com os
  campos de horários, serviços e modos preenchidos

#### Scenario: Grade ainda vazia

- **WHEN** o operador abre a agenda do dia de uma serventia que nunca configurou horários
- **THEN** continua vendo o aviso de que a agenda não tem horários, e o caminho permanente para
  a configuração também está presente

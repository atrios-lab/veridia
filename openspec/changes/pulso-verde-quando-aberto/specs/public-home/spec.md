## ADDED Requirements

### Requirement: Cor do pulso diz o estado do balcão

O pulso do cartão de horário SHALL ser verde enquanto o balcão está aberto e amarelo de atenção
enquanto está fechado ou em intervalo, com borda de 3px a 85% de intensidade no início de cada
ciclo. Com movimento reduzido, o cartão SHALL continuar parado.

#### Scenario: Aberto

- **WHEN** um visitante abre a home dentro do horário do balcão
- **THEN** o cartão pulsa em verde e o ponto de status é verde

#### Scenario: Fechado

- **WHEN** um visitante abre a home com o balcão fechado ou em intervalo
- **THEN** o cartão pulsa em amarelo

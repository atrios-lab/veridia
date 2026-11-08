## ADDED Requirements

### Requirement: O tabelião escolhe os canais de cada dia

A agenda do tabelião SHALL ter os canais "Presencial", "Por vídeo" e "Por ligação", escolhidos
por dia da semana na configuração (padrão: presencial; ao menos um por dia) e, para uma data
só, na agenda do dia, com volta ao padrão da semana. A escolha de uma data SHALL valer sobre a
do dia da semana. Agendamentos já feitos SHALL manter o canal com que foram marcados.

#### Scenario: Quarta só por ligação

- **WHEN** a serventia deixa a quarta do tabelião só com "Por ligação" e salva
- **THEN** o site, numa quarta, diz que o tabelião atende só por ligação

#### Scenario: Uma segunda diferente

- **WHEN** a segunda do tabelião é presencial e por vídeo, e a serventia deixa a segunda 16/11 só presencial
- **THEN** o site oferece só presencial em 16/11 e os dois canais nas outras segundas

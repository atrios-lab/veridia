## ADDED Requirements

### Requirement: Data e hora de um instante saem no fuso da serventia

O sistema SHALL mostrar a data e a hora de todo instante registrado no fuso da serventia, em telas, PDFs e comprovantes. O resultado MUST ser o mesmo qualquer que seja o fuso do servidor ou do aparelho de quem vê.

#### Scenario: Horário no detalhe do pedido com o servidor em UTC

- **WHEN** um pedido feito às 10:30 do horário da serventia é aberto no painel, com o servidor em UTC
- **THEN** "Data e hora do atendimento" mostra 10:30, e não 13:30

#### Scenario: Pedido feito depois das 21h

- **WHEN** um pedido é feito às 22:30 de 03/11 no horário da serventia e o servidor está em UTC
- **THEN** o painel mostra 03/11, 22:30, e não 04/11, 01:30

#### Scenario: Aparelho em outro fuso

- **WHEN** o cidadão consulta o protocolo em um aparelho configurado em outro fuso
- **THEN** os horários do pedido são os mesmos que o painel da serventia mostra

#### Scenario: Primeira renderização igual à do navegador

- **WHEN** uma tela renderizada no servidor é hidratada no navegador de um aparelho em outro fuso
- **THEN** o horário é o mesmo nas duas renderizações

### Requirement: PDFs trazem o dia do pedido no fuso da serventia

Os PDFs do requerimento e dos comprovantes SHALL trazer a data do pedido no fuso da serventia. A declaração de hipossuficiência SHALL usar esse mesmo fuso no carimbo de aceite.

#### Scenario: Requerimento de pedido feito à noite

- **WHEN** o requerimento de um pedido feito às 22:30 de 03/11 é gerado com o servidor em UTC
- **THEN** o subtítulo do PDF traz 03/11/2026, e não 04/11/2026

#### Scenario: Carimbo da declaração

- **WHEN** a declaração de um aceite registrado às 22:30 de 03/11 é gerada
- **THEN** o carimbo mostra 03/11/2026 às 22:30

### Requirement: Dia de calendário não muda com o fuso

Um dia de calendário, como a previsão de conclusão, SHALL ser mostrado exatamente como está registrado, sem passar por conversão de fuso.

#### Scenario: Previsão de conclusão no acompanhamento

- **WHEN** o cidadão com aparelho no Brasil abre `/acompanhar` e a previsão de conclusão é 20/11/2026
- **THEN** a tela mostra 20/11/2026, e não 19/11/2026

#### Scenario: Previsão vista de um aparelho a leste da serventia

- **WHEN** o cidadão abre a consulta do protocolo em um aparelho à frente do horário da serventia e a previsão é 20/11/2026
- **THEN** a tela mostra 20/11/2026

### Requirement: Prazo da LGPD conta a partir do dia do pedido na serventia

O prazo de 15 dias em destaque no painel SHALL contar a partir do dia em que o pedido foi feito no fuso da serventia, com o mesmo resultado das telas de LGPD.

#### Scenario: Solicitação feita depois das 21h

- **WHEN** uma solicitação de LGPD é feita às 22:30 de 03/11 no horário da serventia e o servidor está em UTC
- **THEN** o prazo em destaque conta a partir de 03/11, e não de 04/11

### Requirement: Ano do protocolo é o da serventia

O número de protocolo SHALL usar o ano corrente no fuso da serventia, qualquer que seja o fuso do servidor.

#### Scenario: Pedido na noite de 31 de dezembro

- **WHEN** um pedido é feito às 22:00 de 31/12/2026 no horário da serventia e o servidor está em UTC
- **THEN** o protocolo leva o ano 2026

#### Scenario: Pedido na virada do ano

- **WHEN** um pedido é feito às 00:10 de 01/01/2027 no horário da serventia
- **THEN** o protocolo leva o ano 2027

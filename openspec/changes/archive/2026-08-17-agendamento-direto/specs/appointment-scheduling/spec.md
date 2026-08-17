# appointment-scheduling — delta

## MODIFIED Requirements

### Requirement: Dias oferecidos são dias de atendimento

A página de agendamento SHALL oferecer apenas dias em que a serventia atende: dias úteis (de
segunda a sexta, excluídos os feriados nacionais fixos e móveis) **que tenham horários na grade
semanal configurada pela serventia** e que não estejam fechados por exceção. O cidadão MUST NOT
ser capaz de escolher uma data digitando-a: a escolha é feita entre os dias oferecidos.

#### Scenario: Fim de semana não aparece

- **WHEN** a faixa de dias oferecida cobre um sábado ou domingo
- **THEN** esses dias não aparecem entre as opções, e a faixa avança para o próximo dia oferecido

#### Scenario: Feriado nacional móvel não aparece

- **WHEN** a faixa de dias inclui sexta-feira santa, carnaval ou Corpus Christi do ano corrente
- **THEN** esse dia não aparece entre as opções

#### Scenario: Dia da semana sem grade não aparece

- **WHEN** a serventia configurou horários apenas para terças e quintas
- **THEN** segundas, quartas e sextas não aparecem entre os dias oferecidos

#### Scenario: Dia fechado pela serventia não aparece

- **WHEN** a serventia fechou uma data específica com motivo
- **THEN** essa data não aparece entre os dias oferecidos

#### Scenario: Grade não configurada

- **WHEN** a serventia ainda não configurou nenhum horário na grade semanal
- **THEN** a página não oferece dias nem inventa uma grade padrão: mostra o aviso para agendar
  pelos contatos da serventia, com telefone e WhatsApp

#### Scenario: Dia é apresentado por extenso

- **WHEN** um dia é oferecido
- **THEN** ele é exibido com o dia da semana abreviado, o dia do mês e o mês abreviado
  (ex.: "qua 06 ago"), nunca em formato numérico americano

### Requirement: Confirmação do agendamento

A tela de confirmação SHALL mostrar o dia e o horário agendados, avisar que a confirmação e o
link de cancelamento foram enviados para o e-mail informado, e oferecer o atalho para adicionar
o horário à agenda. A tela MUST NOT exibir protocolo nem chave de acesso: o e-mail é o canal do
agendamento.

#### Scenario: Arquivo de agenda

- **WHEN** o cidadão escolhe "Adicionar à agenda"
- **THEN** o site entrega um arquivo `.ics` com o dia, o horário, o nome da serventia, o
  endereço e o serviço no corpo do evento

#### Scenario: E-mail de confirmação

- **WHEN** um agendamento é gravado
- **THEN** o cidadão recebe um e-mail com dia, horário, serviço, modo de atendimento, endereço
  da serventia, o arquivo de agenda e o link para cancelar o agendamento

## ADDED Requirements

### Requirement: Horários oferecidos são os livres da grade

A página SHALL oferecer, para o dia escolhido, apenas os horários de início configurados na
grade semanal que ainda não foram tomados. Um horário SHALL comportar exatamente um cidadão:
horário agendado deixa de ser oferecido. No dia corrente, horários cujo início já passou no
relógio da serventia MUST NOT ser oferecidos.

#### Scenario: Horário tomado some da oferta

- **WHEN** um cidadão agenda o horário de 09:00 de um dia
- **THEN** a página passa a oferecer esse dia sem o horário de 09:00

#### Scenario: Atendimento realizado não devolve a faixa

- **WHEN** a serventia marca um agendamento como atendido
- **THEN** o horário continua fora da oferta: a hora do balcão foi gasta, não liberada

#### Scenario: Corrida pelo mesmo horário

- **WHEN** dois envios disputam o último estado livre de um mesmo dia e horário
- **THEN** apenas um é gravado; o outro recebe a explicação de que o horário acabou de ser
  preenchido e a grade atualizada do dia

#### Scenario: Dia sem horário livre

- **WHEN** todos os horários do dia escolhido foram tomados
- **THEN** a página informa que o dia está cheio, nomeia o próximo dia com horário livre e
  oferece o atalho para ele

### Requirement: Agendamento imediato com serviço e modo de atendimento

O formulário SHALL exigir dia, horário, nome completo, e-mail e telefone; CPF SHALL ser
opcional. O cidadão SHALL escolher o serviço desejado na lista configurada pela serventia e o
modo de atendimento na lista configurada. O envio válido SHALL gravar o agendamento
imediatamente, sem confirmação posterior da serventia. O formulário SHALL usar campo-armadilha
invisível contra robô e MUST NOT usar CAPTCHA nem gerar protocolo ou chave.

#### Scenario: Envio válido agenda na hora

- **WHEN** o cidadão envia dia, horário livre, nome, e-mail e telefone válidos, com serviço e
  modo escolhidos
- **THEN** o agendamento é gravado como confirmado, a tela de confirmação é exibida e o e-mail
  de confirmação é enviado

#### Scenario: Campo-armadilha preenchido

- **WHEN** o campo invisível chega preenchido
- **THEN** a tela de sucesso é exibida e nada é gravado

#### Scenario: E-mail ausente

- **WHEN** o envio chega sem e-mail válido
- **THEN** o agendamento não é gravado e o formulário explica que o e-mail é necessário para a
  confirmação

### Requirement: Cancelamento pelo link do e-mail

O e-mail de confirmação SHALL conter um link de cancelamento com token de uso único, armazenado
apenas como hash. A página do link SHALL mostrar o agendamento e pedir confirmação antes de
cancelar; o cancelamento SHALL liberar o horário na oferta. Token inválido e agendamento já
cancelado ou atendido SHALL receber a mesma resposta neutra, sem revelar se o agendamento
existe.

#### Scenario: Cidadão cancela pelo link

- **WHEN** o cidadão abre o link do e-mail e confirma o cancelamento de um agendamento ativo
- **THEN** o agendamento passa a cancelado e o horário volta a ser oferecido na página pública

#### Scenario: Token inválido

- **WHEN** a página de cancelamento recebe um token que não corresponde a agendamento ativo
- **THEN** a resposta é a mensagem neutra de link inválido ou expirado, sem detalhes

## REMOVED Requirements

### Requirement: Faixas de uma hora com ocupação visível

**Reason**: A oferta deixa de ser janela fixa fatiada em faixas de uma hora com capacidade; os
horários vêm da grade semanal configurada pela serventia, com um cidadão por horário.
**Migration**: Substituída por "Horários oferecidos são os livres da grade". A recusa no
servidor passa a ser pela unicidade de dia+horário, não por contagem de capacidade.

### Requirement: Pedido de horário com contato e motivo livre

**Reason**: O envio deixa de ser um pedido a confirmar; vira agendamento imediato, sem
protocolo nem chave.
**Migration**: Substituída por "Agendamento imediato com serviço e modo de atendimento". O
motivo livre dá lugar à escolha de serviço na lista configurada.

### Requirement: Acompanhamento e horário proposto

**Reason**: Sem pedido não há proposta da serventia nem aceite do cidadão; sem protocolo não há
consulta de andamento. O canal do agendamento é o e-mail.
**Migration**: A consulta por protocolo deixa de tratar agendamentos. Cancelamentos da
serventia chegam por e-mail com motivo; o cidadão cancela pelo link do e-mail de confirmação.

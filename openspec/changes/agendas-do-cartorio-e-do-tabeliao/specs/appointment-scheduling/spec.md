## ADDED Requirements

### Requirement: O cidadão escolhe entre a agenda do cartório e a do tabelião

O site SHALL oferecer as agendas que têm horários e ao menos um serviço marcado. Com duas, a
primeira pergunta SHALL ser com quem é o atendimento; com uma, o site SHALL abri-la direto. Os
dias, horários e serviços oferecidos SHALL ser os da agenda escolhida, e o agendamento SHALL
gravar a agenda.

#### Scenario: Duas agendas configuradas

- **WHEN** o cidadão abre a página de agendamento e as duas agendas têm horários e serviços
- **THEN** vê "Com quem é o seu atendimento?" com "Atendimento do cartório" e "Atendimento com o tabelião"

#### Scenario: Agenda sem horários

- **WHEN** a agenda do tabelião não tem nenhum horário
- **THEN** o site abre direto a agenda do cartório

### Requirement: O cidadão sabe o que trazer e quando chegar

O formulário SHALL mostrar a lista do que trazer assim que o serviço é escolhido. A
confirmação SHALL mostrar o aviso de chegar com 15 minutos de antecedência, com a hora, e a
lista do que trazer (documento com foto, CPF e o comprovante, seguidos dos itens do serviço),
e SHALL oferecer o comprovante de agendamento em PDF com o timbre da serventia. O e-mail de
confirmação SHALL trazer a lista, o aviso e o comprovante anexo.

#### Scenario: Confirmação de um testamento às 14:00

- **WHEN** o cidadão agenda "Testamento" às 14:00
- **THEN** a confirmação diz "Chegue com 15 minutos de antecedência, às 13:45" e lista as duas testemunhas
- **AND** "Baixar comprovante (PDF)" entrega o comprovante com o protocolo AGD e a lista do que trazer

## REMOVED Requirements

### Requirement: Serviço "só com o tabelião" anunciado ao cidadão

**Reason**: substituído pela agenda do tabelião: o serviço que depende do tabelião é marcado na
agenda dele, e o cidadão escolhe essa agenda antes do horário.

**Migration**: configurações antigas viram a agenda do cartório com os mesmos serviços; a
serventia marca na agenda do tabelião os que dependem dele.

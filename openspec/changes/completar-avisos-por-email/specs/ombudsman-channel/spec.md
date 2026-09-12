## ADDED Requirements

### Requirement: Aviso por e-mail à serventia sobre manifestação nova
Quando uma manifestação é registrada, a serventia SHALL receber um aviso por e-mail no seu
contato institucional (`tenant.contacts.email`), com o número de registro, o tipo (elogio,
reclamação, sugestão ou denúncia) e um botão que leva direto à manifestação no painel. O aviso
SHALL ser disparado inclusive quando a manifestação é anônima ou marcada como sigilosa, e NÃO
SHALL carregar o nome, o contato ou o texto da manifestação em nenhum dos dois casos. O envio
SHALL ser fire-and-forget: falha de e-mail nunca falha o registro da manifestação.

#### Scenario: Manifestação identificada avisa a serventia
- **WHEN** uma manifestação identificada é registrada
- **THEN** a serventia recebe um e-mail com o registro, o tipo e um botão para o painel, sem o
  nome do manifestante e sem o texto

#### Scenario: Manifestação anônima também avisa
- **WHEN** uma manifestação anônima é registrada
- **THEN** a serventia recebe o mesmo aviso, com o registro e o tipo, sem qualquer dado de
  identificação porque não há nenhum

#### Scenario: Manifestação sigilosa não vaza o nome no aviso
- **WHEN** uma manifestação identificada com sigilo marcado é registrada
- **THEN** o aviso à serventia traz registro e tipo, sem o nome do manifestante

#### Scenario: Falha no envio não impede o registro
- **WHEN** o provedor de e-mail falha ao enviar o aviso à serventia
- **THEN** a manifestação continua registrada e a confirmação na tela aparece completa

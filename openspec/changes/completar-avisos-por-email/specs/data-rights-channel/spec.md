## ADDED Requirements

### Requirement: Aviso por e-mail à serventia sobre requerimento novo
Quando um requerimento LGPD é registrado, a serventia SHALL receber um aviso por e-mail no seu
contato institucional (`tenant.contacts.email`), com o número do protocolo, o direito escolhido e
um botão que leva direto ao requerimento no painel. O aviso NÃO SHALL carregar a descrição do
pedido nem dados do titular além do direito escolhido. O envio SHALL ser fire-and-forget: falha
de e-mail nunca falha o registro do requerimento.

#### Scenario: Requerimento novo avisa a serventia
- **WHEN** um requerimento LGPD é registrado, identificado ou não por CPF
- **THEN** a serventia recebe um e-mail com o protocolo, o direito escolhido e um botão para o
  requerimento no painel, sem a descrição do pedido

#### Scenario: Falha no envio não impede o registro
- **WHEN** o provedor de e-mail falha ao enviar o aviso à serventia
- **THEN** o requerimento continua registrado e a confirmação na tela do titular aparece completa

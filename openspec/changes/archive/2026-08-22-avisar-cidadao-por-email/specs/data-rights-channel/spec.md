## ADDED Requirements

### Requirement: E-mail de confirmação do requerimento

Quando o requerimento LGPD é registrado, o titular SHALL receber no e-mail informado uma
confirmação com o número do protocolo e a instrução de guardar o protocolo e a chave mostrados
na tela; a chave MUST NOT constar do e-mail. O envio SHALL ser fire-and-forget: falha de
e-mail nunca falha o registro.

#### Scenario: Confirmação enviada

- **WHEN** o requerimento é registrado com e-mail "maria@exemplo.com"
- **THEN** chega um e-mail "Requerimento recebido" com o número do protocolo e sem a chave

#### Scenario: Falha de envio não falha o registro

- **WHEN** o provedor de e-mail está fora do ar no momento do registro
- **THEN** o requerimento é protocolado normalmente e a confirmação na tela aparece completa

# ombudsman-channel — delta

## MODIFIED Requirements

### Requirement: Histórico do tratamento na consulta

A consulta por registro e chave SHALL mostrar o tipo, a marca de sigilo, a resposta da ouvidoria
quando houver e o histórico do tratamento a partir das datas do próprio registro. Quando houve
pedido de sigilo, a consulta SHALL afirmar que o nome não apareceu em nenhuma etapa exibida.

Registrada a resposta, o site SHALL avisar por e-mail o manifestante que deixou um endereço de
e-mail no registro. O aviso SHALL dizer apenas que há resposta, com o número do registro e o
atalho para a consulta; o texto da resposta MUST NOT viajar no e-mail. Manifestação anônima, e
manifestação identificada apenas por telefone, MUST NOT gerar envio algum.

#### Scenario: Manifestação respondida

- **WHEN** o cidadão consulta com registro e chave e há resposta registrada
- **THEN** a resposta, o responsável, a data e o histórico aparecem

#### Scenario: Manifestante identificado é avisado

- **WHEN** a ouvidoria responde uma manifestação cujo contato registrado é um e-mail
- **THEN** o manifestante recebe um aviso com o registro e o atalho para a consulta, sem o texto
  da resposta

#### Scenario: Anônima não recebe nada

- **WHEN** a ouvidoria responde uma manifestação sem nome e sem contato
- **THEN** nenhum e-mail é enviado, a resposta é gravada normalmente e nada é registrado como
  falha de envio

#### Scenario: Contato que não é e-mail

- **WHEN** a ouvidoria responde uma manifestação cujo contato registrado é um telefone
- **THEN** nenhum e-mail é enviado e a serventia alcança o manifestante pelo telefone que ele
  deixou

#### Scenario: Anônima não abre consulta

- **WHEN** alguém consulta o número de registro de uma manifestação anônima
- **THEN** a consulta responde com a mesma mensagem de registro ou chave inválidos

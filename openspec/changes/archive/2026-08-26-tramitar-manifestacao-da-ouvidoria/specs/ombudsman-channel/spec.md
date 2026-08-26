## MODIFIED Requirements

### Requirement: Histórico do tratamento na consulta

A consulta por registro e chave SHALL mostrar o tipo, a marca de sigilo, a resposta da ouvidoria
quando houver e o histórico do tratamento a partir das datas do próprio registro. Quando houve
pedido de sigilo, a consulta SHALL afirmar que o nome não apareceu em nenhuma etapa exibida.

O andamento exibido SHALL ser nomeado em português a partir dos cinco andamentos do canal:
Recebida, Em apuração, Respondida, Concluída e Arquivada. A anotação interna da serventia MUST NOT
aparecer na consulta em nenhum andamento, nem como texto nem como evento do histórico.

O último passo do histórico SHALL seguir o andamento do registro, não a existência de resposta:
manifestação encerrada sem resposta SHALL aparecer encerrada, e MUST NOT dizer que segue em
apuração enquanto o andamento diz o contrário.

Registrada a resposta, o site SHALL avisar por e-mail o manifestante que deixou um endereço de
e-mail no registro. O aviso SHALL dizer apenas que há resposta, com o número do registro e o
atalho para a consulta; o texto da resposta MUST NOT viajar no e-mail. Manifestação anônima, e
manifestação identificada apenas por telefone, MUST NOT gerar envio algum.

Mudança de andamento MUST NOT gerar aviso ao manifestante: o cidadão é avisado quando há resposta
para ler, não quando a serventia move o registro internamente.

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

#### Scenario: Andamento novo é nomeado

- **WHEN** o cidadão consulta uma manifestação que a serventia arquivou
- **THEN** a consulta mostra "Arquivada", nunca o valor cru da coluna

#### Scenario: Andamento muda sem avisar

- **WHEN** a serventia move a manifestação para "Em apuração" ou "Concluída"
- **THEN** nenhum e-mail é enviado ao manifestante, e a mudança aparece só quando ele consulta

#### Scenario: Encerrada sem resposta

- **WHEN** o cidadão consulta uma manifestação identificada que a serventia concluiu ou arquivou
  sem registrar resposta
- **THEN** o histórico mostra o encerramento, e não "Em apuração pelo responsável"

#### Scenario: Anotação interna não vaza

- **WHEN** o cidadão consulta uma manifestação em que a serventia salvou anotação interna
- **THEN** nem o texto da anotação nem o evento de tê-la salvo aparecem na consulta

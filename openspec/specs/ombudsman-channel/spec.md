# ombudsman-channel

## Purpose

TBD
## Requirements
### Requirement: Garantias antes do formulário

A ouvidoria SHALL declarar antes do formulário, em qualquer largura de tela, que a manifestação
pode ser anônima (nome e contato opcionais) e que o sigilo é garantido em toda a tramitação. No
celular essas garantias MUST NOT ficar abaixo do formulário nem em coluna lateral.

#### Scenario: Garantias na primeira dobra do celular

- **WHEN** a página é exibida em 390px de largura
- **THEN** as garantias aparecem entre o título e o primeiro campo do formulário

### Requirement: Tipo de manifestação como escolha visível

O tipo SHALL ser escolhido entre quatro cartões com ícone e rótulo — elogio, reclamação,
sugestão e denúncia — e MUST NOT ser um select. O tipo SHALL ser obrigatório.

#### Scenario: Tipo obrigatório

- **WHEN** o formulário é enviado sem tipo escolhido
- **THEN** a manifestação não é gravada e o campo é apontado como obrigatório

### Requirement: Identificação opcional e sigilo explicado

Nome e contato SHALL ser opcionais e rotulados como tais. Quando o cidadão se identifica, SHALL
ser oferecida a opção de manter a identidade em sigilo, com a frase que explica a diferença: no
sigilo o cidadão se identifica para a serventia responder, mas o nome não circula na tramitação.
A opção de sigilo MUST NOT ser oferecida como se substituísse o anonimato.

#### Scenario: Manifestação anônima

- **WHEN** a manifestação é enviada sem nome e sem contato
- **THEN** ela é gravada sem dados de identificação e sem chave de acesso

#### Scenario: Manifestação identificada com sigilo

- **WHEN** a manifestação é enviada com nome, contato e sigilo marcado
- **THEN** ela é gravada com a marca de sigilo e recebe chave de acesso

### Requirement: Registro OUV e chave apenas quando há identificação

Toda manifestação SHALL receber número de registro `OUV.AAAA.NNNNNN`, com sequência própria do
tipo por serventia e ano. A chave de acesso SHALL ser gerada apenas para manifestação
identificada; a manifestação anônima MUST NOT receber chave.

#### Scenario: Confirmação anônima

- **WHEN** a manifestação anônima é registrada
- **THEN** a confirmação mostra apenas o número de registro e explica que, sem identificação,
  não existe chave nem canal de resposta, e indica como obter resposta em um novo registro

#### Scenario: Confirmação identificada

- **WHEN** a manifestação identificada é registrada
- **THEN** a confirmação mostra o número de registro e a chave em destaque, com o aviso de que a
  chave aparece só naquele momento, e o que acontece em seguida

### Requirement: Mensagem e anexo

O formulário SHALL exigir a mensagem e SHALL aceitar anexo opcional de foto ou documento, com as
mesmas regras de tipo e tamanho já aplicadas aos anexos de pedido. O formulário SHALL usar
campo-armadilha invisível e MUST NOT usar CAPTCHA.

#### Scenario: Mensagem vazia

- **WHEN** a manifestação é enviada sem mensagem
- **THEN** ela não é gravada e o campo é apontado como obrigatório

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

